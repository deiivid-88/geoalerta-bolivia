-- ════════════════════════════════════════════════════════════════════
-- GeoAlerta · Esquema inicial  (PostgreSQL ≥ 14 + PostGIS ≥ 3.1)
-- Sistema de referencia: EPSG:4326 (WGS84). Superficies calculadas sobre geography.
-- Ejecutar con un rol propietario del esquema:  psql -d geoalerta -f 001_init.sql
-- ════════════════════════════════════════════════════════════════════
BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- búsqueda por similitud de nombres
CREATE EXTENSION IF NOT EXISTS unaccent;     -- búsqueda sin tildes

CREATE SCHEMA IF NOT EXISTS geoalerta;
SET search_path = geoalerta, public;

CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

-- ───────────────────────── Catálogos ─────────────────────────
CREATE TABLE admin_statuses (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  description text NOT NULL,
  requires_document boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL
);
INSERT INTO admin_statuses VALUES
 ('legal','Legal / Autorizada','Existe documentación oficial que respalda su situación.',true,1),
 ('en_proceso','En proceso','Trámite administrativo pendiente o en evaluación.',true,2),
 ('presuntamente_irregular','Presuntamente irregular','Existen indicios o inconsistencias que requieren investigación.',true,3),
 ('ilegal_verificada','Ilegal verificada','Existe una determinación o registro oficial que confirma la irregularidad.',true,4),
 ('sin_determinar','Sin determinar','No existe información suficiente para establecer su situación.',false,5);

CREATE TABLE mining_types (
  code  text PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL
);
INSERT INTO mining_types VALUES
 ('aurifera','Minería aurífera',1),('aluvial','Minería aluvial',2),('subterranea','Minería subterránea',3),
 ('cielo_abierto','Minería a cielo abierto',4),('aridos','Extracción de áridos',5),
 ('otro','Otro tipo de actividad minera',6),('sin_clasificacion','Sin clasificación',7);

CREATE TYPE verification_state AS ENUM ('no_verificado','en_verificacion','verificado_documental','verificado_campo');
CREATE TYPE data_origin        AS ENUM ('demo','importado','manual','institucional');
CREATE TYPE user_role          AS ENUM ('administrador','analista_sig','revisor_institucional','consulta_institucional');

-- ───────────────────────── Usuarios ─────────────────────────
CREATE SEQUENCE users_seq;
CREATE TABLE users (
  id            text PRIMARY KEY DEFAULT 'USR-' || lpad(nextval('users_seq')::text, 3, '0'),
  name          text NOT NULL,
  email         text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role          user_role NOT NULL,
  institution   text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_users_email ON users (lower(email));

-- Tokens revocados (cierre de sesión antes de expirar).
CREATE TABLE revoked_tokens (jti text PRIMARY KEY, expires_at timestamptz NOT NULL);

-- ───────────────────────── Titulares / operadores ─────────────────────────
CREATE TABLE holders (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  name_norm   text GENERATED ALWAYS AS (lower(name)) STORED,
  holder_type text,          -- cooperativa, empresa privada, estatal, persona natural…
  tax_id      text,          -- NIT, cuando exista
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_norm)
);

-- ───────────────────────── Fuentes institucionales ─────────────────────────
CREATE TYPE source_availability AS ENUM ('integracion_pendiente','carga_manual','api_disponible','no_disponible');
CREATE TABLE institutional_sources (
  id               text PRIMARY KEY,
  institution      text NOT NULL,
  acronym          text NOT NULL,
  info_type        text NOT NULL,
  updated_at       date,
  reference        text NOT NULL,
  reference_url    text,
  availability     source_availability NOT NULL DEFAULT 'integracion_pendiente',
  usage_conditions text NOT NULL,
  notes            text NOT NULL DEFAULT ''
);

CREATE TABLE source_documents (
  id             text PRIMARY KEY,
  source_id      text NOT NULL REFERENCES institutional_sources(id),
  institution    text NOT NULL,
  record_type    text NOT NULL,
  title          text NOT NULL,
  department     text NOT NULL,
  municipality   text NOT NULL,
  lat            double precision NOT NULL,
  lng            double precision NOT NULL,
  geom           geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  updated_at     date NOT NULL,
  reference      text NOT NULL,
  summary        text NOT NULL DEFAULT '',
  code_reference text NOT NULL,
  origin         data_origin NOT NULL DEFAULT 'institucional'
);

