"""Registros mineros: consulta paginada, ficha, alta, edición, clasificación, eliminación lógica e importación."""
from __future__ import annotations

import json
import re
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import IntegrityError

from ..config import get_settings
from ..db import get_db
from ..deps import CurrentUser, audit, current_user, diff, require
from ..importers import TYPE_ALIASES, STATUS_ALIASES, VERIF_ALIASES, map_enum, parse_file, to_float, to_multipolygon
from ..permissions import can
from ..schemas import ClassificationIn, ClassifyIn, MiningRecordCreate, MiningRecordPatch
from ..validation import degrade_unsupported, inside_bolivia, validate_geometry

router = APIRouter(prefix="/mining-records", tags=["Registros mineros"])

SELECT = """
SELECT v.id, v.name, v.lat, v.lng, v.department, v.province, v.municipality, v.locality, v.mining_type, v.mineral,
       v.admin_status, coalesce(v.holder_name, 'No identificado') AS holder, v.mining_right_code, v.registered_at, v.updated_at, v.source,
       v.observations, v.origin::text AS origin, v.version, v.area_ha::float AS area_ha,
       ST_AsGeoJSON(v.area_geom, 6)::json AS geometry,
       json_build_object('status', v.admin_status, 'source_institution', coalesce(v.source_institution, ''),
         'source_document', coalesce(v.source_document, ''), 'consulted_at', v.consulted_at,
         'verification_state', coalesce(v.verification_state::text, 'no_verificado'),
         'determined_by', coalesce(v.determined_by, ''), 'determined_at', v.determined_at, 'notes', v.classification_notes) AS classification,
       coalesce((SELECT json_agg(json_build_object('id', e.id, 'entity_type', e.entity_type, 'entity_id', e.entity_id, 'title', e.title,
                 'doc_type', e.doc_type, 'file_name', e.file_name, 'mime_type', e.mime_type, 'size_bytes', e.size_bytes, 'sha256', e.sha256,
                 'uploaded_at', e.uploaded_at, 'uploaded_by', e.uploaded_by, 'url', '/api/v1/evidences/' || e.id || '/download') ORDER BY e.uploaded_at)
                 FROM evidences e WHERE e.entity_type = 'registro_minero' AND e.entity_id = v.id AND e.removed_at IS NULL), '[]'::json) AS evidences,
       coalesce((SELECT json_agg(cr.id) FROM citizen_reports cr WHERE cr.related_mining_record_id = v.id), '[]'::json) AS related_report_ids,
       coalesce((SELECT json_agg(l.observation_id) FROM observation_record_links l WHERE l.record_id = v.id), '[]'::json) AS related_satellite_ids
FROM v_mining_records v
"""

SORTABLE = {
    "id": "v.id", "name": "v.name", "department": "v.department", "municipality": "v.municipality", "miningType": "v.mining_type",
    "mining_type": "v.mining_type", "adminStatus": "v.admin_status", "admin_status": "v.admin_status", "updatedAt": "v.updated_at",
    "updated_at": "v.updated_at", "registeredAt": "v.registered_at", "registered_at": "v.registered_at",
    "miningRightCode": "v.mining_right_code", "mining_right_code": "v.mining_right_code",
}
COORD_RE = re.compile(r"^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$")


def _get(db: Connection, record_id: str) -> dict:
    row = db.execute(text(SELECT + " WHERE v.id = :id"), {"id": record_id}).mappings().first()
    if not row:
        raise HTTPException(404, f"No existe el registro {record_id}.")
    return dict(row)


def _holder_id(db: Connection, name: str | None) -> int | None:
    name = (name or "").strip()
    if not name:
        return None
    return db.execute(
        text("INSERT INTO holders (name) VALUES (:n) ON CONFLICT (name_norm) DO UPDATE SET name = holders.name RETURNING id"), {"n": name}
    ).scalar_one()


def _find_duplicate(db: Connection, name: str, lat: float, lng: float, code: str | None, ignore_id: str | None = None) -> str | None:
    """Mismo código de derecho minero, o mismo nombre a menos de 500 m."""
    return db.execute(
        text(
            """SELECT id FROM mining_records WHERE deleted_at IS NULL AND id IS DISTINCT FROM :ignore AND (
                 (:code IS NOT NULL AND upper(mining_right_code) = upper(:code))
                 OR (lower(unaccent(name)) = lower(unaccent(:name)) AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, 500)))
               LIMIT 1"""
        ),
        {"ignore": ignore_id, "code": code or None, "name": name, "lat": lat, "lng": lng},
    ).scalar()


