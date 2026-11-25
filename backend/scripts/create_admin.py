"""Crea el primer usuario administrador (la contraseña se pide por consola, no se guarda en ningún archivo).

Uso (desde backend/):  .venv\\Scripts\\python -m scripts.create_admin --email admin@institucion.gob.bo --name "Nombre Apellido"
"""
from __future__ import annotations

import argparse
import getpass

from sqlalchemy import create_engine, text

from app.config import get_settings
from app.security import MIN_PASSWORD_LENGTH, hash_password


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--institution", default="")
    args = ap.parse_args()
    pw = getpass.getpass(f"Contraseña (mín. {MIN_PASSWORD_LENGTH} caracteres): ")
    if pw != getpass.getpass("Repita la contraseña: "):
        raise SystemExit("Las contraseñas no coinciden.")
    s = get_settings()
    engine = create_engine(s.database_url, connect_args={"options": f"-csearch_path={s.db_schema},public"})
    with engine.begin() as c:
        uid = c.execute(
            text("INSERT INTO users (name, email, role, institution, password_hash) VALUES (:n, lower(:e), 'administrador', :i, :p) RETURNING id"),
            {"n": args.name, "e": args.email, "i": args.institution, "p": hash_password(pw)},
        ).scalar_one()
        c.execute(
            text("INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, summary) VALUES ('SISTEMA','Consola','sistema','crear','usuario',:id,'Administrador inicial creado por consola.')"),
            {"id": uid},
        )
    print(f"✓ Administrador {uid} creado.")


if __name__ == "__main__":
    main()
