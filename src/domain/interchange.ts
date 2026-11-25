import type {
  AdminStatus,
  AreaGeometry,
  MiningRecord,
  MiningRecordInput,
  MiningType,
  VerificationState
} from '../types/domain';
import { ADMIN_STATUS, MINING_TYPE, VERIFICATION_STATE } from './catalogs';
import { normalizeText, todayISO } from './util';

/** Columnas estándar de intercambio (CSV / Excel / atributos de GeoJSON y Shapefile). */
export const RECORD_COLUMNS = [
  'id',
  'nombre',
  'latitud',
  'longitud',
  'departamento',
  'provincia',
  'municipio',
  'localidad',
  'tipo_mineria',
  'mineral',
  'situacion_administrativa',
  'institucion_respaldo',
  'documento_respaldo',
  'fecha_consulta',
  'estado_verificacion',
  'titular',
  'codigo_derecho_minero',
  'fecha_registro',
  'fecha_actualizacion',
  'fuente',
  'observaciones'
] as const;

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  // Prevención de inyección de fórmulas al abrir el CSV en Excel.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function recordToRow(r: MiningRecord): Record<(typeof RECORD_COLUMNS)[number], string | number> {
  return {
    id: r.id,
    nombre: r.name,
    latitud: r.lat,
    longitud: r.lng,
    departamento: r.department,
    provincia: r.province,
    municipio: r.municipality,
    localidad: r.locality,
    tipo_mineria: r.miningType,
    mineral: r.mineral ?? '',
    situacion_administrativa: r.adminStatus,
    institucion_respaldo: r.classification.sourceInstitution,
    documento_respaldo: r.classification.sourceDocument,
    fecha_consulta: r.classification.consultedAt,
    estado_verificacion: r.classification.verificationState,
    titular: r.holder,
    codigo_derecho_minero: r.miningRightCode ?? '',
    fecha_registro: r.registeredAt,
    fecha_actualizacion: r.updatedAt,
    fuente: r.source,
    observaciones: r.observations
  };
}

export function recordsToCSV(records: MiningRecord[]): string {
  const header = RECORD_COLUMNS.join(',');
  const lines = records.map((r) => {
    const row = recordToRow(r);
    return RECORD_COLUMNS.map((c) => csvEscape(row[c])).join(',');
  });
  // BOM para que Excel reconozca UTF-8 (tildes y ñ).
  return '﻿' + [header, ...lines].join('\r\n');
}

export function recordsToGeoJSON(records: MiningRecord[], includePolygons = true) {
  return {
    type: 'FeatureCollection' as const,
    name: 'geoalerta_registros_mineros',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: records.map((r) => ({
      type: 'Feature' as const,
      id: r.id,
      geometry:
        includePolygons && r.geometry
          ? {
              type: 'GeometryCollection' as const,
              geometries: [{ type: 'Point' as const, coordinates: [r.lng, r.lat] }, r.geometry]
            }
          : { type: 'Point' as const, coordinates: [r.lng, r.lat] },
      properties: recordToRow(r)
    }))
  };
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ───────────────────────── Importación ─────────────────────────

/** Parser CSV RFC 4180 (comillas, saltos de línea dentro de campos, separador , o ;). */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

function pickEnum<T extends string>(value: string | undefined, catalog: Record<T, unknown>, labels: (k: T) => string[], fallback: T): T {
  if (!value) return fallback;
  const v = normalizeText(value).replace(/[\s/]+/g, '_');
  const keys = Object.keys(catalog) as T[];
  const direct = keys.find((k) => k === v);
  if (direct) return direct;
  const byLabel = keys.find((k) => labels(k).some((l) => normalizeText(l).replace(/[\s/]+/g, '_') === v));
  return byLabel ?? fallback;
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  return parseFloat(value.trim().replace(',', '.'));
}

/** Convierte una fila (claves de RECORD_COLUMNS) en datos de registro. Nunca clasifica por omisión. */
export function rowToRecordInput(row: Record<string, unknown>, sourceLabel: string): MiningRecordInput {
  const get = (k: string) => {
    const v = row[k];
    return v == null ? '' : String(v).trim();
  };
  const status = pickEnum<AdminStatus>(get('situacion_administrativa'), ADMIN_STATUS, (k) => [ADMIN_STATUS[k].label, ADMIN_STATUS[k].short], 'sin_determinar');
  const miningType = pickEnum<MiningType>(get('tipo_mineria'), MINING_TYPE, (k) => [MINING_TYPE[k].label, MINING_TYPE[k].short], 'sin_clasificacion');
  const verification = pickEnum<VerificationState>(get('estado_verificacion'), VERIFICATION_STATE, (k) => [VERIFICATION_STATE[k].label], 'no_verificado');
  return {
    name: get('nombre'),
    lat: toNumber(row['latitud']),
    lng: toNumber(row['longitud']),
    department: get('departamento'),
    province: get('provincia'),
    municipality: get('municipio'),
    locality: get('localidad'),
    miningType,
    mineral: get('mineral') || undefined,
    classification: {
      status,
      sourceInstitution: get('institucion_respaldo'),
      sourceDocument: get('documento_respaldo'),
      consultedAt: get('fecha_consulta'),
      verificationState: verification
    },
    holder: get('titular'),
    miningRightCode: get('codigo_derecho_minero') || undefined,
    registeredAt: get('fecha_registro') || todayISO(),
    source: get('fuente') || sourceLabel,
    observations: get('observaciones'),
    relatedReportIds: [],
    relatedSatelliteIds: [],
    origin: 'importado'
  };
}

export function csvToRows(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCSV(text);
  if (!header) return [];
  const keys = header.map((h) => normalizeText(h).replace(/\s+/g, '_'));
  return rows.map((cells) => Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ''])));
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
}

/** Extrae filas de un GeoJSON: Point → lat/lng; Polygon/MultiPolygon → geometría + centroide. */
export function geojsonToRows(json: unknown): { row: Record<string, unknown>; geometry?: AreaGeometry }[] {
  const fc = json as { type?: string; features?: GeoJSONFeature[] };
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('El archivo no es un GeoJSON FeatureCollection válido.');
  }
  return fc.features.map((f) => {
    const props = { ...(f.properties ?? {}) };
    const g = f.geometry;
    let geometry: AreaGeometry | undefined;
    if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
      const [lng, lat] = g.coordinates as number[];
      props.latitud ??= lat;
      props.longitud ??= lng;
    } else if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      geometry = g as AreaGeometry;
      const c = centroidOf(geometry);
      props.latitud ??= c.lat;
      props.longitud ??= c.lng;
    }
    return { row: props, geometry };
  });
}

export function centroidOf(geometry: AreaGeometry): { lat: number; lng: number } {
  const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
  const pts = ring.slice(0, -1).length ? ring.slice(0, -1) : ring;
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lat, lng };
}