def _insert_classification(db: Connection, record_id: str, c: ClassificationIn, user_name: str) -> None:
    db.execute(
        text(
            """INSERT INTO record_classifications (record_id, status, source_institution, source_document, consulted_at, verification_state, determined_by, notes)
               VALUES (:rid, :st, :si, :sd, :ca, CAST(:vs AS verification_state), :by, :notes)"""
        ),
        {"rid": record_id, "st": c.status, "si": c.source_institution, "sd": c.source_document, "ca": c.consulted_at, "vs": c.verification_state, "by": user_name, "notes": c.notes},
    )
    db.execute(text("UPDATE mining_records SET admin_status = :st WHERE id = :id"), {"st": c.status, "id": record_id})


@router.get("")
def query_records(
    q: str | None = None,
    department: str | None = None,
    province: str | None = None,
    municipality: str | None = None,
    mining_type: str | None = None,
    admin_status: str | None = None,
    verification_state: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort: str = "updatedAt",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    _: CurrentUser = Depends(require("records.view")),
    db: Connection = Depends(get_db),
):
    where, params = ["true"], {}
    for col, val in (("department", department), ("province", province), ("municipality", municipality), ("mining_type", mining_type), ("admin_status", admin_status)):
        if val:
            where.append(f"v.{col} = :{col}")
            params[col] = val
    if verification_state:
        where.append("v.verification_state::text = :vs")
        params["vs"] = verification_state
    if date_from:
        where.append("v.registered_at >= :df")
        params["df"] = date_from
    if date_to:
        where.append("v.registered_at <= :dt")
        params["dt"] = date_to
    if q:
        m = COORD_RE.match(q)
        if m:
            where.append("ST_DWithin(v.geom::geography, ST_SetSRID(ST_MakePoint(:qlng, :qlat), 4326)::geography, 10000)")
            params.update(qlat=float(m.group(1).replace(",", ".")), qlng=float(m.group(2).replace(",", ".")))
        else:
            where.append(
                "unaccent(lower(concat_ws(' ', v.id, v.name, v.mining_right_code, v.holder_name, v.municipality, v.locality, v.province))) LIKE unaccent(lower(:q))"
            )
            params["q"] = f"%{q.strip()}%"
    clause = " AND ".join(where)
    total = db.execute(text(f"SELECT count(*) FROM v_mining_records v WHERE {clause}"), params).scalar_one()
    order_col = SORTABLE.get(sort, "v.updated_at")
    rows = db.execute(
        text(f"{SELECT} WHERE {clause} ORDER BY {order_col} {order.upper()} NULLS LAST, v.id LIMIT :lim OFFSET :off"),
        params | {"lim": page_size, "off": (page - 1) * page_size},
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/{record_id}")
def get_record(record_id: str, _: CurrentUser = Depends(require("records.view")), db: Connection = Depends(get_db)):
    return _get(db, record_id)


@router.post("", status_code=201)
def create_record(body: MiningRecordCreate, request: Request, user: CurrentUser = Depends(require("records.create")), db: Connection = Depends(get_db)):
    if body.classification.status != "sin_determinar" and not can(user.role, "records.classify"):
        raise HTTPException(403, "Su rol solo puede crear registros «Sin determinar». La clasificación la asigna un revisor.")
    dup = _find_duplicate(db, body.name, body.lat, body.lng, body.mining_right_code)
    if dup:
        raise HTTPException(409, f"Posible duplicado de {dup}. Revise el registro existente.")
    try:
        rid = db.execute(
            text(
                """INSERT INTO mining_records (name, lat, lng, area_geom, department, province, municipality, locality, mining_type, mineral,
                     holder_id, mining_right_code, registered_at, source, observations, origin, created_by)
                   VALUES (:name, :lat, :lng, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)), :department, :province, :municipality, :locality,
                     :mining_type, :mineral, :holder_id, :code, :registered_at, :source, :observations, CAST(:origin AS data_origin), :uid)
                   RETURNING id"""
            ),
            {
                **body.model_dump(include={"name", "lat", "lng", "department", "province", "municipality", "locality", "mining_type", "mineral", "registered_at", "source", "observations", "origin"}),
                "geom": json.dumps(body.geometry) if body.geometry else None,
                "holder_id": _holder_id(db, body.holder),
                "code": body.mining_right_code,
                "uid": user.id,
            },
        ).scalar_one()
    except IntegrityError as exc:
        raise HTTPException(422, f"Datos rechazados por la base de datos: {exc.orig}") from exc
    _insert_classification(db, rid, body.classification, user.name)
    audit(db, user, "crear", "registro_minero", rid, f"Registro creado: {body.name} ({body.classification.status}).", request=request)
    return _get(db, rid)


@router.patch("/{record_id}")
def update_record(record_id: str, body: MiningRecordPatch, request: Request, user: CurrentUser = Depends(require("records.edit")), db: Connection = Depends(get_db)):
    before = _get(db, record_id)
    if before["version"] != body.expected_version:
        raise HTTPException(409, "Otro usuario modificó este registro mientras lo editaba. Recargue la ficha y vuelva a aplicar sus cambios.")
    patch = body.model_dump(exclude_unset=True, exclude={"expected_version", "related_report_ids", "related_satellite_ids", "origin"})
    merged = before | patch
    if not inside_bolivia(merged["lat"], merged["lng"]):
        raise HTTPException(422, "Coordenadas fuera de Bolivia.")
    dup = _find_duplicate(db, merged["name"], merged["lat"], merged["lng"], merged.get("mining_right_code"), ignore_id=record_id)
    if dup:
        raise HTTPException(409, f"El cambio genera un posible duplicado de {dup}.")
    changes = diff(before, patch, list(patch.keys()))
    if not changes:
        return before
    sets, params = [], {"id": record_id, "v": body.expected_version}
    for k, v in patch.items():
        if k == "geometry":
            sets.append("area_geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))")
            params["geom"] = json.dumps(v) if v else None
        elif k == "holder":
            sets.append("holder_id = :holder_id")
            params["holder_id"] = _holder_id(db, v)
        else:
            sets.append(f"{k} = :{k}")
            params[k] = v
    updated = db.execute(
        text(f"UPDATE mining_records SET {', '.join(sets)}, updated_at = current_date, version = version + 1 WHERE id = :id AND version = :v AND deleted_at IS NULL"), params
    ).rowcount
    if not updated:
        raise HTTPException(409, "El registro cambió durante la edición. Recargue la ficha.")
    audit(db, user, "actualizar", "registro_minero", record_id, f"Actualización de {len(changes)} campo(s).", changes, request)
    return _get(db, record_id)


@router.post("/{record_id}/classification")
def classify(record_id: str, body: ClassifyIn, request: Request, user: CurrentUser = Depends(require("records.classify")), db: Connection = Depends(get_db)):
    before = _get(db, record_id)
    if before["version"] != body.expected_version:
        raise HTTPException(409, "El registro fue modificado. Recargue la ficha.")
    _insert_classification(db, record_id, body, user.name)
    db.execute(text("UPDATE mining_records SET updated_at = current_date, version = version + 1 WHERE id = :id"), {"id": record_id})
    audit(
        db, user, "clasificar", "registro_minero", record_id,
        f"Clasificación respaldada en «{body.source_document or 'sin documento'}» ({body.source_institution or '—'}).",
        [{"field": "situacion_administrativa", "from": before["admin_status"], "to": body.status}], request,
    )
    return _get(db, record_id)


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: str, request: Request, reason: str = Query(min_length=10), user: CurrentUser = Depends(require("records.delete")), db: Connection = Depends(get_db)):
    rec = _get(db, record_id)
    db.execute(text("UPDATE mining_records SET deleted_at = now(), deleted_reason = :r WHERE id = :id"), {"r": reason, "id": record_id})
    audit(db, user, "eliminar", "registro_minero", record_id, f"Eliminado lógicamente «{rec['name']}». Motivo: {reason}", request=request)


