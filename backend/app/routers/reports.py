"""Denuncias ciudadanas: envío y seguimiento públicos; revisión interna con control de datos sensibles."""
from __future__ import annotations

import base64
import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..db import get_db
from ..deps import CurrentUser, audit, require
from ..permissions import can
from ..schemas import PublicReportIn, ReportLinksIn, ReportStatusIn
from ..security import decrypt_text, encrypt_text
from ..storage import save_bytes

public_router = APIRouter(prefix="/public/reports", tags=["Denuncias (público)"])
router = APIRouter(prefix="/reports", tags=["Denuncias"])

COLS = """r.id, r.tracking_code, r.category, r.observed_mining_type, r.department, r.municipality, r.community, r.location_description,
          r.lat, r.lng, r.observed_when_preset, r.observed_date, r.created_at, r.updated_at, r.description, r.confidentiality,
          r.contact_info_encrypted, r.status, r.public_note, r.assigned_institution, r.related_satellite_id, r.related_mining_record_id,
          r.related_source_record_id, r.origin::text AS origin,
          coalesce((SELECT json_agg(json_build_object('file_name', e.file_name, 'url', '/api/v1/evidences/' || e.id || '/download'))
                    FROM evidences e WHERE e.entity_type = 'denuncia' AND e.entity_id = r.id AND e.removed_at IS NULL), '[]'::json) AS photos"""

DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")
MAGIC = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png", b"RIFF": "image/webp"}


def _serialize(row: dict, user: CurrentUser) -> dict:
    out = dict(row)
    enc = out.pop("contact_info_encrypted", None)
    if out["confidentiality"] == "confidencial" and enc is not None:
        out["contact_info"] = decrypt_text(enc) if can(user.role, "reports.view_sensitive") else "••• (restringido)"
    return out


@public_router.post("", status_code=201)
def submit_report(body: PublicReportIn, request: Request, db: Connection = Depends(get_db)):
    year = datetime.now(timezone.utc).year
    # Código no secuencial (no permite enumerar denuncias de terceros) y único por restricción UNIQUE.
    for _ in range(5):
        code = f"GA-DEN-{year}-{secrets.randbelow(900000) + 100000:06d}"
        if not db.execute(text("SELECT 1 FROM citizen_reports WHERE tracking_code = :c"), {"c": code}).first():
            break
    rid = f"DEN-{secrets.token_hex(6)}"
    db.execute(
        text(
            """INSERT INTO citizen_reports (id, tracking_code, category, observed_mining_type, department, municipality, community, location_description,
                 lat, lng, observed_when_preset, observed_date, description, confidentiality, contact_info_encrypted, public_note)
               VALUES (:id, :code, :category, :omt, :department, :municipality, :community, :ld, :lat, :lng, :owp, :od, :description, :conf, :contact,
                 'Su denuncia fue recibida y está en fila para revisión inicial.')"""
        ),
        {
            "id": rid, "code": code, "category": body.category, "omt": body.observed_mining_type, "department": body.department,
            "municipality": body.municipality, "community": body.community, "ld": body.location_description, "lat": body.lat, "lng": body.lng,
            "owp": body.observed_when_preset, "od": body.observed_date, "description": body.description, "conf": body.confidentiality,
            "contact": encrypt_text(body.contact_info) if body.confidentiality == "confidencial" else None,
        },
    )
    for i, photo in enumerate(body.photos):
        m = DATA_URL_RE.match(photo.data_url or "")
        if not m:
            continue
        raw = base64.b64decode(m.group(2))
        if not any(raw.startswith(sig) for sig in MAGIC) or len(raw) > 3 * 1024 * 1024:
            raise HTTPException(422, "Fotografía inválida o demasiado grande.")
        key, digest = save_bytes(raw, "jpg" if m.group(1) == "image/jpeg" else m.group(1).split("/")[1])
        db.execute(
            text("""INSERT INTO evidences (id, entity_type, entity_id, title, doc_type, file_name, mime_type, size_bytes, sha256, storage_key, uploaded_by)
                    VALUES (:id, 'denuncia', :eid, :title, 'fotografia', :fn, :mime, :size, :sha, :key, 'Ciudadanía')"""),
            {"id": f"EVD-{secrets.token_hex(8)}", "eid": rid, "title": f"Fotografía {i + 1}", "fn": photo.file_name[:200], "mime": m.group(1), "size": len(raw), "sha": digest, "key": key},
        )
    audit(db, None, "crear", "denuncia", code, f"Denuncia ciudadana recibida en {body.department} ({body.confidentiality}).", request=request)
    return {"tracking_code": code}


@public_router.get("/{code}")
def track(code: str, db: Connection = Depends(get_db)):
    """Vista pública: solo estado y nota pública. Nunca ubicación exacta ni datos de contacto."""
    row = db.execute(
        text("""SELECT tracking_code, category, department, municipality, created_at, updated_at, status, public_note, assigned_institution
                FROM citizen_reports WHERE tracking_code = upper(:c)"""),
        {"c": code.strip()},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "No existe una denuncia con ese código.")
    return row


@router.get("")
def list_reports(page_size: int = Query(1000, ge=1, le=5000), user: CurrentUser = Depends(require("reports.view")), db: Connection = Depends(get_db)):
    rows = db.execute(text(f"SELECT {COLS} FROM citizen_reports r ORDER BY r.created_at DESC LIMIT :l"), {"l": page_size}).mappings().all()
    return [_serialize(dict(r), user) for r in rows]


def _one(db: Connection, rid: str, user: CurrentUser) -> dict:
    row = db.execute(text(f"SELECT {COLS} FROM citizen_reports r WHERE r.id = :id"), {"id": rid}).mappings().first()
    if not row:
        raise HTTPException(404, "Denuncia no encontrada.")
    return _serialize(dict(row), user)


@router.patch("/{rid}/status")
def update_status(rid: str, body: ReportStatusIn, request: Request, user: CurrentUser = Depends(require("reports.review")), db: Connection = Depends(get_db)):
    before = _one(db, rid, user)
    if body.status == "derivado_institucion" and not body.assigned_institution:
        raise HTTPException(422, "Seleccione la institución a la que se deriva.")
    db.execute(
        text("UPDATE citizen_reports SET status = :s, public_note = :n, assigned_institution = :i, updated_at = now() WHERE id = :id"),
        {"s": body.status, "n": body.public_note, "i": body.assigned_institution or None, "id": rid},
    )
    audit(db, user, "derivar" if body.status == "derivado_institucion" else "cambiar_estado", "denuncia", before["tracking_code"], body.internal_note,
          [{"field": "estado", "from": before["status"], "to": body.status}], request)
    return _one(db, rid, user)


@router.patch("/{rid}/links")
def update_links(rid: str, body: ReportLinksIn, request: Request, user: CurrentUser = Depends(require("reports.review")), db: Connection = Depends(get_db)):
    before = _one(db, rid, user)
    fields = body.model_dump(exclude_unset=True)
    for k, v in fields.items():
        db.execute(text(f"UPDATE citizen_reports SET {k} = :v, updated_at = now() WHERE id = :id"), {"v": v, "id": rid})
    audit(db, user, "vincular", "denuncia", before["tracking_code"], "Vinculación de denuncia actualizada.",
          [{"field": k, "from": str(before.get(k) or "—"), "to": str(v or "—")} for k, v in fields.items()], request)
    return _one(db, rid, user)

