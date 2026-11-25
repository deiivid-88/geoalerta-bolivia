/**
 * Conjunto de DATOS DEMOSTRATIVOS de GeoAlerta.
 *
 * - Ningún registro corresponde a una operación, titular, resolución o estadística real.
 * - Los nombres de operadores y los códigos (prefijo DEMO-) son ficticios.
 * - Se incluyen, migrados, todos los datos del prototipo TERRAMINA (src/data/legacy).
 * - En modo `api` estos datos NO se usan: la información proviene de la base de datos.
 */
import type {
  AdminStatus,
  AreaGeometry,
  AuditEntry,
  CitizenReport,
  InstitutionalSource,
  MiningRecord,
  MiningType,
  ReportCategory,
  ReportStatus,
  ReviewState,
  SatelliteObservation,
  SatelliteObservationType,
  SourceDocument,
  TerritorialAlert,
  User,
  VerificationState
} from '../types/domain';
import { DEPARTMENTS } from './boliviaGeo';
import {
  INITIAL_AUDIT_LOG,
  INITIAL_INSTITUTIONAL_RECORDS,
  INITIAL_REPORTS,
  INITIAL_SATELLITE_OBSERVATIONS
} from './legacy/mockData';

/** Generador pseudoaleatorio determinista (mulberry32) para que la demo sea reproducible. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261125);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const jitter = (v: number, amount: number) => +(v + (rand() - 0.5) * amount).toFixed(5);
const pad = (n: number, w: number) => String(n).padStart(w, '0');

function dateBetween(start: string, end: string): string {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return new Date(a + rand() * (b - a)).toISOString().slice(0, 10);
}

function squareAround(lat: number, lng: number, halfDeg: number): AreaGeometry {
  const ring: [number, number][] = [
    [lng - halfDeg, lat - halfDeg * 0.8],
    [lng + halfDeg, lat - halfDeg * 0.8],
    [lng + halfDeg * 0.9, lat + halfDeg * 0.8],
    [lng - halfDeg * 1.1, lat + halfDeg * 0.8],
    [lng - halfDeg, lat - halfDeg * 0.8]
  ].map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)] as [number, number]);
  return { type: 'Polygon', coordinates: [ring] };
}

// ───────────────────────── Registros mineros ─────────────────────────

interface Zone {
  department: string;
  municipality: string;
  types: MiningType[];
  mineral: string;
  weight: number;
}

/** Zonas con actividad minera conocida a nivel general (solo para ubicar ejemplos). */
const ZONES: Zone[] = [
  { department: 'La Paz', municipality: 'Tipuani', types: ['aurifera', 'aluvial'], mineral: 'Oro', weight: 5 },
  { department: 'La Paz', municipality: 'Guanay', types: ['aurifera', 'aluvial'], mineral: 'Oro', weight: 5 },
  { department: 'La Paz', municipality: 'Mapiri', types: ['aurifera', 'aluvial'], mineral: 'Oro', weight: 4 },
  { department: 'La Paz', municipality: 'Teoponte', types: ['aurifera', 'aluvial'], mineral: 'Oro', weight: 4 },
  { department: 'La Paz', municipality: 'Apolo', types: ['aurifera', 'sin_clasificacion'], mineral: 'Oro', weight: 2 },
  { department: 'Beni', municipality: 'Riberalta', types: ['aluvial', 'aurifera'], mineral: 'Oro', weight: 3 },
  { department: 'Beni', municipality: 'Guayaramerín', types: ['aluvial', 'aridos'], mineral: 'Oro / áridos', weight: 2 },
  { department: 'Pando', municipality: 'Puerto Rico', types: ['aluvial', 'aurifera'], mineral: 'Oro', weight: 3 },
  { department: 'Pando', municipality: 'Sena', types: ['aluvial'], mineral: 'Oro', weight: 2 },
  { department: 'Potosí', municipality: 'Potosí', types: ['subterranea'], mineral: 'Plata / estaño / zinc', weight: 4 },
  { department: 'Potosí', municipality: 'Llallagua', types: ['subterranea'], mineral: 'Estaño', weight: 3 },
  { department: 'Potosí', municipality: 'Atocha', types: ['subterranea', 'cielo_abierto'], mineral: 'Estaño / plomo', weight: 2 },
  { department: 'Potosí', municipality: 'Uyuni', types: ['cielo_abierto', 'otro'], mineral: 'Plata / zinc', weight: 2 },
  { department: 'Oruro', municipality: 'Huanuni', types: ['subterranea'], mineral: 'Estaño', weight: 3 },
  { department: 'Oruro', municipality: 'Poopó', types: ['subterranea', 'cielo_abierto'], mineral: 'Estaño / plata', weight: 2 },
  { department: 'Oruro', municipality: 'Challapata', types: ['aridos', 'otro'], mineral: 'Áridos', weight: 1 },
  { department: 'Santa Cruz', municipality: 'San Ramón', types: ['cielo_abierto', 'aurifera'], mineral: 'Oro', weight: 2 },
  { department: 'Santa Cruz', municipality: 'San Ignacio de Velasco', types: ['cielo_abierto', 'aurifera'], mineral: 'Oro', weight: 2 },
  { department: 'Santa Cruz', municipality: 'Puerto Quijarro', types: ['cielo_abierto'], mineral: 'Hierro / manganeso', weight: 1 },
  { department: 'Cochabamba', municipality: 'Villa Tunari', types: ['aridos', 'aluvial'], mineral: 'Áridos', weight: 1 },
  { department: 'Cochabamba', municipality: 'Mizque', types: ['aridos', 'otro'], mineral: 'Áridos / no metálicos', weight: 1 },
  { department: 'Chuquisaca', municipality: 'Camargo', types: ['aridos', 'otro'], mineral: 'Áridos', weight: 1 },
  { department: 'Tarija', municipality: 'Bermejo', types: ['aridos'], mineral: 'Áridos', weight: 1 },
  { department: 'Tarija', municipality: 'Entre Ríos', types: ['aridos', 'sin_clasificacion'], mineral: 'Áridos', weight: 1 }
];

