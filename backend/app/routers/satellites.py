"""Observaciones satelitales: historial, registro, revisión técnica, verificación documental y vínculos."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..db import get_db
from ..deps import CurrentUser, audit, require
from ..schemas import DocVerificationIn, ReviewIn, SatelliteCreate, SatLinksIn

router = APIRouter(prefix="/satellite-observations", tags=["Observaciones satelitales"])

SELECT = """
SELECT o.id, o.sensor, o.origin, o.observation_type, o.acquisition_date, o.comparison_date, o.department, o.municipality, o.zone_name,
       o.lat, o.lng, o.approx_area_ha::float AS approx_area_ha, o.confidence, o.review_state, o.change_description, o.before_scene,
       o.created_at, o.created_by, o.origin_data::text AS data_origin,
       coalesce((SELECT json_agg(l.record_id) FROM observation_record_links l WHERE l.observation_id = o.id), '[]'::json) AS related_mining_record_ids,
       coalesce((SELECT json_agg(cr.id) FROM citizen_reports cr WHERE cr.related_satellite_id = o.id), '[]'::json) AS related_report_ids,
       (SELECT json_build_object('result', d.result, 'document', d.document, 'institution', d.institution, 'verified_by', d.verified_by,
               'verified_at', d.verified_at, 'notes', d.notes)
          FROM documental_verifications d WHERE d.observation_id = o.id ORDER BY d.verified_at DESC LIMIT 1) AS documental_verification,
       coalesce((SELECT json_agg(json_build_object('id', e.id, 'entity_type', e.entity_type, 'entity_id', e.entity_id, 'title', e.title,
                 'doc_type', e.doc_type, 'file_name', e.file_name, 'mime_type', e.mime_type, 'size_bytes', e.size_bytes, 'sha256', e.sha256,
                 'uploaded_at', e.uploaded_at, 'uploaded_by', e.uploaded_by, 'url', '/api/v1/evidences/' || e.id || '/download'))
                 FROM evidences e WHERE e.entity_type = 'observacion' AND e.entity_id = o.id AND e.removed_at IS NULL), '[]'::json) AS evidences
FROM satellite_observations o
"""


def _get(db: Connection, oid: str) -> dict:
    row = db.execute(text(SELECT + " WHERE o.id = :id"), {"id": oid}).mappings().first()
    if not row:
        raise HTTPException(404, "Observación no encontrada.")
    return dict(row)


@router.get("")
def list_observations(page_size: int = Query(1000, ge=1, le=5000), _: CurrentUser = Depends(require("satellite.view")), db: Connection = Depends(get_db)):
    return [dict(r) for r in db.execute(text(SELECT + " ORDER BY o.acquisition_date DESC LIMIT :l"), {"l": page_size}).mappings()]


@router.post("", status_code=201)
def create_observation(body: SatelliteCreate, request: Request, user: CurrentUser = Depends(require("satellite.create")), db: Connection = Depends(get_db)):
    year = body.acquisition_date.year
    seq = db.execute(text("SELECT count(*) + 1 FROM satellite_observations WHERE id LIKE :p"), {"p": f"GA-SAT-{year}-M%"}).scalar_one()
    oid = f"GA-SAT-{year}-M{seq:04d}"
    db.execute(
        text(
            """INSERT INTO satellite_observations (id, sensor, origin, observation_type, acquisition_date, comparison_date, department, municipality,
                 zone_name, lat, lng, approx_area_ha, confidence, review_state, change_description, before_scene, created_by)
               VALUES (:id, :sensor, :origin, :observation_type, :acquisition_date, :comparison_date, :department, :municipality, :zone_name,
                 :lat, :lng, :approx_area_ha, :confidence, :review_state, :change_description, :before_scene, :by)"""
        ),
        body.model_dump(exclude={"related_report_ids", "related_mining_record_ids"}) | {"id": oid, "by": user.name},
    )
    for rid in body.related_mining_record_ids:
        db.execute(text("INSERT INTO observation_record_links (observation_id, record_id, linked_by) VALUES (:o, :r, :u) ON CONFLICT DO NOTHING"), {"o": oid, "r": rid, "u": user.name})
    audit(db, user, "crear", "observacion", oid, f"Observación registrada ({body.origin}).", request=request)
    return _get(db, oid)


@router.post("/{oid}/review")
def review(oid: str, body: ReviewIn, request: Request, user: CurrentUser = Depends(require("satellite.review")), db: Connection = Depends(get_db)):
    before = _get(db, oid)
    db.execute(text("UPDATE satellite_observations SET review_state = :s WHERE id = :id"), {"s": body.review_state, "id": oid})
    audit(db, user, "cambiar_estado", "observacion", oid, body.note, [{"field": "estado_revision", "from": before["review_state"], "to": body.review_state}], request)
    return _get(db, oid)


@router.post("/{oid}/documental-verification")
def verify(oid: str, body: DocVerificationIn, request: Request, user: CurrentUser = Depends(require("satellite.verify_documental")), db: Connection = Depends(get_db)):
    _get(db, oid)
    db.execute(
        text("INSERT INTO documental_verifications (observation_id, result, document, institution, verified_by, notes) VALUES (:o, :r, :d, :i, :u, :n)"),
        {"o": oid, "r": body.result, "d": body.document, "i": body.institution, "u": user.name, "n": body.notes},
    )
    audit(db, user, "actualizar", "observacion", oid, f"Verificación documental: {body.result} — {body.document} ({body.institution}).", request=request)
    return _get(db, oid)


@router.patch("/{oid}/links")
def links(oid: str, body: SatLinksIn, request: Request, user: CurrentUser = Depends(require("satellite.review")), db: Connection = Depends(get_db)):
    _get(db, oid)
    if body.related_mining_record_ids is not None:
        db.execute(text("DELETE FROM observation_record_links WHERE observation_id = :o"), {"o": oid})
        for rid in body.related_mining_record_ids:
            db.execute(text("INSERT INTO observation_record_links (observation_id, record_id, linked_by) VALUES (:o, :r, :u)"), {"o": oid, "r": rid, "u": user.name})
    after = _get(db, oid)
    audit(db, user, "vincular", "observacion", oid, f"Vínculos: {len(after['related_mining_record_ids'])} registro(s).", request=request)
    return after
