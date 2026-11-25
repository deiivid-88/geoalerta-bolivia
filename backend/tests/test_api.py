"""Pruebas HTTP sin base de datos: autenticación obligatoria, validación y salud del servicio."""
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.chdir(__file__.rsplit("tests", 1)[0] + "tests")  # evita leer un backend/.env real
    config.get_settings.cache_clear()
    yield TestClient(app)
    config.get_settings.cache_clear()


def test_health_informa_configuracion_faltante(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["database"] == "no configurada"
    assert {"DATABASE_URL", "JWT_SECRET", "CONTACT_ENCRYPTION_KEY"} <= set(body["missing_config"])


def test_sin_bd_responde_503_y_no_500(client):
    r = client.get("/api/v1/mining-records", headers={"Authorization": "Bearer x"})
    assert r.status_code == 503
    assert "DATABASE_URL" in r.json()["detail"]


def test_entrada_invalida_nunca_provoca_500(client):
    # Sin BD, FastAPI resuelve primero la conexión (503); con BD, la validación devuelve 422. Nunca 500.
    r = client.post("/api/v1/public/reports", json={"category": "x"})
    assert r.status_code in (422, 503)
    r = client.post("/api/v1/auth/login", content=b"no-json", headers={"Content-Type": "application/json"})
    assert r.status_code in (422, 503)


def test_cabeceras_de_seguridad(client):
    r = client.get("/api/v1/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["cache-control"] == "no-store"


def test_openapi_publica_todos_los_modulos(client):
    paths = client.get("/api/openapi.json").json()["paths"]
    for p in ["/api/v1/mining-records", "/api/v1/reports", "/api/v1/satellite-observations", "/api/v1/alerts", "/api/v1/sources", "/api/v1/users", "/api/v1/audit", "/api/v1/evidences"]:
        assert p in paths