const STATUS_WEIGHTS: [AdminStatus, number][] = [
  ['legal', 30],
  ['en_proceso', 18],
  ['presuntamente_irregular', 20],
  ['ilegal_verificada', 9],
  ['sin_determinar', 23]
];

function weightedStatus(): AdminStatus {
  const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [s, w] of STATUS_WEIGHTS) {
    if ((r -= w) <= 0) return s;
  }
  return 'sin_determinar';
}

const SOURCE_BY_STATUS: Record<AdminStatus, { inst: string; doc: string; ver: VerificationState[] }> = {
  legal: { inst: 'AJAM (referencia demostrativa)', doc: 'Contrato administrativo minero DEMO-CAM', ver: ['verificado_documental', 'verificado_campo'] },
  en_proceso: { inst: 'AJAM (referencia demostrativa)', doc: 'Solicitud en trámite DEMO-SOL', ver: ['verificado_documental', 'en_verificacion'] },
  presuntamente_irregular: { inst: 'Equipo técnico GeoAlerta (demo)', doc: 'Informe técnico preliminar DEMO-INF', ver: ['en_verificacion', 'no_verificado'] },
  ilegal_verificada: { inst: 'AJAM (referencia demostrativa)', doc: 'Resolución administrativa DEMO-RES', ver: ['verificado_documental', 'verificado_campo'] },
  sin_determinar: { inst: '', doc: '', ver: ['no_verificado'] }
};

