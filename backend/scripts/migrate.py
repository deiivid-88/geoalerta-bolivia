"""Aplica las migraciones SQL pendientes de backend/db/migrations en orden.

Uso (desde backend/):  .venv\\Scripts\\python -m scripts.migrate
Requiere DATABASE_URL de un rol con permiso para crear extensiones (la primera vez) y objetos en el esquema.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, text

from app.config import get_settings

MIGRATIONS = Path(__file__).resolve().parent.parent / "db" / "migrations"


def main() -> None:
    s = get_settings()
    if "DATABASE_URL" in s.missing():
        raise SystemExit("Defina DATABASE_URL en backend/.env")
    engine = create_engine(s.database_url)
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT to_regclass(:t)"), {"t": f"{s.db_schema}.schema_migrations"}).scalar()
        applied = set()
        if exists:
            applied = {r[0] for r in conn.execute(text(f'SELECT version FROM "{s.db_schema}".schema_migrations'))}
    for f in sorted(MIGRATIONS.glob("*.sql")):
        version = f.stem
        if version in applied:
            print(f"= {version} (ya aplicada)")
            continue
        print(f"→ aplicando {version}…")
        raw = engine.raw_connection()
        try:
            with raw.cursor() as cur:
                cur.execute(f.read_text(encoding="utf-8"))
            raw.commit()
        except Exception:
            raw.rollback()
            raise
        finally:
            raw.close()
        print(f"✓ {version}")


if __name__ == "__main__":
    main()
