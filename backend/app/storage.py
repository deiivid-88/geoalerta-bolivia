"""Almacenamiento de evidencias en disco (fuera del webroot). Nombres aleatorios; nunca se usa el nombre original."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from pathlib import Path

from .config import get_settings


def _root() -> Path:
    root = Path(get_settings().storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_bytes(data: bytes, ext: str) -> tuple[str, str]:
    """Guarda el contenido y devuelve (clave_relativa, sha256)."""
    digest = hashlib.sha256(data).hexdigest()
    sub = datetime.now(timezone.utc).strftime("%Y/%m")
    safe_ext = "".join(c for c in ext.lower() if c.isalnum())[:8] or "bin"
    key = f"{sub}/{secrets.token_hex(16)}.{safe_ext}"
    path = _root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key, digest


def resolve(key: str) -> Path:
    path = (_root() / key).resolve()
    if _root() not in path.parents:  # evita path traversal
        raise ValueError("Ruta de almacenamiento inválida.")
    return path
