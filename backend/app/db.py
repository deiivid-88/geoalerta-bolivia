"""Conexión a PostgreSQL/PostGIS con SQLAlchemy Core (psycopg 3). Consultas parametrizadas siempre."""
from __future__ import annotations

from collections.abc import Iterator

from fastapi import HTTPException
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import OperationalError

from .config import get_settings

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        s = get_settings()
        if not s.database_url or "CAMBIAR" in s.database_url:
            raise HTTPException(503, "Base de datos no configurada: defina DATABASE_URL en backend/.env.")
        _engine = create_engine(s.database_url, pool_size=s.db_pool_size, max_overflow=5, pool_pre_ping=True, pool_recycle=1800, future=True)

        @event.listens_for(_engine, "connect")
        def _set_search_path(dbapi_conn, _record):  # noqa: ANN001
            with dbapi_conn.cursor() as cur:
                cur.execute(f'SET search_path TO "{s.db_schema}", public')
            dbapi_conn.commit()

    return _engine


def get_db() -> Iterator[Connection]:
    """Dependencia FastAPI: una transacción por petición (commit al terminar, rollback ante error)."""
    try:
        conn = get_engine().connect()
    except OperationalError as exc:
        raise HTTPException(503, "No se pudo conectar con la base de datos. Verifique que el servicio PostgreSQL esté activo y las credenciales.") from exc
    trans = conn.begin()
    try:
        yield conn
        trans.commit()
    except Exception:
        trans.rollback()
        raise
    finally:
        conn.close()


def ping() -> dict:
    with get_engine().connect() as c:
        version = c.execute(text("SELECT postgis_full_version()")).scalar_one()
        migrations = [r[0] for r in c.execute(text("SELECT version FROM schema_migrations ORDER BY version"))]
    return {"postgis": version.split(" ")[0] if version else None, "migrations": migrations}
