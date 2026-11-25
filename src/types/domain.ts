/**
 * Modelo de dominio GeoAlerta (frontend).
 * Refleja las entidades del esquema PostgreSQL/PostGIS en `backend/db/migrations/001_init.sql`.
 * Los nombres de campo de la API son snake_case; el cliente HTTP los convierte a camelCase.
 */

// ───────────────────────── Catálogos ─────────────────────────

/** Situación administrativa de una actividad minera. */
export type AdminStatus =
  | 'legal' // LEGAL / AUTORIZADA
  | 'ilegal_verificada' // ILEGAL VERIFICADA
  | 'presuntamente_irregular' // PRESUNTAMENTE IRREGULAR
  | 'en_proceso' // EN PROCESO
  | 'sin_determinar'; // SIN DETERMINAR

export type MiningType =
  | 'aurifera'
  | 'aluvial'
  | 'subterranea'
  | 'cielo_abierto'
  | 'aridos'
  | 'otro'
  | 'sin_clasificacion';

/** Estado de verificación del respaldo de una clasificación o registro. */
export type VerificationState =
  | 'no_verificado'
  | 'en_verificacion'
  | 'verificado_documental'
  | 'verificado_campo';

export type Role =
  | 'administrador'
  | 'analista_sig'
  | 'revisor_institucional'
  | 'consulta_institucional';

export type DataOrigin = 'demo' | 'importado' | 'manual' | 'institucional';

// ───────────────────────── Geometría ─────────────────────────

export type LngLat = [number, number];
export interface PolygonGeometry {
  type: 'Polygon';
  /** GeoJSON: anillos de [lng, lat] (EPSG:4326). */
  coordinates: LngLat[][];
}
export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: LngLat[][][];
}
export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry;

// ───────────────────────── Evidencias ─────────────────────────

export type EvidenceEntity = 'registro_minero' | 'denuncia' | 'observacion' | 'alerta';

export interface Evidence {
  id: string;
  entityType: EvidenceEntity;
  entityId: string;
  title: string;
  docType: 'resolucion' | 'contrato' | 'informe_tecnico' | 'acta' | 'fotografia' | 'imagen_satelital' | 'otro';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  uploadedAt: string;
  uploadedBy: string;
  /** URL de descarga autenticada (modo API). */
  url?: string;
  /** Solo modo demo: contenido embebido (imágenes comprimidas, máx. ~400 KB). */
  dataUrl?: string;
}

// ───────────────────────── Registros mineros ─────────────────────────

/** Respaldo documental obligatorio de toda clasificación administrativa. */
export interface ClassificationBasis {
  status: AdminStatus;
  sourceInstitution: string;
  sourceDocument: string;
  /** Fecha de consulta de la fuente (YYYY-MM-DD). */
  consultedAt: string;
  verificationState: VerificationState;
  determinedBy: string;
  determinedAt: string;
  notes?: string;
}

export interface MiningRecord {
  id: string; // GA-MIN-000001
  name: string;
  lat: number;
  lng: number;
  department: string;
  province: string;
  municipality: string;
  locality: string;
  miningType: MiningType;
  mineral?: string;
  adminStatus: AdminStatus;
  classification: ClassificationBasis;
  holder: string;
  miningRightCode?: string;
  registeredAt: string;
  updatedAt: string;
  source: string;
  observations: string;
  geometry?: AreaGeometry;
  /** Superficie del área de operación en hectáreas (calculada por PostGIS en modo API). */
  areaHa?: number;
  evidences: Evidence[];
  relatedReportIds: string[];
  relatedSatelliteIds: string[];
  origin: DataOrigin;
  version: number;
}

export type MiningRecordInput = Omit<
  MiningRecord,
  'id' | 'updatedAt' | 'evidences' | 'version' | 'classification' | 'adminStatus'
> & {
  classification: Omit<ClassificationBasis, 'determinedBy' | 'determinedAt'>;
};

// ───────────────────────── Denuncias ciudadanas ─────────────────────────

export type ReportCategory =
  | 'actividad_minera'
  | 'contaminacion_agua'
  | 'cambios_territorio'
  | 'afectacion_comunidades'
  | 'otra_ambiental';

export type ReportStatus =
  | 'recibido'
  | 'pendiente_revision'
  | 'en_analisis'
  | 'info_requerida'
  | 'derivado_institucion'
  | 'en_seguimiento'
  | 'cerrado';

export type ConfidentialityMode = 'anonimo' | 'confidencial';
export type ObservedWhenPreset = 'hoy' | 'esta_semana' | 'hace_mas_tiempo' | 'no_seguro';

export interface ReportPhoto {
  fileName: string;
  dataUrl?: string;
  url?: string;
}

export interface CitizenReport {
  id: string;
  trackingCode: string; // GA-DEN-2026-000123
  category: ReportCategory;
  observedMiningType?: MiningType;
  department: string;
  municipality: string;
  community: string;
  locationDescription: string;
  lat: number;
  lng: number;
  observedWhenPreset: ObservedWhenPreset;
  observedDate: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  photos: ReportPhoto[];
  confidentiality: ConfidentialityMode;
  /** Dato sensible: solo visible con permiso `reports.view_sensitive`. */
  contactInfo?: string;
  status: ReportStatus;
  publicNote: string;
  assignedInstitution?: string;
  relatedSatelliteId?: string;
  relatedMiningRecordId?: string;
  relatedSourceRecordId?: string;
  origin: DataOrigin;
}

/** Lo único que la consulta pública de seguimiento puede ver. */
export interface PublicReportView {
  trackingCode: string;
  category: ReportCategory;
  department: string;
  municipality: string;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  publicNote: string;
  assignedInstitution?: string;
}

