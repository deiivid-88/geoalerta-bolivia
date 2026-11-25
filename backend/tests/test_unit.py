"""Pruebas sin base de datos: reglas de negocio, seguridad, importadores y paridad de permisos con el frontend."""
import io
import json
import re
import zipfile
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.importers import STATUS_ALIASES, map_enum, parse_file, to_multipolygon
from app.permissions import ROLE_PERMISSIONS, can
from app.schemas import ClassificationIn, MiningRecordCreate, PublicReportIn, UserCreate
from app.validation import degrade_unsupported, inside_bolivia, validate_geometry

ROOT = Path(__file__).resolve().parents[2]


def test_permisos_identicos_al_frontend():
    ts = (ROOT / "src" / "domain" / "permissions.ts").read_text(encoding="utf-8")
    base = set(re.findall(r"'([a-z_]+\.[a-z_]+)'", ts.split("const BASE_READ")[1].split("];")[0]))
    for role in ROLE_PERMISSIONS:
        block = ts.split(f"  {role}: new Set<Permission>(")[1].split(")")[0]
        perms = set(re.findall(r"'([a-z_]+\.[a-z_]+)'", block)) | (base if "BASE_READ" in block else set())
        assert perms == set(ROLE_PERMISSIONS[role]), role


def test_roles():
    assert can("revisor_institucional", "records.classify")
    assert not can("analista_sig", "records.classify")
    assert not can("consulta_institucional", "records.edit")
    assert not can(None, "records.view")


def test_clasificacion_requiere_respaldo():
    ClassificationIn(status="sin_determinar")
    with pytest.raises(ValidationError):
        ClassificationIn(status="legal")
    with pytest.raises(ValidationError):
        ClassificationIn(status="ilegal_verificada", source_institution="AJAM", source_document="R-1", consulted_at="2026-01-01", verification_state="no_verificado")
    ok = ClassificationIn(status="ilegal_verificada", source_institution="AJAM", source_document="R-1", consulted_at="2026-01-01", verification_state="verificado_documental")
    assert ok.status == "ilegal_verificada"


def _record(**kw):
    base = dict(name="Operación X", lat=-15.5, lng=-67.9, department="La Paz", municipality="Guanay", mining_type="aurifera",
                registered_at="2026-01-01", source="test", classification={"status": "sin_determinar"})
    return MiningRecordCreate(**(base | kw))


def test_registro_coordenadas_y_geometria():
    _record()
    with pytest.raises(ValidationError):
        _record(lat=-34.6, lng=-58.4)
    with pytest.raises(ValidationError):
        _record(geometry={"type": "Polygon", "coordinates": [[[-68, -15], [-67.9, -15], [-67.9, -15.1]]]})
    with pytest.raises(ValidationError):
        _record(extra_field=1)  # extra="forbid": no se aceptan campos desconocidos


def test_validate_geometry():
    assert validate_geometry({"type": "Polygon", "coordinates": [[[-68, -15], [-67.9, -15], [-67.9, -15.1], [-68, -15]]]}) is None
    assert "fuera" in validate_geometry({"type": "Polygon", "coordinates": [[[-15, -68], [-15, -67.9], [-15.1, -67.9], [-15, -68]]]})
    assert inside_bolivia(-16.5, -68.15) and not inside_bolivia(0, 0)


def test_denuncia_publica():
    PublicReportIn(category="actividad_minera", department="La Paz", municipality="Tipuani", lat=-15.5, lng=-67.9, observed_when_preset="hoy",
                   observed_date="2026-11-25", description="Se observan dragas en el río.", confidentiality="anonimo")
    with pytest.raises(ValidationError):
        PublicReportIn(category="otro", department="La Paz", municipality="T", lat=-15.5, lng=-67.9, observed_when_preset="hoy",
                       observed_date="2026-11-25", description="x", confidentiality="anonimo")


def test_usuario_password_minimo():
    with pytest.raises(ValidationError):
        UserCreate(name="Ana", email="ana@x.bo", role="analista_sig", password="corta")


def test_importacion_no_clasifica_sin_respaldo():
    assert degrade_unsupported("ilegal_verificada", "", "", None) == "sin_determinar"
    assert degrade_unsupported("legal", "Contrato 1", "AJAM", "2026-01-01") == "legal"
    assert map_enum("Ilegal verificada", STATUS_ALIASES, "sin_determinar") == "ilegal_verificada"
    assert map_enum("algo raro", STATUS_ALIASES, "sin_determinar") == "sin_determinar"


def test_csv_y_geojson():
    rows, _ = parse_file("csv", "﻿nombre;latitud;longitud\nMina A;-15,5;-67,9\n".encode())
    assert rows[0][0]["nombre"] == "Mina A" and rows[0][0]["latitud"] == "-15,5"
    fc = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"Nombre": "B"}, "geometry": {"type": "Polygon", "coordinates": [[[-68, -15], [-67.8, -15], [-67.8, -15.2], [-68, -15.2], [-68, -15]]]}}]}
    rows, _ = parse_file("geojson", json.dumps(fc).encode())
    row, geom = rows[0]
    assert row["nombre"] == "B" and abs(row["latitud"] + 15.1) < 1e-9
    assert to_multipolygon(geom)["type"] == "MultiPolygon"


def test_xlsx():
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Nombre", "Latitud", "Longitud", "Situación administrativa"])
    ws.append(["Mina C", -16.1, -67.2, "En proceso"])
    buf = io.BytesIO()
    wb.save(buf)
    rows, _ = parse_file("xlsx", buf.getvalue())
    assert rows[0][0]["nombre"] == "Mina C" and rows[0][0]["situacion_administrativa"] == "En proceso"


def test_shapefile_zip():
    import shapefile

    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shapefile.POLYGON)
    w.field("nombre", "C")
    w.poly([[[-68, -15], [-68, -15.2], [-67.8, -15.2], [-67.8, -15], [-68, -15]]])
    w.record("Mina D")
    w.close()
    z = io.BytesIO()
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr("capa.shp", shp.getvalue())
        zf.writestr("capa.shx", shx.getvalue())
        zf.writestr("capa.dbf", dbf.getvalue())
        zf.writestr("capa.prj", 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]')
    rows, warnings = parse_file("shapefile", z.getvalue())
    assert rows[0][0]["nombre"] == "Mina D" and rows[0][1]["type"] == "Polygon" and not warnings
    with zipfile.ZipFile(z := io.BytesIO(), "w") as zf:
        zf.writestr("capa.shp", shp.getvalue())
        zf.writestr("capa.shx", shx.getvalue())
        zf.writestr("capa.dbf", dbf.getvalue())
        zf.writestr("capa.prj", 'PROJCS["WGS_1984_UTM_Zone_19S"]'.replace("WGS_1984", "UTM_19S_only"))
    with pytest.raises(ValueError, match="WGS84"):
        parse_file("shapefile", z.getvalue())


def test_seguridad(monkeypatch):
    from cryptography.fernet import Fernet

    from app import config, security

    monkeypatch.setenv("JWT_SECRET", "x" * 48)
    monkeypatch.setenv("CONTACT_ENCRYPTION_KEY", Fernet.generate_key().decode())
    config.get_settings.cache_clear()
    h = security.hash_password("una-contraseña-larga")
    assert security.verify_password("una-contraseña-larga", h) and not security.verify_password("otra", h)
    token, _ = security.create_token("USR-001", "administrador")
    assert security.decode_token(token)["sub"] == "USR-001"
    enc = security.encrypt_text("70000000")
    assert b"70000000" not in enc and security.decrypt_text(enc) == "70000000"
    config.get_settings.cache_clear()