const OBS_BY_STATUS: Record<AdminStatus, string> = {
  legal: 'Operación con respaldo documental de ejemplo. Sin observaciones pendientes.',
  en_proceso: 'Trámite de ejemplo en evaluación. Se recomienda seguimiento del expediente.',
  presuntamente_irregular:
    'Indicios de inconsistencia entre el área observada y el área de referencia. Requiere investigación; no constituye determinación de ilegalidad.',
  ilegal_verificada: 'Determinación oficial de ejemplo registrada (dato ficticio).',
  sin_determinar: 'No se dispone de información suficiente. La ausencia en bases de datos no implica ilegalidad.'
};

function buildMiningRecords(): MiningRecord[] {
  const records: MiningRecord[] = [];
  const bag: Zone[] = ZONES.flatMap((z) => Array.from({ length: z.weight }, () => z));
  const total = 64;
  for (let i = 1; i <= total; i++) {
    const zone = pick(bag);
    const dept = DEPARTMENTS.find((d) => d.name === zone.department)!;
    const mun = dept.municipalities.find((m) => m.name === zone.municipality)!;
    const status = weightedStatus();
    const src = SOURCE_BY_STATUS[status];
    const miningType = pick(zone.types);
    const lat = jitter(mun.lat, 0.22);
    const lng = jitter(mun.lng, 0.22);
    const registeredAt = dateBetween('2024-01-15', '2026-11-20');
    const updatedAt = dateBetween(registeredAt, '2026-11-24');
    const n = pad(i, 3);
    const hasRight = status === 'legal' || status === 'en_proceso' || (status === 'ilegal_verificada' && rand() > 0.5);
    records.push({
      id: `GA-MIN-${pad(i, 6)}`,
      name: `Operación demostrativa ${zone.municipality} ${n}`,
      lat,
      lng,
      department: zone.department,
      province: mun.province,
      municipality: zone.municipality,
      locality: pick(mun.communities),
      miningType,
      mineral: zone.mineral,
      adminStatus: status,
      classification: {
        status,
        sourceInstitution: src.inst,
        sourceDocument: src.doc ? `${src.doc}-${n} (ficticio)` : '',
        consultedAt: status === 'sin_determinar' ? '' : updatedAt,
        verificationState: pick(src.ver),
        determinedBy: status === 'sin_determinar' ? 'Sistema (carga inicial)' : 'Revisor demostrativo',
        determinedAt: updatedAt,
        notes: status === 'sin_determinar' ? 'Sin fuente documental asociada.' : undefined
      },
      holder: status === 'sin_determinar' && rand() > 0.4 ? 'No identificado' : `Operador demostrativo ${String.fromCharCode(65 + (i % 26))}-${n}`,
      miningRightCode: hasRight ? `DEMO-${dept.code}-${pad(1000 + i * 7, 4)}` : undefined,
      registeredAt,
      updatedAt,
      source: 'Conjunto de datos demostrativo GeoAlerta',
      observations: OBS_BY_STATUS[status],
      geometry: rand() > 0.45 ? squareAround(lat, lng, miningType === 'subterranea' ? 0.012 : 0.03) : undefined,
      areaHa: undefined,
      evidences: [],
      relatedReportIds: [],
      relatedSatelliteIds: [],
      origin: 'demo',
      version: 1
    });
  }
  return records;
}

// ───────────────────────── Denuncias ─────────────────────────

const LEGACY_STATUS: Record<string, ReportStatus> = {
  recibido: 'recibido',
  en_revision: 'en_analisis',
  info_requerida: 'info_requerida',
  derivado_institucion: 'derivado_institucion',
  seguimiento_institucional: 'en_seguimiento',
  cerrado: 'cerrado'
};

const legacyCode = (code: string) => code.replace(/^TRM-(\d{4})-(\d+)$/, (_, y, n) => `GA-DEN-${y}-${pad(+n, 6)}`);
const legacySatId = (id?: string) => (id ? id.replace(/^SAT-S(\d)-(\d{4})-(\d+)$/, (_, s, y, n) => `GA-SAT-${y}-S${s}${pad(+n, 4)}`) : undefined);

