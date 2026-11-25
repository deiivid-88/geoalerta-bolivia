"""Alertas, fuentes institucionales, evidencias, usuarios y auditoría."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import IntegrityError

from ..config import get_settings
from ..db import get_db
from ..deps import CurrentUser, audit, current_user, diff, require
from ..permissions import can
from ..schemas import AlertCreate, AlertStatusIn, ClientEventIn, SourcePatch, UserCreate, UserPatch
from ..security import hash_password
from ..storage import resolve, save_bytes

router = APIRouter(tags=["Administración"])

# ───────────────────────── Alertas ─────────────────────────
ALERT_SELECT = """SELECT a.id, a.title, a.type, a.priority, a.status, a.department, a.municipality, a.lat, a.lng, a.description, a.derived_to,
       a.created_at, a.updated_at, a.created_by, a.origin::text AS origin,
       coalesce((SELECT json_agg(json_build_object('type', l.entity_type, 'id', l.entity_id)) FROM alert_links l WHERE l.alert_id = a.id), '[]'::json) AS related
FROM alerts a"""


def _alert(db: Connection, aid: str) -> dict:
    row = db.execute(text(ALERT_SELECT + " WHERE a.id = :id"), {"id": aid}).mappings().first()
    if not row:
        raise HTTPException(404, "Alerta no encontrada.")
    return dict(row)


@router.get("/alerts", tags=["Alertas"])
def list_alerts(page_size: int = Query(1000, le=5000), _: CurrentUser = Depends(require("alerts.view")), db: Connection = Depends(get_db)):
    return [dict(r) for r in db.execute(text(ALERT_SELECT + " ORDER BY a.created_at DESC LIMIT :l"), {"l": page_size}).mappings()]


@router.post("/alerts", status_code=201, tags=["Alertas"])
def create_alert(body: AlertCreate, request: Request, user: CurrentUser = Depends(require("alerts.manage")), db: Connection = Depends(get_db)):
    year = datetime.now(timezone.utc).year
    n = db.execute(text("SELECT count(*) + 1 FROM alerts WHERE id LIKE :p"), {"p": f"GA-ALR-{year}-%"}).scalar_one()
    aid = f"GA-ALR-{year}-{n:06d}"
    db.execute(
        text("""INSERT INTO alerts (id, title, type, priority, status, department, municipality, lat, lng, description, created_by)
                VALUES (:id, :title, :type, :priority, :status, :department, :municipality, :lat, :lng, :description, :by)"""),
        body.model_dump(exclude={"related"}) | {"id": aid, "by": user.name},
    )
    for ref in body.related:
        db.execute(text("INSERT INTO alert_links VALUES (:a, :t, :i) ON CONFLICT DO NOTHING"), {"a": aid, "t": ref.type, "i": ref.id})
    audit(db, user, "crear", "alerta", aid, body.title, request=request)
    return _alert(db, aid)


@router.post("/alerts/{aid}/status", tags=["Alertas"])
def alert_status(aid: str, body: AlertStatusIn, request: Request, user: CurrentUser = Depends(current_user), db: Connection = Depends(get_db)):
    needed = "alerts.derive" if body.status == "derivada" else "alerts.manage"
    if not can(user.role, needed):
        raise HTTPException(403, "Su rol no tiene permiso para realizar esta acción.")
    if body.status == "derivada" and not body.derived_to:
        raise HTTPException(422, "Seleccione la institución a la que se deriva.")
    before = _alert(db, aid)
    db.execute(text("UPDATE alerts SET status = :s, derived_to = coalesce(:d, derived_to), updated_at = now() WHERE id = :id"), {"s": body.status, "d": body.derived_to, "id": aid})
    audit(db, user, "derivar" if body.status == "derivada" else "cambiar_estado", "alerta", aid, body.note or "—", [{"field": "estado", "from": before["status"], "to": body.status}], request)
    return _alert(db, aid)


# ───────────────────────── Fuentes institucionales ─────────────────────────
@router.get("/sources", tags=["Fuentes institucionales"])
def list_sources(_: CurrentUser = Depends(require("sources.view")), db: Connection = Depends(get_db)):
    return [dict(r) for r in db.execute(text("SELECT id, institution, acronym, info_type, updated_at, reference, reference_url, availability::text AS availability, usage_conditions, notes FROM institutional_sources ORDER BY acronym")).mappings()]


@router.get("/source-documents", tags=["Fuentes institucionales"])
def list_source_docs(_: CurrentUser = Depends(require("sources.view")), db: Connection = Depends(get_db)):
    rows = db.execute(text("""SELECT id, source_id, institution, record_type, title, department, municipality, lat, lng, updated_at, reference, summary,
                                     code_reference, origin::text AS origin FROM source_documents ORDER BY updated_at DESC""")).mappings()
    return [dict(r) for r in rows]


@router.patch("/sources/{sid}", tags=["Fuentes institucionales"])
def update_source(sid: str, body: SourcePatch, request: Request, user: CurrentUser = Depends(require("sources.manage")), db: Connection = Depends(get_db)):
    before = db.execute(text("SELECT id, institution, acronym, info_type, updated_at, reference, reference_url, availability::text AS availability, usage_conditions, notes FROM institutional_sources WHERE id = :id"), {"id": sid}).mappings().first()
    if not before:
        raise HTTPException(404, "Fuente no encontrada.")
    patch = body.model_dump(exclude_unset=True)
    if patch:
        sets = ", ".join(f"{k} = CAST(:{k} AS source_availability)" if k == "availability" else f"{k} = :{k}" for k in patch)
        db.execute(text(f"UPDATE institutional_sources SET {sets} WHERE id = :id"), patch | {"id": sid})
        audit(db, user, "actualizar", "fuente", sid, f"Fuente {before['acronym']} actualizada.", diff(dict(before), patch, list(patch)), request)
    return db.execute(text("SELECT id, institution, acronym, info_type, updated_at, reference, reference_url, availability::text AS availability, usage_conditions, notes FROM institutional_sources WHERE id = :id"), {"id": sid}).mappings().first()


# ───────────────────────── Evidencias ─────────────────────────
ALLOWED_MIME = {
    "application/pdf": b"%PDF",
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG",
    "image/webp": b"RIFF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK",
    "application/msword": b"\xd0\xcf\x11\xe0",
    "text/plain": b"",
}
ENTITY_TABLE = {"registro_minero": "mining_records", "observacion": "satellite_observations", "denuncia": "citizen_reports", "alerta": "alerts"}


@router.post("/evidences", status_code=201, tags=["Evidencias"])
async def upload_evidence(
    request: Request,
    file: UploadFile = File(...),
    entity_type: Literal["registro_minero", "observacion", "denuncia", "alerta"] = Form(...),
    entity_id: str = Form(...),
    title: str = Form(..., max_length=300),
    doc_type: Literal["resolucion", "contrato", "informe_tecnico", "acta", "fotografia", "imagen_satelital", "otro"] = Form(...),
    user: CurrentUser = Depends(require("evidence.upload")),
    db: Connection = Depends(get_db),
):
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"El archivo supera {get_settings().max_upload_mb} MB.")
    mime = file.content_type or ""
    signature = ALLOWED_MIME.get(mime)
    if signature is None or (signature and not data.startswith(signature)):
        raise HTTPException(415, "Tipo de archivo no permitido o contenido no coincide con la extensión.")
    if not db.execute(text(f"SELECT 1 FROM {ENTITY_TABLE[entity_type]} WHERE id = :id"), {"id": entity_id}).first():
        raise HTTPException(404, "No existe el elemento al que adjuntar la evidencia.")
    ext = (file.filename or "bin").rsplit(".", 1)[-1]
    key, digest = save_bytes(data, ext)
    eid = f"EVD-{secrets.token_hex(8)}"
    db.execute(
        text("""INSERT INTO evidences (id, entity_type, entity_id, title, doc_type, file_name, mime_type, size_bytes, sha256, storage_key, uploaded_by)
                VALUES (:id, :et, :ei, :title, :dt, :fn, :mime, :size, :sha, :key, :by)"""),
        {"id": eid, "et": entity_type, "ei": entity_id, "title": title, "dt": doc_type, "fn": (file.filename or "archivo")[:200], "mime": mime, "size": len(data), "sha": digest, "key": key, "by": user.name},
    )
    audit(db, user, "adjuntar", entity_type, entity_id, f"Evidencia adjuntada: {title} ({file.filename}). SHA-256 {digest[:16]}…", request=request)
    return db.execute(text("SELECT id, entity_type, entity_id, title, doc_type, file_name, mime_type, size_bytes, sha256, uploaded_at, uploaded_by, '/api/v1/evidences/' || id || '/download' AS url FROM evidences WHERE id = :id"), {"id": eid}).mappings().first()


@router.get("/evidences/{eid}/download", tags=["Evidencias"])
def download_evidence(eid: str, user: CurrentUser = Depends(current_user), db: Connection = Depends(get_db)):
    row = db.execute(text("SELECT * FROM evidences WHERE id = :id AND removed_at IS NULL"), {"id": eid}).mappings().first()
    if not row:
        raise HTTPException(404, "Evidencia no encontrada.")
    needed = {"registro_minero": "records.view", "observacion": "satellite.view", "denuncia": "reports.view", "alerta": "alerts.view"}[row["entity_type"]]
    if not can(user.role, needed):
        raise HTTPException(403, "Sin permiso.")
    return FileResponse(resolve(row["storage_key"]), media_type=row["mime_type"], filename=row["file_name"])


@router.delete("/evidences/{eid}", status_code=204, tags=["Evidencias"])
def remove_evidence(eid: str, request: Request, user: CurrentUser = Depends(require("evidence.upload")), db: Connection = Depends(get_db)):
    row = db.execute(text("UPDATE evidences SET removed_at = now() WHERE id = :id AND removed_at IS NULL RETURNING entity_type, entity_id, title"), {"id": eid}).mappings().first()
    if not row:
        raise HTTPException(404, "Evidencia no encontrada.")
    audit(db, user, "eliminar", row["entity_type"], row["entity_id"], f"Evidencia retirada (se conserva el archivo): {row['title']}.", request=request)


# ───────────────────────── Usuarios ─────────────────────────
USER_COLS = "id, name, email, role::text AS role, institution, active, last_login_at, created_at"


@router.get("/users", tags=["Usuarios"])
def list_users(_: CurrentUser = Depends(require("admin.users")), db: Connection = Depends(get_db)):
    return [dict(r) for r in db.execute(text(f"SELECT {USER_COLS} FROM users ORDER BY name")).mappings()]


@router.post("/users", status_code=201, tags=["Usuarios"])
def create_user(body: UserCreate, request: Request, user: CurrentUser = Depends(require("admin.users")), db: Connection = Depends(get_db)):
    try:
        row = db.execute(
            text(f"""INSERT INTO users (name, email, role, institution, active, password_hash)
                     VALUES (:name, lower(:email), CAST(:role AS user_role), :institution, :active, :ph) RETURNING {USER_COLS}"""),
            body.model_dump(exclude={"password"}) | {"ph": hash_password(body.password)},
        ).mappings().first()
    except IntegrityError as exc:
        raise HTTPException(409, "Ya existe un usuario con ese correo.") from exc
    audit(db, user, "crear", "usuario", row["id"], f"Usuario {row['email']} creado con rol {row['role']}.", request=request)
    return row


@router.patch("/users/{uid}", tags=["Usuarios"])
def update_user(uid: str, body: UserPatch, request: Request, user: CurrentUser = Depends(require("admin.users")), db: Connection = Depends(get_db)):
    before = db.execute(text(f"SELECT {USER_COLS} FROM users WHERE id = :id"), {"id": uid}).mappings().first()
    if not before:
        raise HTTPException(404, "Usuario no encontrado.")
    patch = body.model_dump(exclude_unset=True)
    if uid == user.id and (patch.get("active") is False or patch.get("role", "administrador") != "administrador"):
        raise HTTPException(422, "No puede desactivar ni quitarse el rol de administrador a sí mismo.")
    changes = diff(dict(before), {k: v for k, v in patch.items() if k != "password"}, [k for k in patch if k != "password"])
    sets, params = [], {"id": uid}
    for k, v in patch.items():
        if k == "password":
            sets.append("password_hash = :ph")
            params["ph"] = hash_password(v)
            changes.append({"field": "contraseña", "from": "•••", "to": "restablecida"})
        elif k == "role":
            sets.append("role = CAST(:role AS user_role)")
            params["role"] = v
        else:
            sets.append(f"{k} = :{k}")
            params[k] = v
    if sets:
        db.execute(text(f"UPDATE users SET {', '.join(sets)} WHERE id = :id"), params)
        audit(db, user, "actualizar", "usuario", uid, f"Usuario {before['email']} actualizado.", changes, request)
    return db.execute(text(f"SELECT {USER_COLS} FROM users WHERE id = :id"), {"id": uid}).mappings().first()


# ───────────────────────── Auditoría ─────────────────────────
@router.get("/audit", tags=["Auditoría"])
def list_audit(entity_type: str | None = None, entity_id: str | None = None, limit: int = Query(500, le=5000), user: CurrentUser = Depends(current_user), db: Connection = Depends(get_db)):
    if not entity_id and not can(user.role, "audit.view"):
        raise HTTPException(403, "Sin permiso para consultar la bitácora.")
    where, params = ["true"], {"l": limit}
    if entity_type:
        where.append("entity_type = :et")
        params["et"] = entity_type
    if entity_id:
        where.append("entity_id = :ei")
        params["ei"] = entity_id
    rows = db.execute(
        text(f"""SELECT 'AUD-' || id AS id, ts AS timestamp, user_id, user_name, user_role, action, entity_type, entity_id, summary, changes
                 FROM audit_log WHERE {' AND '.join(where)} ORDER BY ts DESC LIMIT :l"""),
        params,
    ).mappings()
    return [dict(r) for r in rows]


@router.post("/audit/client-events", status_code=204, tags=["Auditoría"])
def client_event(body: ClientEventIn, request: Request, user: CurrentUser = Depends(current_user), db: Connection = Depends(get_db)):
    audit(db, user, body.action, body.entity_type, body.entity_id, body.summary, request=request)
