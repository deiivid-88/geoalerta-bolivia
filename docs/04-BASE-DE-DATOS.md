# Fase 5 — Conexión con la base de datos central

## 1. Arquitectura

```
Navegador (React)  ──HTTPS/JSON──▶  API GeoAlerta (FastAPI)  ──SQL──▶  PostgreSQL + PostGIS
   VITE_DATA_MODE=api                 JWT · permisos · auditoría          esquema "geoalerta"
   sin credenciales de BD             validación · importación            + almacenamiento de evidencias
```

- El **frontend nunca contiene credenciales** de base de datos; solo conoce la URL de la API (`VITE_API_BASE_URL`).
- Las credenciales viven en `backend/.env`, que está excluido de Git.
- Todas las consultas son parametrizadas (SQLAlchemy Core + psycopg 3).

## 2. Lo que se encontró en este equipo

| Elemento | Estado |
|---|---|
| PostgreSQL 17 | Instalado como servicio `postgresql-x64-17`, en ejecución, puerto 5432 |
| PostGIS | **No instalado** |
| Base `geoalerta` | No creada |
| Credenciales | **No disponibles**: no se creó ni modificó ninguna base |

## 3. Qué necesitamos para activar la conexión

1. **Servidor de base de datos**: el PostgreSQL local o el servidor institucional (host, puerto, si requiere SSL o VPN).
2. **PostGIS instalado** en ese servidor. En Windows: *Stack Builder → Spatial Extensions → PostGIS 3.x for PostgreSQL 17*.
3. **Un rol de aplicación** con permisos limitados (no usar `postgres`). Lo crea un DBA:
   ```sql
   CREATE ROLE geoalerta_app LOGIN PASSWORD '…';
   CREATE DATABASE geoalerta OWNER geoalerta_app;
   \c geoalerta
   CREATE EXTENSION postgis; CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent;   -- como superusuario
   ```
4. **Si ya existe una base institucional** con datos mineros: su nombre, la lista de tablas y columnas (o un `pg_dump --schema-only`) y una muestra de filas. Con eso se escribe una migración que mapee sus tablas a este modelo **sin mover ni perder datos**, por ejemplo con vistas o un ETL de importación.

## 4. Pasos de activación

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env        # completar DATABASE_URL, JWT_SECRET y CONTACT_ENCRYPTION_KEY
.venv\Scripts\python -m scripts.migrate          # crea el esquema geoalerta
.venv\Scripts\python -m scripts.load_sources     # catálogo de fuentes (integración pendiente)
.venv\Scripts\python -m scripts.create_admin --email admin@institucion.gob.bo --name "Nombre Apellido"
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Comprobación: abrir `http://127.0.0.1:8000/api/v1/health`. Debe mostrar `"database": "ok"` y `"missing_config": []`.

En el frontend, crear `.env.local` en la raíz:

```
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
```

y ejecutar `npm run dev`. El proxy de Vite envía `/api` al backend en el puerto 8000.

## 5. Requisitos cubiertos

| Requisito | Implementación |
|---|---|
| Credenciales fuera del frontend | `backend/.env`; el navegador solo recibe un JWT de sesión |
| Variables de entorno | `pydantic-settings`; `/health` informa qué falta sin mostrar valores |
| Validación de datos | Pydantic (`extra="forbid"`) más restricciones `CHECK` en la BD |
| Control de duplicados | Código de derecho único, y nombre igual a menos de 500 m (`ST_DWithin`), en el alta y en la importación |
| Errores de conexión | 503 con un mensaje claro; `pool_pre_ping`; el frontend muestra el aviso sin perder el formulario |
| Paginación | `GET /mining-records?page=&page_size=&sort=&order=` (ordenamiento en SQL, máximo 500 por página) |
| Registro de modificaciones | `audit_log` de solo inserción, con cambios campo a campo, usuario, rol e IP |
| Importación CSV, Excel, GeoJSON y Shapefile | `POST /mining-records/import`. El Shapefile va en .zip y se exige WGS84; las clasificaciones sin respaldo se degradan a «sin determinar» |
| Integridad de coordenadas y geometrías | Rango de Bolivia, anillos cerrados, `ST_IsValid` y `ST_Multi` |
| Respaldos y recuperación | `scripts/backup.ps1` (pg_dump más evidencias) y `scripts/restore.ps1` |

## 6. Pruebas de integración

Con una base **de pruebas** vacía y con PostGIS:

```powershell
$env:TEST_DATABASE_URL="postgresql+psycopg://usuario:clave@127.0.0.1:5432/geoalerta_test"
.venv\Scripts\python -m pytest tests/test_integration.py -v
```

> **Atención:** esta prueba borra el esquema `geoalerta` de la base indicada. No la ejecute contra la base de producción.