function buildReports(): CitizenReport[] {
  const migrated: CitizenReport[] = INITIAL_REPORTS.map((r) => ({
    id: r.id.replace('REP-', 'DEN-'),
    trackingCode: legacyCode(r.trackingCode),
    category: r.category,
    observedMiningType: r.category === 'actividad_minera' ? 'aluvial' : undefined,
    department: r.department,
    municipality: r.municipality,
    community: r.community,
    locationDescription: r.locationDescription,
    lat: r.lat,
    lng: r.lng,
    observedWhenPreset: r.observedWhenPreset,
    observedDate: r.observedDate,
    createdAt: `${r.createdAt}T10:00:00`,
    updatedAt: `${r.createdAt}T10:00:00`,
    description: r.description,
    photos: [],
    confidentiality: r.confidentiality,
    contactInfo: r.confidentiality === 'confidencial' ? 'Contacto de ejemplo (dato ficticio)' : undefined,
    status: LEGACY_STATUS[r.status],
    publicNote: r.publicNote,
    assignedInstitution: r.assignedInstitution,
    relatedSatelliteId: legacySatId(r.relatedSatelliteId),
    relatedSourceRecordId: r.relatedInstitutionalId,
    origin: 'demo'
  }));

  const categories: ReportCategory[] = ['actividad_minera', 'actividad_minera', 'contaminacion_agua', 'cambios_territorio', 'afectacion_comunidades', 'otra_ambiental'];
  const statuses: ReportStatus[] = ['recibido', 'pendiente_revision', 'pendiente_revision', 'en_analisis', 'info_requerida', 'derivado_institucion', 'en_seguimiento', 'cerrado'];
  const extra: CitizenReport[] = [];
  for (let i = 8; i <= 46; i++) {
    const zone = pick(ZONES);
    const dept = DEPARTMENTS.find((d) => d.name === zone.department)!;
    const mun = dept.municipalities.find((m) => m.name === zone.municipality)!;
    const created = dateBetween('2025-12-01', '2026-11-23');
    const category = pick(categories);
    const status = pick(statuses);
    const conf = rand() > 0.55 ? 'confidencial' : 'anonimo';
    extra.push({
      id: `DEN-${pad(i, 3)}`,
      trackingCode: `GA-DEN-2026-${pad(600 + i * 13, 6)}`,
      category,
      observedMiningType: category === 'actividad_minera' ? pick(zone.types) : undefined,
      department: zone.department,
      municipality: zone.municipality,
      community: pick(mun.communities),
      locationDescription: 'Ubicación aproximada indicada por el denunciante (ejemplo).',
      lat: jitter(mun.lat, 0.3),
      lng: jitter(mun.lng, 0.3),
      observedWhenPreset: 'hace_mas_tiempo',
      observedDate: created,
      createdAt: `${created}T${pad(8 + Math.floor(rand() * 10), 2)}:${pad(Math.floor(rand() * 59), 2)}:00`,
      updatedAt: `${created}T18:00:00`,
      description: 'Texto de denuncia demostrativo. No describe un hecho real.',
      photos: [],
      confidentiality: conf,
      contactInfo: conf === 'confidencial' ? 'Contacto de ejemplo (dato ficticio)' : undefined,
      status,
      publicNote: 'Nota pública de ejemplo sobre el estado de la denuncia.',
      assignedInstitution: status === 'derivado_institucion' || status === 'en_seguimiento' ? 'Autoridad Jurisdiccional Administrativa Minera (AJAM)' : undefined,
      origin: 'demo'
    });
  }
  return [...migrated, ...extra];
}

// ───────────────────────── Observaciones satelitales ─────────────────────────

const LEGACY_REVIEW: Record<string, ReviewState> = {
  pendiente_verificacion: 'pendiente_revision',
  en_analisis: 'en_interpretacion',
  coincidencia_territorial: 'coincidencia_territorial',
  verificado_campo: 'confirmada_tecnicamente',
  variacion_estacional: 'variacion_estacional'
};