export interface ReportDraft {
  step: number;
  category: ReportCategory | '';
  observedMiningType: MiningType | '';
  department: string;
  municipality: string;
  community: string;
  locationDescription: string;
  lat: number;
  lng: number;
  hasPinnedLocation: boolean;
  observedWhenPreset: ObservedWhenPreset | '';
  observedDate: string;
  description: string;
  photos: ReportPhoto[];
  confidentiality: ConfidentialityMode;
  contactInfo: string;
}

export type NewReportInput = Omit<
  CitizenReport,
  'id' | 'trackingCode' | 'createdAt' | 'updatedAt' | 'status' | 'publicNote' | 'origin'
>;

// ───────────────────────── Observaciones satelitales ─────────────────────────

export type SatelliteObservationType =
  | 'remocion_vegetacion'
  | 'alteracion_cauce'
  | 'sedimentos'
  | 'posible_asentamiento'
  | 'apertura_camino'
  | 'acopio_relaves'
  | 'otro';

export type ReviewState =
  | 'pendiente_revision'
  | 'en_interpretacion'
  | 'coincidencia_territorial'
  | 'descartada'
  | 'variacion_estacional'
  | 'confirmada_tecnicamente';

export type ConfidenceLevel = 'alta' | 'media' | 'baja';

/** Origen de la observación: detección automatizada vs. interpretación de un analista. */
export type ObservationOrigin = 'automatizada' | 'interpretacion_manual';

export type SatelliteScenePreset =
  | 'river_meander'
  | 'forest_clearing'
  | 'highland_tailings'
  | 'wetland_sediment';

/** Verificación documental: separada del resultado del sensor. */
export interface DocumentalVerification {
  result: 'coincide_con_registro' | 'sin_respaldo_documental' | 'no_concluyente';
  document: string;
  institution: string;
  verifiedBy: string;
  verifiedAt: string;
  notes?: string;
}

export interface SatelliteObservation {
  id: string; // GA-SAT-2026-000089
  sensor: 'sentinel1' | 'sentinel2' | 'landsat' | 'planet' | 'otro';
  origin: ObservationOrigin;
  observationType: SatelliteObservationType;
  acquisitionDate: string;
  comparisonDate?: string;
  department: string;
  municipality: string;
  zoneName: string;
  lat: number;
  lng: number;
  approxAreaHa: number;
  confidence: ConfidenceLevel;
  reviewState: ReviewState;
  changeDescription: string;
  evidences: Evidence[];
  relatedReportIds: string[];
  relatedMiningRecordIds: string[];
  documentalVerification?: DocumentalVerification;
  beforeScene: SatelliteScenePreset;
  createdAt: string;
  createdBy: string;
  dataOrigin: DataOrigin;
}

// ───────────────────────── Fuentes institucionales ─────────────────────────

export type SourceAvailability =
  | 'integracion_pendiente'
  | 'carga_manual'
  | 'api_disponible'
  | 'no_disponible';

export interface InstitutionalSource {
  id: string;
  institution: string;
  acronym: string;
  infoType: string;
  updatedAt?: string;
  reference: string;
  referenceUrl?: string;
  availability: SourceAvailability;
  usageConditions: string;
  notes: string;
}

/** Documento o registro concreto obtenido de una fuente (antes "registro institucional"). */
export interface SourceDocument {
  id: string;
  sourceId: string;
  institution: string;
  recordType: string;
  title: string;
  department: string;
  municipality: string;
  lat: number;
  lng: number;
  updatedAt: string;
  reference: string;
  summary: string;
  codeReference: string;
  origin: DataOrigin;
}

// ───────────────────────── Alertas ─────────────────────────

export type AlertType =
  | 'observacion_satelital'
  | 'denuncia_ciudadana'
  | 'area_protegida'
  | 'inconsistencia_documental'
  | 'cuerpo_de_agua'
  | 'otro';

export type AlertPriority = 'alta' | 'media' | 'baja';
export type AlertStatus = 'activa' | 'en_atencion' | 'derivada' | 'cerrada';

export interface EntityRef {
  type: 'registro_minero' | 'denuncia' | 'observacion';
  id: string;
}

export interface TerritorialAlert {
  id: string; // GA-ALR-2026-000001
  title: string;
  type: AlertType;
  priority: AlertPriority;
  status: AlertStatus;
  department: string;
  municipality: string;
  lat: number;
  lng: number;
  description: string;
  related: EntityRef[];
  derivedTo?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  origin: DataOrigin;
}

// ───────────────────────── Usuarios, sesión y auditoría ─────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  institution: string;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Session {
  user: User;
  token?: string;
  expiresAt: string;
}

export type AuditAction =
  | 'crear'
  | 'actualizar'
  | 'clasificar'
  | 'cambiar_estado'
  | 'vincular'
  | 'adjuntar'
  | 'eliminar'
  | 'importar'
  | 'exportar'
  | 'iniciar_sesion'
  | 'derivar';

export type AuditEntity =
  | 'registro_minero'
  | 'denuncia'
  | 'observacion'
  | 'alerta'
  | 'usuario'
  | 'fuente'
  | 'sesion';

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role | 'sistema' | 'ciudadano';
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  summary: string;
  changes?: FieldChange[];
}

// ───────────────────────── Utilidades de consulta ─────────────────────────

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortOrder = 'asc' | 'desc';

export interface MiningRecordQuery {
  q?: string;
  department?: string;
  province?: string;
  municipality?: string;
  miningType?: MiningType | '';
  adminStatus?: AdminStatus | '';
  verificationState?: VerificationState | '';
  dateFrom?: string;
  dateTo?: string;
  sort?: keyof MiningRecord;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface ImportResult {
  created: number;
  skippedDuplicates: number;
  errors: { row: number; message: string }[];
}
