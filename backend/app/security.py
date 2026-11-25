"""Contraseñas (bcrypt), tokens de sesión (JWT HS256) y cifrado de datos sensibles (Fernet)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

MIN_PASSWORD_LENGTH = 12


def hash_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode())
    except ValueError:
        return False


# Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe.
DUMMY_HASH = bcrypt.hashpw(b"geoalerta-dummy-password", bcrypt.gensalt(rounds=12)).decode()


def create_token(user_id: str, role: str) -> tuple[str, datetime]:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(hours=s.jwt_expire_hours)
    payload = {"sub": user_id, "role": role, "exp": exp, "iat": datetime.now(timezone.utc), "jti": secrets.token_urlsafe(16)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256"), exp


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub", "jti"]})


def _fernet() -> Fernet:
    return Fernet(get_settings().contact_encryption_key.encode())


def encrypt_text(value: str | None) -> bytes | None:
    if not value:
        return None
    return _fernet().encrypt(value.encode("utf-8"))


def decrypt_text(value: bytes | memoryview | None) -> str | None:
    if value is None:
        return None
    try:
        return _fernet().decrypt(bytes(value)).decode("utf-8")
    except InvalidToken:
        return "[no se pudo descifrar: verifique CONTACT_ENCRYPTION_KEY]"