const LEGACY_TYPE: Record<string, SatelliteObservationType> = {
  river_meander: 'sedimentos',
  forest_clearing: 'remocion_vegetacion',
  highland_tailings: 'acopio_relaves',
  wetland_sediment: 'alteracion_cauce'
};

function buildSatellites(): SatelliteObservation[] {
  const migrated: SatelliteObservation[] = INITIAL_SATELLITE_OBSERVATIONS.map((s) => ({
    id: legacySatId(s.id)!,
    sensor: s.sensorType,
    origin: 'interpretacion_manual',
    observationType: LEGACY_TYPE[s.beforeScene],
    acquisitionDate: s.acquisitionDate,
    department: s.department,
    municipality: s.municipality,
    zoneName: s.zoneName,
    lat: s.lat,
    lng: s.lng,
    approxAreaHa: s.approxAreaHa,
    confidence: s.confidenceLabel === 'Alta prioridad de revisión' ? 'alta' : s.confidenceLabel === 'Prioridad media' ? 'media' : 'baja',
    reviewState: LEGACY_REVIEW[s.validationState],
    changeDescription: s.changeDescription,
    evidences: [],
    relatedReportIds: s.relatedReportIds.map((id) => id.replace('REP-', 'DEN-')),
    relatedMiningRecordIds: [],
    beforeScene: s.beforeScene,
    createdAt: `${s.acquisitionDate}T15:00:00`,
    createdBy: 'Analista SIG (demo)',
    dataOrigin: 'demo'
  }));

  const types: SatelliteObservationType[] = ['remocion_vegetacion', 'alteracion_cauce', 'sedimentos', 'posible_asentamiento', 'posible_asentamiento', 'apertura_camino', 'acopio_relaves'];
  const scenes = { remocion_vegetacion: 'forest_clearing', alteracion_cauce: 'wetland_sediment', sedimentos: 'river_meander', posible_asentamiento: 'forest_clearing', apertura_camino: 'forest_clearing', acopio_relaves: 'highland_tailings', otro: 'river_meander' } as const;
  const reviews: ReviewState[] = ['pendiente_revision', 'pendiente_revision', 'en_interpretacion', 'coincidencia_territorial', 'confirmada_tecnicamente', 'descartada', 'variacion_estacional'];
  const extra: SatelliteObservation[] = [];
  for (let i = 1; i <= 34; i++) {
    const zone = pick(ZONES.filter((z) => z.weight >= 2));
    const dept = DEPARTMENTS.find((d) => d.name === zone.department)!;
    const mun = dept.municipalities.find((m) => m.name === zone.municipality)!;
    const type = pick(types);
    const date = dateBetween('2025-12-01', '2026-11-22');
    const sensor = rand() > 0.5 ? 'sentinel2' : 'sentinel1';
    const automated = rand() > 0.35;
    extra.push({
      id: `GA-SAT-2026-A${pad(i, 4)}`,
      sensor,
      origin: automated ? 'automatizada' : 'interpretacion_manual',
      observationType: type,
      acquisitionDate: date,
      department: zone.department,
      municipality: zone.municipality,
      zoneName: `Sector ${pick(mun.communities)} (demo)`,
      lat: jitter(mun.lat, 0.35),
      lng: jitter(mun.lng, 0.35),
      approxAreaHa: +(1 + rand() * 28).toFixed(1),
      confidence: pick(['alta', 'media', 'media', 'baja'] as const),
      reviewState: automated ? pick(reviews.slice(0, 3)) : pick(reviews),
      changeDescription: automated
        ? 'Cambio detectado por algoritmo de comparación multitemporal (ejemplo). Requiere interpretación de un analista.'
        : 'Cambio interpretado visualmente por un analista (ejemplo demostrativo).',
      evidences: [],
      relatedReportIds: [],
      relatedMiningRecordIds: [],
      beforeScene: scenes[type],
      createdAt: `${date}T16:00:00`,
      createdBy: automated ? 'Motor de detección (demo)' : 'Analista SIG (demo)',
      dataOrigin: 'demo'
    });
  }
  return [...migrated, ...extra];
}

