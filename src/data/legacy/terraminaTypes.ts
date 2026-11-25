export type ReportCategory =
  | 'actividad_minera'
  | 'contaminacion_agua'
  | 'cambios_territorio'
  | 'afectacion_comunidades'
  | 'otra_ambiental';

export type ReportStatus =
  | 'recibido'
  | 'en_revision'
  | 'info_requerida'
  | 'derivado_institucion'
  | 'seguimiento_institucional'
  | 'cerrado';

export type ValidationState =
  | 'pendiente_verificacion'
  | 'en_analisis'
  | 'coincidencia_territorial'
  | 'verificado_campo'
  | 'variacion_estacional';

export type ConfidentialityMode = 'anonimo' | 'confidencial';

export type ObservedWhenPreset =
  | 'hoy'
  | 'esta_semana'
  | 'hace_mas_tiempo'
  | 'no_seguro';

export interface CitizenReport {
  id: string;
  trackingCode: string;
  category: ReportCategory;
  department: string;
  municipality: string;
  community: string;
  locationDescription: string;
  lat: number;
  lng: number;
  observedWhenPreset: ObservedWhenPreset;
  observedDate: string;
  createdAt: string;
  description: string;
  hasPhoto: boolean;
  photoPreviewUrl?: string;
  confidentiality: ConfidentialityMode;
  contactInfo?: string;
  status: ReportStatus;
  publicNote: string;
  assignedInstitution?: string;
  relatedSatelliteId?: string;
  relatedInstitutionalId?: string;
  hasCoincidence: boolean;
}

export type SatelliteScenePreset =
  | 'river_meander'
  | 'forest_clearing'
  | 'highland_tailings'
  | 'wetland_sediment';

export interface SatelliteObservation {
  id: string;
  sensor: 'Sentinel-1 (Radar SAR)' | 'Sentinel-2 (Óptico)';
  sensorType: 'sentinel1' | 'sentinel2';
  acquisitionDate: string;
  comparisonWindow: string;
  department: string;
  municipality: string;
  zoneName: string;
  lat: number;
  lng: number;
  approxAreaHa: number;
  confidenceLabel:
    | 'Alta prioridad de revisión'
    | 'Prioridad media'
    | 'Observación preliminar';
  validationState: ValidationState;
  changeDescription: string;
  relatedReportIds: string[];
  relatedInstitutionalId?: string;
  beforeScene: SatelliteScenePreset;
}

export interface InstitutionalRecord {
  id: string;
  institution:
    | 'AJAM'
    | 'Ministerio de Minería y Metalurgia'
    | 'SERNAP'
    | 'MMAyA / ABT';
  recordType: string;
  title: string;
  department: string;
  municipality: string;
  lat: number;
  lng: number;
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
  availabilityState:
    | 'Datos demostrativos públicos'
    | 'Consulta parcial simulada'
    | 'Enlace referencial';
  summary: string;
  codeReference: string;
}

export interface ProtectedArea {
  id: string;
  name: string;
  category: string;
  department: string;
  polygon: [number, number][];
}

export interface MiningRightPolygon {
  id: string;
  code: string;
  name: string;
  holderType: string;
  department: string;
  municipality: string;
  status: string;
  polygon: [number, number][];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  targetType:
    | 'Reporte ciudadano'
    | 'Observación satelital'
    | 'Registro institucional';
  targetId: string;
  previousState: string;
  newState: string;
  notes: string;
}

export interface TechUserSession {
  authenticated: boolean;
  name: string;
  role: 'Analista SIG' | 'Revisor Institucional' | 'Administrador';
  institution: string;
}

export type PageId =
  | 'inicio'
  | 'mapa'
  | 'denuncia'
  | 'seguimiento'
  | 'satelital'
  | 'institucional'
  | 'analisis'
  | 'admin';

export interface ReportDraft {
  step: number;
  category: ReportCategory | '';
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
  photoPreviewUrl: string;
  photoFileName: string;
  confidentiality: ConfidentialityMode;
  contactInfo: string;
}