@router.post("/import")
async def import_records(
    request: Request,
    file: UploadFile = File(...),
    format: Literal["csv", "xlsx", "geojson", "shapefile"] = Form(...),
    source_label: str = Form(..., max_length=500),
    user: CurrentUser = Depends(require("records.import")),
    db: Connection = Depends(get_db),
):
    data = await file.read(get_settings().max_upload_mb * 1024 * 1024 * 4 + 1)
    if len(data) > get_settings().max_upload_mb * 1024 * 1024 * 4:
        raise HTTPException(413, "Archivo demasiado grande para importación.")
    try:
        rows, warnings = parse_file(format, data)
    except Exception as exc:  # archivo ilegible
        raise HTTPException(422, f"No se pudo leer el archivo: {exc}") from exc

    result = {"created": 0, "skipped_duplicates": 0, "errors": [], "warnings": warnings}
    can_classify = can(user.role, "records.classify")
    for i, (row, geom) in enumerate(rows, start=2):
        lat, lng = to_float(row.get("latitud")), to_float(row.get("longitud"))
        name = str(row.get("nombre") or "").strip()
        errs = []
        if len(name) < 3:
            errs.append("nombre obligatorio")
        if lat is None or lng is None or not inside_bolivia(lat, lng):
            errs.append("coordenadas inválidas o fuera de Bolivia")
        if not row.get("departamento") or not row.get("municipio"):
            errs.append("departamento y municipio obligatorios")
        g = to_multipolygon(geom)
        if g and (gerr := validate_geometry(geom)):
            errs.append(gerr)
        if errs:
            result["errors"].append({"row": i, "message": "; ".join(errs)})
            continue
        code = str(row.get("codigo_derecho_minero") or "").strip() or None
        if _find_duplicate(db, name, lat, lng, code):
            result["skipped_duplicates"] += 1
            continue
        doc, inst = str(row.get("documento_respaldo") or ""), str(row.get("institucion_respaldo") or "")
        consulted = str(row.get("fecha_consulta") or "") or None
        status = degrade_unsupported(map_enum(row.get("situacion_administrativa"), STATUS_ALIASES, "sin_determinar"), doc, inst, consulted)
        if not can_classify:
            status = "sin_determinar"
        verif = map_enum(row.get("estado_verificacion"), VERIF_ALIASES, "no_verificado")
        if status == "ilegal_verificada" and verif == "no_verificado":
            status = "presuntamente_irregular"
        with db.begin_nested():
            try:
                rid = db.execute(
                    text(
                        """INSERT INTO mining_records (name, lat, lng, area_geom, department, province, municipality, locality, mining_type, mineral,
                             holder_id, mining_right_code, registered_at, source, observations, origin, created_by)
                           VALUES (:name, :lat, :lng, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)), :dep, :prov, :mun, :loc, :mt, :mineral,
                             :holder, :code, coalesce(CAST(:reg AS date), current_date), :src, :obs, 'importado', :uid) RETURNING id"""
                    ),
                    {
                        "name": name, "lat": lat, "lng": lng, "geom": json.dumps(g) if g else None, "dep": row.get("departamento"),
                        "prov": row.get("provincia") or "", "mun": row.get("municipio"), "loc": row.get("localidad") or "",
                        "mt": map_enum(row.get("tipo_mineria"), TYPE_ALIASES, "sin_clasificacion"), "mineral": row.get("mineral") or None,
                        "holder": _holder_id(db, str(row.get("titular") or "")), "code": code, "reg": str(row.get("fecha_registro") or "") or None,
                        "src": str(row.get("fuente") or source_label), "obs": str(row.get("observaciones") or ""), "uid": user.id,
                    },
                ).scalar_one()
                _insert_classification(
                    db, rid,
                    ClassificationIn.model_construct(status=status, source_institution=inst if status != "sin_determinar" else "", source_document=doc if status != "sin_determinar" else "",
                                                     consulted_at=consulted if status != "sin_determinar" else None, verification_state=verif if status != "sin_determinar" else "no_verificado", notes=None),
                    f"Importación {format.upper()} · {user.name}",
                )
                result["created"] += 1
            except Exception as exc:  # fila rechazada por restricciones de la BD
                result["errors"].append({"row": i, "message": str(getattr(exc, "orig", exc))[:300]})
    audit(db, user, "importar", "registro_minero", file.filename or "archivo",
          f"Importación {format.upper()}: {result['created']} creados, {result['skipped_duplicates']} duplicados omitidos, {len(result['errors'])} con errores.", request=request)
    return result