// ───────────────────────── Fuentes institucionales ─────────────────────────

const PENDING_USAGE = 'Por definir mediante convenio interinstitucional. No se ha establecido conexión.';

export const SEED_SOURCES: InstitutionalSource[] = [
  { id: 'SRC-SERGEOMIN', institution: 'Servicio Geológico Minero', acronym: 'SERGEOMIN', infoType: 'Cartografía geológica, catastro de recursos minerales e inventarios técnicos', reference: 'Portal institucional SERGEOMIN', referenceUrl: 'https://www.sergeomin.gob.bo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'Se requiere identificar servicios WMS/WFS o entregas periódicas de archivos.' },
  { id: 'SRC-MMM', institution: 'Ministerio de Minería y Metalurgia', acronym: 'MMM', infoType: 'Políticas sectoriales, registros de operadores y pasivos ambientales mineros', reference: 'Portal institucional del Ministerio', referenceUrl: 'https://www.mineria.gob.bo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'Sin API pública identificada. Posible carga manual de informes.' },
  { id: 'SRC-AJAM', institution: 'Autoridad Jurisdiccional Administrativa Minera', acronym: 'AJAM', infoType: 'Derechos mineros, contratos administrativos, cuadrículas y resoluciones', reference: 'Portal institucional AJAM', referenceUrl: 'https://www.autoridadminera.gob.bo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'Fuente principal para la clasificación administrativa. Requiere convenio de acceso al catastro minero.' },
  { id: 'SRC-MMAYA', institution: 'Ministerio de Medio Ambiente y Agua', acronym: 'MMAyA', infoType: 'Licencias ambientales, monitoreo hídrico y cuencas', reference: 'Portal institucional MMAyA', referenceUrl: 'https://www.mmaya.gob.bo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'Relevante para cruce con licencias ambientales y cuerpos de agua.' },
  { id: 'SRC-INE', institution: 'Instituto Nacional de Estadística', acronym: 'INE', infoType: 'Estadísticas oficiales de producción minera y división político-administrativa', reference: 'Portal institucional INE', referenceUrl: 'https://www.ine.gob.bo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'Las estadísticas mostradas en GeoAlerta NO provienen del INE mientras no exista integración.' },
  { id: 'SRC-SERNAP', institution: 'Servicio Nacional de Áreas Protegidas', acronym: 'SERNAP', infoType: 'Límites y zonificación de áreas protegidas nacionales', reference: 'Portal institucional SERNAP', referenceUrl: 'https://sernap.gob.bo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'Las áreas protegidas del mapa son polígonos referenciales aproximados, no límites oficiales.' },
  { id: 'SRC-GOB', institution: 'Gobiernos autónomos departamentales y municipales', acronym: 'GAD / GAM', infoType: 'Autorizaciones locales de áridos, ordenamiento territorial y denuncias locales', reference: 'Por definir con cada gobierno autónomo', availability: 'integracion_pendiente', usageConditions: PENDING_USAGE, notes: 'La competencia sobre áridos y agregados es municipal: requiere acuerdos individuales.' }
];

const SOURCE_FOR_LEGACY: Record<string, string> = {
  AJAM: 'SRC-AJAM',
  'Ministerio de Minería y Metalurgia': 'SRC-MMM',
  SERNAP: 'SRC-SERNAP',
  'MMAyA / ABT': 'SRC-MMAYA'
};

export const SEED_SOURCE_DOCUMENTS: SourceDocument[] = INITIAL_INSTITUTIONAL_RECORDS.map((r) => ({
  id: r.id,
  sourceId: SOURCE_FOR_LEGACY[r.institution] ?? 'SRC-MMM',
  institution: r.institution,
  recordType: r.recordType,
  title: r.title,
  department: r.department,
  municipality: r.municipality,
  lat: r.lat,
  lng: r.lng,
  updatedAt: r.updatedAt,
  reference: r.sourceLabel,
  summary: r.summary,
  codeReference: r.codeReference,
  origin: 'demo'
}));

// ───────────────────────── Usuarios demo ─────────────────────────

/** Contraseña común de los usuarios demostrativos (solo modo demo; visible en la pantalla de acceso). */
export const DEMO_PASSWORD = 'GeoAlerta-demo-2026';

export const SEED_USERS: User[] = [
  { id: 'USR-001', name: 'Administración (demo)', email: 'admin@demo.geoalerta.bo', role: 'administrador', institution: 'Unidad de Sistemas (demo)', active: true, createdAt: '2026-01-10T09:00:00' },
  { id: 'USR-002', name: 'Analista SIG (demo)', email: 'analista@demo.geoalerta.bo', role: 'analista_sig', institution: 'Unidad SIG (demo)', active: true, createdAt: '2026-01-12T09:00:00' },
  { id: 'USR-003', name: 'Revisor institucional (demo)', email: 'revisor@demo.geoalerta.bo', role: 'revisor_institucional', institution: 'Dirección de Fiscalización (demo)', active: true, createdAt: '2026-01-15T09:00:00' },
  { id: 'USR-004', name: 'Consulta institucional (demo)', email: 'consulta@demo.geoalerta.bo', role: 'consulta_institucional', institution: 'Gobernación (demo)', active: true, createdAt: '2026-02-01T09:00:00' },
  { id: 'USR-005', name: 'Usuario desactivado (demo)', email: 'baja@demo.geoalerta.bo', role: 'consulta_institucional', institution: 'Municipio (demo)', active: false, createdAt: '2026-02-03T09:00:00' }
];

// ───────────────────────── Ensamblado y vínculos ─────────────────────────

export interface SeedData {
  miningRecords: MiningRecord[];
  reports: CitizenReport[];
  satellites: SatelliteObservation[];
  alerts: TerritorialAlert[];
  sources: InstitutionalSource[];
  sourceDocuments: SourceDocument[];
  users: User[];
  audit: AuditEntry[];
}

function nearest<T extends { lat: number; lng: number; department: string }>(items: T[], lat: number, lng: number, dept: string): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const it of items) {
    if (it.department !== dept) continue;
    const d = (it.lat - lat) ** 2 + (it.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return bestD < 0.09 ? best : undefined; // ~30 km
}

export function buildSeed(): SeedData {
  const miningRecords = buildMiningRecords();
  const reports = buildReports();
  const satellites = buildSatellites();

  // Vínculos espaciales de ejemplo (denuncia/observación ↔ registro cercano).
  satellites.forEach((s) => {
    const rec = nearest(miningRecords, s.lat, s.lng, s.department);
    if (rec && rand() > 0.35) {
      s.relatedMiningRecordIds.push(rec.id);
      rec.relatedSatelliteIds.push(s.id);
    }
  });
  reports.forEach((r) => {
    const rec = nearest(miningRecords, r.lat, r.lng, r.department);
    if (rec && r.status !== 'recibido' && rand() > 0.4) {
      r.relatedMiningRecordId = rec.id;
      rec.relatedReportIds.push(r.id);
    }
  });

  const alerts: TerritorialAlert[] = [];
  let alertN = 1;
  const pushAlert = (a: Omit<TerritorialAlert, 'id' | 'origin' | 'createdBy' | 'updatedAt'> & { updatedAt?: string }) => {
    alerts.push({ ...a, id: `GA-ALR-2026-${pad(alertN++, 6)}`, updatedAt: a.updatedAt ?? a.createdAt, createdBy: 'Analista SIG (demo)', origin: 'demo' });
  };
  satellites
    .filter((s) => s.confidence === 'alta' && s.reviewState !== 'descartada' && s.reviewState !== 'variacion_estacional')
    .slice(0, 9)
    .forEach((s, i) =>
      pushAlert({
        title: `${s.observationType === 'posible_asentamiento' ? 'Posible asentamiento' : 'Cambio territorial'} en ${s.municipality}`,
        type: s.observationType === 'sedimentos' || s.observationType === 'alteracion_cauce' ? 'cuerpo_de_agua' : 'observacion_satelital',
        priority: i % 3 === 0 ? 'alta' : 'media',
        status: (['activa', 'activa', 'en_atencion', 'derivada', 'cerrada'] as const)[i % 5],
        department: s.department,
        municipality: s.municipality,
        lat: s.lat,
        lng: s.lng,
        description: `Alerta de ejemplo generada a partir de la observación ${s.id}. Requiere revisión; no determina ilegalidad.`,
        related: [{ type: 'observacion', id: s.id }, ...s.relatedMiningRecordIds.map((id) => ({ type: 'registro_minero' as const, id }))],
        derivedTo: i % 5 === 3 ? 'Autoridad Jurisdiccional Administrativa Minera (AJAM)' : undefined,
        createdAt: `${s.acquisitionDate}T17:00:00`
      })
    );
  pushAlert({
    title: 'Observación próxima a zona de amortiguación (referencial)',
    type: 'area_protegida',
    priority: 'alta',
    status: 'activa',
    department: 'La Paz',
    municipality: 'Apolo',
    lat: -14.56,
    lng: -68.43,
    description: 'Ejemplo migrado del prototipo: proximidad de una observación a un límite referencial de área protegida.',
    related: [{ type: 'observacion', id: 'GA-SAT-2026-S20094' }, { type: 'denuncia', id: 'DEN-005' }],
    createdAt: '2026-11-15T09:20:00'
  });
  miningRecords
    .filter((r) => r.adminStatus === 'presuntamente_irregular')
    .slice(0, 4)
    .forEach((r, i) =>
      pushAlert({
        title: `Inconsistencia documental: ${r.name}`,
        type: 'inconsistencia_documental',
        priority: 'media',
        status: i === 0 ? 'en_atencion' : 'activa',
        department: r.department,
        municipality: r.municipality,
        lat: r.lat,
        lng: r.lng,
        description: 'El área observada no coincide con el área de referencia del expediente (ejemplo).',
        related: [{ type: 'registro_minero', id: r.id }],
        createdAt: `${r.updatedAt}T11:00:00`
      })
    );

  const audit: AuditEntry[] = INITIAL_AUDIT_LOG.map((l, i) => ({
    id: `AUD-L${i + 1}`,
    timestamp: l.timestamp.replace(' ', 'T') + ':00',
    userId: 'USR-LEGACY',
    userName: l.userName,
    userRole: l.userRole === 'Administrador' ? 'administrador' : l.userRole === 'Analista SIG' ? 'analista_sig' : 'revisor_institucional',
    action: 'cambiar_estado',
    entityType: l.targetType === 'Reporte ciudadano' ? 'denuncia' : 'observacion',
    entityId: l.targetType === 'Reporte ciudadano' ? legacyCode(l.targetId) : legacySatId(l.targetId)!,
    summary: l.notes,
    changes: [{ field: 'estado', from: l.previousState, to: l.newState }]
  }));
  miningRecords.slice(0, 12).forEach((r, i) =>
    audit.push({
      id: `AUD-S${i + 1}`,
      timestamp: `${r.registeredAt}T09:30:00`,
      userId: 'USR-002',
      userName: 'Analista SIG (demo)',
      userRole: 'analista_sig',
      action: 'crear',
      entityType: 'registro_minero',
      entityId: r.id,
      summary: 'Registro creado en la carga inicial demostrativa.'
    })
  );
  audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    miningRecords,
    reports,
    satellites,
    alerts,
    sources: SEED_SOURCES,
    sourceDocuments: SEED_SOURCE_DOCUMENTS,
    users: SEED_USERS,
    audit
  };
}