-- ───────────────────────── Registros mineros ─────────────────────────
CREATE SEQUENCE mining_record_seq;
CREATE TABLE mining_records (
  id                text PRIMARY KEY DEFAULT 'GA-MIN-' || lpad(nextval('mining_record_seq')::text, 6, '0'),
  name              text NOT NULL CHECK (length(trim(name)) >= 3),
  lat               double precision NOT NULL CHECK (lat BETWEEN -23.0 AND -9.6),
  lng               double precision NOT NULL CHECK (lng BETWEEN -69.75 AND -57.35),
  geom              geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  area_geom         geometry(MultiPolygon,4326) CHECK (area_geom IS NULL OR ST_IsValid(area_geom)),
  area_ha           numeric(14,4),
  department        text NOT NULL,
  province          text NOT NULL DEFAULT '',
  municipality      text NOT NULL,
  locality          text NOT NULL DEFAULT '',
  mining_type       text NOT NULL REFERENCES mining_types(code),
  mineral           text,
  admin_status      text NOT NULL REFERENCES admin_statuses(code) DEFAULT 'sin_determinar',
  holder_id         bigint REFERENCES holders(id),
  mining_right_code text,
  registered_at     date NOT NULL DEFAULT current_date,
  updated_at        date NOT NULL DEFAULT current_date,
  source            text NOT NULL,
  observations      text NOT NULL DEFAULT '',
  origin            data_origin NOT NULL DEFAULT 'manual',
  version           int NOT NULL DEFAULT 1,
  created_by        text REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,           -- eliminación lógica: se conserva para auditoría
  deleted_reason    text
);
CREATE UNIQUE INDEX ux_mining_right_code ON mining_records (upper(mining_right_code)) WHERE mining_right_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_mr_geom       ON mining_records USING gist (geom);
CREATE INDEX ix_mr_area       ON mining_records USING gist (area_geom);
CREATE INDEX ix_mr_filters    ON mining_records (department, municipality, admin_status, mining_type) WHERE deleted_at IS NULL;
CREATE INDEX ix_mr_name_trgm  ON mining_records USING gin (lower(name) gin_trgm_ops);
CREATE INDEX ix_mr_registered ON mining_records (registered_at);

-- Historial de clasificaciones: cada cambio conserva fuente, fecha de consulta y verificación.
CREATE TABLE record_classifications (
  id                 bigserial PRIMARY KEY,
  record_id          text NOT NULL REFERENCES mining_records(id),
  status             text NOT NULL REFERENCES admin_statuses(code),
  source_institution text NOT NULL DEFAULT '',
  source_document    text NOT NULL DEFAULT '',
  consulted_at       date,
  verification_state verification_state NOT NULL DEFAULT 'no_verificado',
  determined_by      text NOT NULL,
  determined_at      timestamptz NOT NULL DEFAULT now(),
  notes              text,
  -- Regla: ninguna clasificación distinta de "sin determinar" sin documento ni fecha de consulta.
  CONSTRAINT ck_classification_support CHECK (
    status = 'sin_determinar' OR (length(trim(source_document)) > 0 AND length(trim(source_institution)) > 0 AND consulted_at IS NOT NULL)
  ),
  CONSTRAINT ck_illegal_verified CHECK (status <> 'ilegal_verificada' OR verification_state <> 'no_verificado')
);
CREATE INDEX ix_rc_record ON record_classifications (record_id, determined_at DESC);

-- Vista con la clasificación vigente de cada registro.
CREATE VIEW v_mining_records AS
SELECT r.*, h.name AS holder_name, c.source_institution, c.source_document, c.consulted_at,
       c.verification_state, c.determined_by, c.determined_at, c.notes AS classification_notes
FROM mining_records r
LEFT JOIN holders h ON h.id = r.holder_id
LEFT JOIN LATERAL (
  SELECT * FROM record_classifications rc WHERE rc.record_id = r.id ORDER BY rc.determined_at DESC, rc.id DESC LIMIT 1
) c ON true
WHERE r.deleted_at IS NULL;

-- ───────────────────────── Denuncias ciudadanas ─────────────────────────
CREATE TABLE citizen_reports (
  id                     text PRIMARY KEY,
  tracking_code          text NOT NULL UNIQUE,
  category               text NOT NULL CHECK (category IN ('actividad_minera','contaminacion_agua','cambios_territorio','afectacion_comunidades','otra_ambiental')),
  observed_mining_type   text REFERENCES mining_types(code),
  department             text NOT NULL,
  municipality           text NOT NULL,
  community              text NOT NULL DEFAULT '',
  location_description   text NOT NULL DEFAULT '',
  lat                    double precision NOT NULL CHECK (lat BETWEEN -23.0 AND -9.6),
  lng                    double precision NOT NULL CHECK (lng BETWEEN -69.75 AND -57.35),
  geom                   geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  observed_when_preset   text NOT NULL,
  observed_date          date NOT NULL,
  description            text NOT NULL,
  confidentiality        text NOT NULL CHECK (confidentiality IN ('anonimo','confidencial')),
  contact_info_encrypted bytea,            -- cifrado en la aplicación (Fernet); nunca en claro
  status                 text NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido','pendiente_revision','en_analisis','info_requerida','derivado_institucion','en_seguimiento','cerrado')),
  public_note            text NOT NULL DEFAULT '',
  assigned_institution   text,
  related_satellite_id   text,
  related_mining_record_id text REFERENCES mining_records(id),
  related_source_record_id text REFERENCES source_documents(id),
  origin                 data_origin NOT NULL DEFAULT 'manual',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_anon_no_contact CHECK (confidentiality = 'confidencial' OR contact_info_encrypted IS NULL)
);
CREATE INDEX ix_cr_geom ON citizen_reports USING gist (geom);
CREATE INDEX ix_cr_status ON citizen_reports (status, department);

