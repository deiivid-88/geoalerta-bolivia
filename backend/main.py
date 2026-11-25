import os
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg
from psycopg.rows import dict_row
import jwt
from passlib.context import CryptContext

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/geoalerta")
JWT_SECRET = os.getenv("JWT_SECRET", "cambia-este-secreto-en-produccion")
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
app = FastAPI(title="GeoAlerta API", version="0.1.0")

# Permitir peticiones desde el frontend en Vercel o localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción restringir al dominio de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn

def get_current_user(authorization: Optional[str] = Header(None), db=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada.")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user = db.execute("SELECT id, name, email, role, institution, active, created_at FROM users WHERE id = %s", (payload["sub"],)).fetchone()
        if not user or not user["active"]:
            raise HTTPException(status_code=401, detail="Usuario inactivo.")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido.")

# ─── 1. AUTENTICACIÓN ────────────────────────────────────────────────────────
class LoginReq(BaseModel):
    email: str
    password: str

@app.post("/api/v1/auth/login")
def login(req: LoginReq, db=Depends(get_db)):
    user = db.execute("SELECT * FROM users WHERE email = %s", (req.email,)).fetchone()
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
    expires = datetime.now(timezone.utc) + timedelta(hours=12)
    token = jwt.encode({"sub": user["id"], "role": user["role"], "exp": expires}, JWT_SECRET, algorithm=ALGORITHM)
    db.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (user["id"],))
    db.commit()
    user.pop("password_hash")
    return {"access_token": token, "expires_at": expires.isoformat(), "user": user}

@app.get("/api/v1/auth/me")
def me(user=Depends(get_current_user)):
    return user

@app.post("/api/v1/auth/logout", status_code=204)
def logout():
    return None

# ─── 2. DENUNCIAS PÚBLICAS Y SEGUIMIENTO ─────────────────────────────────────
@app.post("/api/v1/public/reports")
def submit_public_report(body: dict[str, Any], db=Depends(get_db)):
    rep_id = f"REP-{uuid.uuid4().hex[:8].upper()}"
    tracking_code = f"GA-DEN-2026-{uuid.uuid4().int % 1000000:06d}"
    db.execute("""
        INSERT INTO citizen_reports (
            id, tracking_code, category, observed_mining_type, department, municipality,
            community, location_description, lat, lng, observed_when_preset, observed_date,
            description, photos, confidentiality, contact_info, origin
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,'manual')
    """, (
        rep_id, tracking_code, body["category"], body.get("observed_mining_type"),
        body["department"], body["municipality"], body["community"], body["location_description"],
        body["lat"], body["lng"], body["observed_when_preset"], body["observed_date"],
        body["description"], json.dumps(body.get("photos", [])),
        body["confidentiality"], body.get("contact_info")
    ))
    db.commit()
    return {"tracking_code": tracking_code}

@app.get("/api/v1/public/reports/{code}")
def track_report(code: str, db=Depends(get_db)):
    row = db.execute("""
        SELECT tracking_code, category, department, municipality, created_at, updated_at, status, public_note, assigned_institution
        FROM citizen_reports WHERE tracking_code = %s
    """, (code.strip(),)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Código de seguimiento no encontrado.")
    return row

@app.get("/api/v1/reports")
def list_reports(user=Depends(get_current_user), db=Depends(get_db)):
    return db.execute("SELECT * FROM citizen_reports ORDER BY created_at DESC").fetchall()

# ─── 3. OBSERVACIONES SATELITALES (CONEXIÓN CON GOOGLE EARTH ENGINE) ─────────
@app.get("/api/v1/satellite-observations")
def list_satellites(user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.execute("SELECT *, ST_AsGeoJSON(geom)::json AS geometry FROM satellite_observations ORDER BY acquisition_date DESC").fetchall()
    for r in rows:
        r["evidences"] = []
        r["related_report_ids"] = []
        r["related_mining_record_ids"] = []
    return rows

@app.post("/api/v1/satellite-observations")
def create_satellite_obs(body: dict[str, Any], user=Depends(get_current_user), db=Depends(get_db)):
    obs_id = f"GA-SAT-2026-{uuid.uuid4().int % 1000000:06d}"
    geom_json = json.dumps(body["geometry"]) if body.get("geometry") else None
    db.execute("""
        INSERT INTO satellite_observations (
            id, sensor, origin, observation_type, acquisition_date, comparison_date,
            department, municipality, zone_name, lat, lng, geom, approx_area_ha,
            confidence, change_description, before_scene, created_by, data_origin
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            CASE WHEN %s IS NOT NULL THEN ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)) ELSE NULL END,
            %s, %s, %s, %s, %s, 'importado'
        )
    """, (
        obs_id, body["sensor"], body.get("origin", "automatizada"), body["observation_type"],
        body["acquisition_date"], body.get("comparison_date"), body["department"],
        body["municipality"], body["zone_name"], body["lat"], body["lng"],
        geom_json, geom_json, body["approx_area_ha"], body["confidence"],
        body["change_description"], body.get("before_scene", "river_meander"), user["name"]
    ))
    db.commit()
    return db.execute("SELECT * FROM satellite_observations WHERE id = %s", (obs_id,)).fetchone()

# ─── 4. REGISTROS MINEROS, ALERTAS, FUENTES Y AUDITORÍA ──────────────────────
@app.get("/api/v1/mining-records")
def list_mining_records(page: int = 1, page_size: int = 50, user=Depends(get_current_user), db=Depends(get_db)):
    offset = (page - 1) * page_size
    total = db.execute("SELECT COUNT(*) AS c FROM mining_records").fetchone()["c"]
    items = db.execute("""
        SELECT *, ST_AsGeoJSON(geom)::json AS geometry
        FROM mining_records ORDER BY updated_at DESC LIMIT %s OFFSET %s
    """, (page_size, offset)).fetchall()
    for it in items:
        it["evidences"] = []
        it["related_report_ids"] = []
        it["related_satellite_ids"] = []
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@app.get("/api/v1/alerts")
def list_alerts(user=Depends(get_current_user), db=Depends(get_db)):
    return db.execute("SELECT * FROM territorial_alerts ORDER BY created_at DESC").fetchall()

@app.get("/api/v1/sources")
def list_sources(user=Depends(get_current_user), db=Depends(get_db)):
    return db.execute("SELECT * FROM institutional_sources").fetchall()

@app.get("/api/v1/source-documents")
def list_source_documents(user=Depends(get_current_user), db=Depends(get_db)):
    return db.execute("SELECT * FROM source_documents").fetchall()

@app.get("/api/v1/users")
def list_users(user=Depends(get_current_user), db=Depends(get_db)):
    return db.execute("SELECT id, name, email, role, institution, active, last_login_at, created_at FROM users").fetchall()

@app.get("/api/v1/audit")
def list_audit(limit: int = 100, user=Depends(get_current_user), db=Depends(get_db)):
    return db.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT %s", (limit,)).fetchall()