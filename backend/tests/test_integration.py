"""Flujo completo contra una base PostGIS REAL de pruebas.

Se omite si no se define TEST_DATABASE_URL. Para ejecutarlo:
  1. Crear una base vacía con PostGIS:  createdb geoalerta_test  &&  psql -d geoalerta_test -c "CREATE EXTENSION postgis"
  2. set TEST_DATABASE_URL=postgresql+psycopg://usuario:clave@127.0.0.1:5432/geoalerta_test
  3. .venv\\Scripts\\python -m pytest tests/test_integration.py -v
¡La base indicada se BORRA (DROP SCHEMA geoalerta CASCADE) al inicio! No use la base de producción.
"""
import os
from pathlib import Path

import pytest

URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="TEST_DATABASE_URL no definida: se omiten pruebas de integración con PostGIS.")


@pytest.fixture(scope="module")
def client():
    from cryptography.fernet import Fernet
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine, text

    from app import config, db
    from app.security import hash_password

    os.environ.update(DATABASE_URL=URL, JWT_SECRET="t" * 48, CONTACT_ENCRYPTION_KEY=Fernet.generate_key().decode(), STORAGE_DIR=str(Path(__file__).parent / ".storage_test"))
    config.get_settings.cache_clear()
    db._engine = None
    eng = create_engine(URL)
    raw = eng.raw_connection()
    with raw.cursor() as cur:
        cur.execute("DROP SCHEMA IF EXISTS geoalerta CASCADE")
        cur.execute((Path(__file__).parents[1] / "db" / "migrations" / "001_init.sql").read_text(encoding="utf-8"))
    raw.commit()
    raw.close()
    with eng.begin() as c:
        for email, role in [("admin@t.bo", "administrador"), ("analista@t.bo", "analista_sig"), ("revisor@t.bo", "revisor_institucional"), ("consulta@t.bo", "consulta_institucional")]:
            c.execute(text("INSERT INTO geoalerta.users (name, email, role, password_hash) VALUES (:n, :e, CAST(:r AS geoalerta.user_role), :p)"), {"n": role, "e": email, "r": role, "p": hash_password("clave-de-prueba-123")})
    from app.main import app

    yield TestClient(app)
    config.get_settings.cache_clear()


def login(client, email):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "clave-de-prueba-123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


RECORD = {
    "name": "Operación integración", "lat": -15.5, "lng": -67.9, "department": "La Paz", "province": "Larecaja", "municipality": "Guanay",
    "mining_type": "aurifera", "registered_at": "2026-01-10", "source": "Prueba", "holder": "Operador Test", "mining_right_code": "TEST-0001",
    "geometry": {"type": "Polygon", "coordinates": [[[-67.92, -15.52], [-67.88, -15.52], [-67.88, -15.48], [-67.92, -15.48], [-67.92, -15.52]]]},
    "classification": {"status": "sin_determinar"},
}


def test_flujo_completo(client):
    assert client.get("/api/v1/health").json()["database"] == "ok"
    analista, revisor, consulta = login(client, "analista@t.bo"), login(client, "revisor@t.bo"), login(client, "consulta@t.bo")

    # Analista crea; no puede clasificar.
    r = client.post("/api/v1/mining-records", json=RECORD, headers=analista)
    assert r.status_code == 201, r.text
    rec = r.json()
    assert rec["id"].startswith("GA-MIN-") and rec["area_ha"] > 0 and rec["holder"] == "Operador Test"
    assert client.post("/api/v1/mining-records", json=RECORD, headers=analista).status_code == 409  # duplicado
    cls = {"status": "legal", "source_institution": "AJAM", "source_document": "Contrato 1", "consulted_at": "2026-11-01", "verification_state": "verificado_documental", "expected_version": rec["version"]}
    assert client.post(f"/api/v1/mining-records/{rec['id']}/classification", json=cls, headers=analista).status_code == 403

    # Revisor clasifica con respaldo; queda en historial.
    r = client.post(f"/api/v1/mining-records/{rec['id']}/classification", json=cls, headers=revisor)
    assert r.status_code == 200 and r.json()["admin_status"] == "legal" and r.json()["classification"]["source_document"] == "Contrato 1"
    hist = client.get("/api/v1/audit", params={"entity_id": rec["id"]}, headers=revisor).json()
    assert hist[0]["action"] == "clasificar"

    # Versión optimista.
    assert client.patch(f"/api/v1/mining-records/{rec['id']}", json={"expected_version": rec["version"], "observations": "x"}, headers=revisor).status_code == 409

    # Búsqueda por coordenadas, filtros y paginación.
    page = client.get("/api/v1/mining-records", params={"q": "-15.5, -67.9", "page_size": 10}, headers=consulta).json()
    assert page["total"] == 1 and page["items"][0]["id"] == rec["id"]
    assert client.patch(f"/api/v1/mining-records/{rec['id']}", json={"expected_version": 2, "name": "x y z"}, headers=consulta).status_code == 403

    # Denuncia pública confidencial: el seguimiento no expone el contacto; consulta no lo ve; revisor sí.
    rep = {"category": "actividad_minera", "department": "La Paz", "municipality": "Guanay", "lat": -15.49, "lng": -67.89, "observed_when_preset": "hoy",
           "observed_date": "2026-11-25", "description": "Dragas trabajando en el río.", "confidentiality": "confidencial", "contact_info": "70000000"}
    code = client.post("/api/v1/public/reports", json=rep).json()["tracking_code"]
    tracked = client.get(f"/api/v1/public/reports/{code.lower()}").json()
    assert tracked["status"] == "recibido" and "contact_info" not in tracked and "lat" not in tracked
    as_consulta = next(x for x in client.get("/api/v1/reports", headers=consulta).json() if x["tracking_code"] == code)
    assert as_consulta["contact_info"] != "70000000"
    as_revisor = next(x for x in client.get("/api/v1/reports", headers=revisor).json() if x["tracking_code"] == code)
    assert as_revisor["contact_info"] == "70000000"

    # La bitácora no se puede alterar.
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import DBAPIError

    with pytest.raises(DBAPIError):
        with create_engine(URL).begin() as c:
            c.execute(text("DELETE FROM geoalerta.audit_log"))

    # La BD rechaza una clasificación sin respaldo aunque se salte la API.
    with pytest.raises(DBAPIError):
        with create_engine(URL).begin() as c:
            c.execute(text("INSERT INTO geoalerta.record_classifications (record_id, status, determined_by) VALUES (:r, 'ilegal_verificada', 'x')"), {"r": rec["id"]})