-- ───────────────────────── Observaciones satelitales ─────────────────────────
CREATE TABLE satellite_observations (
  id                  text PRIMARY KEY,
  sensor              text NOT NULL CHECK (sensor IN ('sentinel1','sentinel2','landsat','planet','otro')),
  origin              text NOT NULL CHECK (origin IN ('automatizada','interpretacion_manual')),
  observation_type    text NOT NULL,
  acquisition_date    date NOT NULL,
  comparison_date     date,
  department          text NOT NULL,
  municipality        text NOT NULL,
  zone_name           text NOT NULL,
  lat                 double precision NOT NULL CHECK (lat BETWEEN -23.0 AND -9.6),
  lng                 double precision NOT NULL CHECK (lng BETWEEN -69.75 AND -57.35),
  geom                geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  footprint           geometry(MultiPolygon,4326),
  approx_area_ha      numeric(12,2) NOT NULL CHECK (approx_area_ha >= 0),
  confidence          text NOT NULL CHECK (confidence IN ('alta','media','baja')),
  review_state        text NOT NULL DEFAULT 'pendiente_revision',
  change_description  text NOT NULL,
  before_scene        text NOT NULL DEFAULT 'forest_clearing',
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  origin_data         data_origin NOT NULL DEFAULT 'manual'
);
CREATE INDEX ix_so_geom ON satellite_observations USING gist (geom);
ALTER TABLE citizen_reports ADD CONSTRAINT fk_cr_sat FOREIGN KEY (related_satellite_id) REFERENCES satellite_observations(id);

-- Verificación documental: tabla separada del resultado del sensor.
CREATE TABLE documental_verifications (
  id             bigserial PRIMARY KEY,
  observation_id text NOT NULL REFERENCES satellite_observations(id),
  result         text NOT NULL CHECK (result IN ('coincide_con_registro','sin_respaldo_documental','no_concluyente')),
  document       text NOT NULL,
  institution    text NOT NULL,
  verified_by    text NOT NULL,
  verified_at    timestamptz NOT NULL DEFAULT now(),
  notes          text
);

CREATE TABLE observation_record_links (
  observation_id text REFERENCES satellite_observations(id) ON DELETE CASCADE,
  record_id      text REFERENCES mining_records(id) ON DELETE CASCADE,
  linked_by      text NOT NULL,
  linked_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (observation_id, record_id)
);

-- ───────────────────────── Evidencias documentales ─────────────────────────
CREATE TABLE evidences (
  id           text PRIMARY KEY,
  entity_type  text NOT NULL CHECK (entity_type IN ('registro_minero','denuncia','observacion','alerta')),
  entity_id    text NOT NULL,
  title        text NOT NULL,
  doc_type     text NOT NULL,
  file_name    text NOT NULL,
  mime_type    text NOT NULL,
  size_bytes   bigint NOT NULL CHECK (size_bytes > 0),
  sha256       char(64) NOT NULL,
  storage_key  text NOT NULL,            -- ruta en el almacenamiento de archivos (no pública)
  uploaded_by  text NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  removed_at   timestamptz
);
CREATE INDEX ix_ev_entity ON evidences (entity_type, entity_id) WHERE removed_at IS NULL;

-- ───────────────────────── Alertas ─────────────────────────
CREATE TABLE alerts (
  id           text PRIMARY KEY,
  title        text NOT NULL,
  type         text NOT NULL,
  priority     text NOT NULL CHECK (priority IN ('alta','media','baja')),
  status       text NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','en_atencion','derivada','cerrada')),
  department   text NOT NULL,
  municipality text NOT NULL DEFAULT '',
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  geom         geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  description  text NOT NULL,
  derived_to   text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  origin       data_origin NOT NULL DEFAULT 'manual',
  CONSTRAINT ck_derived CHECK (status <> 'derivada' OR derived_to IS NOT NULL)
);
CREATE TABLE alert_links (
  alert_id    text REFERENCES alerts(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('registro_minero','denuncia','observacion')),
  entity_id   text NOT NULL,
  PRIMARY KEY (alert_id, entity_type, entity_id)
);

-- ───────────────────────── Auditoría (solo inserción) ─────────────────────────
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  user_id     text NOT NULL,
  user_name   text NOT NULL,
  user_role   text NOT NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  summary     text NOT NULL,
  changes     jsonb,
  ip_address  inet
);
CREATE INDEX ix_audit_entity ON audit_log (entity_type, entity_id, ts DESC);
CREATE INDEX ix_audit_ts ON audit_log (ts DESC);

CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log es de solo inserción'; END $$;
CREATE TRIGGER tg_audit_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- Superficie del área de operación (ha) calculada sobre el elipsoide.
CREATE FUNCTION mining_records_area() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.area_ha := CASE WHEN NEW.area_geom IS NULL THEN NULL ELSE round((ST_Area(NEW.area_geom::geography) / 10000.0)::numeric, 4) END;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_mr_area BEFORE INSERT OR UPDATE OF area_geom ON mining_records FOR EACH ROW EXECUTE FUNCTION mining_records_area();

INSERT INTO schema_migrations(version) VALUES ('001_init');
COMMIT;
