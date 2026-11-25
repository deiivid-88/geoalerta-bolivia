"""Dependencias: usuario autenticado, permisos y auditoría."""
from __future__ import annotations

import json
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import get_db
from .permissions import can
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: str
    name: str
    email: str
    role: str
    institution: str
    jti: str


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Connection = Depends(get_db)) -> CurrentUser:
    if not creds:
        raise HTTPException(401, "Se requiere iniciar sesión.")
    try:
        payload = decode_token(creds.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(401, "La sesión expiró. Vuelva a iniciar sesión.") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Token inválido.") from exc
    if db.execute(text("SELECT 1 FROM revoked_tokens WHERE jti = :j"), {"j": payload["jti"]}).first():
        raise HTTPException(401, "La sesión fue cerrada.")
    row = db.execute(text("SELECT id, name, email, role::text, institution, active FROM users WHERE id = :id"), {"id": payload["sub"]}).mappings().first()
    if not row or not row["active"]:
        raise HTTPException(401, "Cuenta inexistente o desactivada.")
    return CurrentUser(row["id"], row["name"], row["email"], row["role"], row["institution"], payload["jti"])


def require(permission: str):
    def checker(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if not can(user.role, permission):
            raise HTTPException(403, "Su rol no tiene permiso para realizar esta acción.")
        return user

    return checker


def audit(
    db: Connection,
    user: CurrentUser | None,
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    changes: list[dict] | None = None,
    request: Request | None = None,
) -> None:
    db.execute(
        text(
            """INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, summary, changes, ip_address)
               VALUES (:uid, :uname, :urole, :action, :etype, :eid, :summary, CAST(:changes AS jsonb), CAST(:ip AS inet))"""
        ),
        {
            "uid": user.id if user else "ANON",
            "uname": user.name if user else "Ciudadanía (anónimo)",
            "urole": user.role if user else "ciudadano",
            "action": action,
            "etype": entity_type,
            "eid": entity_id,
            "summary": summary,
            "changes": json.dumps(changes) if changes else None,
            "ip": request.client.host if request and request.client else None,
        },
    )


def diff(before: dict, after: dict, fields: list[str]) -> list[dict]:
    def fmt(v: object) -> str:
        if v is None or v == "":
            return "—"
        return json.dumps(v, default=str)[:80] if isinstance(v, (dict, list)) else str(v)

    return [{"field": f, "from": fmt(before.get(f)), "to": fmt(after.get(f))} for f in fields if f in after and str(before.get(f)) != str(after.get(f))]
