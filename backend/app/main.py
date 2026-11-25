"""GeoAlerta API — FastAPI + PostgreSQL/PostGIS.

Ejecutar:  uvicorn app.main:app --host 127.0.0.1 --port 8000   (desde backend/)
Documentación interactiva: http://127.0.0.1:8000/api/docs
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, IntegrityError

from .config import get_settings
from .routers import admin, auth, records, reports, satellites

log = logging.getLogger("geoalerta")
PREFIX = "/api/v1"

app = FastAPI(
    title="GeoAlerta API",
    version="1.0.0",
    description="Información territorial para actuar a tiempo. API de registros mineros, denuncias, observaciones satelitales, alertas y auditoría.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(IntegrityError)
async def integrity_handler(_: Request, exc: IntegrityError):
    msg = str(exc.orig).split("\n")[0]
    status = 409 if "unique" in msg.lower() or "duplicate" in msg.lower() else 422
    return JSONResponse(status_code=status, content={"detail": f"La base de datos rechazó la operación: {msg}"})


@app.exception_handler(DBAPIError)
async def db_handler(_: Request, exc: DBAPIError):
    log.exception("Error de base de datos")
    if exc.connection_invalidated:
        return JSONResponse(status_code=503, content={"detail": "Se perdió la conexión con la base de datos. Intente nuevamente."})
    return JSONResponse(status_code=500, content={"detail": "Error interno al consultar la base de datos."})


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    # Mantiene el formato estándar (lista de errores por campo) sin devolver los valores enviados.
    return JSONResponse(status_code=422, content={"detail": [{"loc": e["loc"], "msg": e["msg"]} for e in exc.errors()]})


@app.get(f"{PREFIX}/health", tags=["Sistema"])
def health():
    """Estado del servicio y de la configuración. No expone secretos."""
    s = get_settings()
    missing = s.missing()
    info: dict = {"api": "ok", "missing_config": missing}
    if "DATABASE_URL" in missing:
        info["database"] = "no configurada"
        return info
    try:
        from .db import ping

        info["database"] = "ok"
        info.update(ping())
    except HTTPException as exc:
        info["database"] = exc.detail
    except Exception as exc:  # noqa: BLE001
        info["database"] = f"error: {type(exc).__name__}"
    return info


for r in (auth.router, records.router, reports.public_router, reports.router, satellites.router, admin.router):
    app.include_router(r, prefix=PREFIX)
