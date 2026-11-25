from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..config import get_settings
from ..db import get_db
from ..deps import CurrentUser, audit, current_user
from ..schemas import LoginIn
from ..security import DUMMY_HASH, create_token, decode_token, verify_password

router = APIRouter(prefix="/auth", tags=["Autenticación"])

USER_COLS = "id, name, email, role::text AS role, institution, active, last_login_at, created_at"


@router.post("/login")
def login(body: LoginIn, request: Request, db: Connection = Depends(get_db)):
    s = get_settings()
    row = db.execute(text(f"SELECT {USER_COLS}, password_hash, failed_logins, locked_until FROM users WHERE lower(email) = lower(:e)"), {"e": body.email}).mappings().first()
    now = datetime.now(timezone.utc)
    if row and row["locked_until"] and row["locked_until"] > now:
        raise HTTPException(429, "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.")
    ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if not row or not ok:
        if row:
            fails = row["failed_logins"] + 1
            locked = now + timedelta(minutes=s.lockout_minutes) if fails >= s.max_failed_logins else None
            db.execute(text("UPDATE users SET failed_logins = :f, locked_until = :l WHERE id = :id"), {"f": 0 if locked else fails, "l": locked, "id": row["id"]})
        raise HTTPException(401, "Credenciales incorrectas.")
    if not row["active"]:
        raise HTTPException(403, "La cuenta está desactivada. Contacte al administrador.")
    db.execute(text("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = :id"), {"id": row["id"]})
    token, exp = create_token(row["id"], row["role"])
    user = {k: row[k] for k in ("id", "name", "email", "role", "institution", "active", "created_at")} | {"last_login_at": now}
    audit(db, CurrentUser(row["id"], row["name"], row["email"], row["role"], row["institution"], ""), "iniciar_sesion", "sesion", row["id"], "Inicio de sesión.", request=request)
    return {"access_token": token, "token_type": "bearer", "expires_at": exp, "user": user}


@router.post("/logout", status_code=204)
def logout(request: Request, user: CurrentUser = Depends(current_user), db: Connection = Depends(get_db)):
    token = request.headers.get("authorization", "").split(" ", 1)[-1]
    exp = datetime.fromtimestamp(decode_token(token)["exp"], tz=timezone.utc)
    db.execute(text("INSERT INTO revoked_tokens (jti, expires_at) VALUES (:j, :e) ON CONFLICT DO NOTHING"), {"j": user.jti, "e": exp})
    db.execute(text("DELETE FROM revoked_tokens WHERE expires_at < now()"))


@router.get("/me")
def me(user: CurrentUser = Depends(current_user), db: Connection = Depends(get_db)):
    return db.execute(text(f"SELECT {USER_COLS} FROM users WHERE id = :id"), {"id": user.id}).mappings().first()
