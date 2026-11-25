import type { AreaGeometry, MiningRecord, MiningRecordInput } from '../types/domain';
import { ADMIN_STATUS, MINING_TYPE } from './catalogs';
import { normalizeText, distanceKm } from './util';

/** Extensión aproximada de Bolivia (EPSG:4326) con margen de ~10 km. */
export const BOLIVIA_BBOX = { minLat: -23.0, maxLat: -9.6, minLng: -69.75, maxLng: -57.35 };

export function isInsideBolivia(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BOLIVIA_BBOX.minLat &&
    lat <= BOLIVIA_BBOX.maxLat &&
    lng >= BOLIVIA_BBOX.minLng &&
    lng <= BOLIVIA_BBOX.maxLng
  );
}

/**
 * Interpreta texto como coordenadas: "-15.56, -67.98", "-15.56 -67.98"
 * o grados/minutos/segundos "15°33'36\"S 67°58'48\"W". Devuelve null si no son coordenadas.
 */
export function parseCoordinateQuery(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  const decimal = t.match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (decimal) {
    const lat = parseFloat(decimal[1].replace(',', '.'));
    const lng = parseFloat(decimal[2].replace(',', '.'));
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null;
  }
  const dms = t.match(
    /(\d{1,2})[°º]\s*(\d{1,2})['’]\s*(\d{1,2}(?:[.,]\d+)?)["”]?\s*([NS])[\s,;]+(\d{1,3})[°º]\s*(\d{1,2})['’]\s*(\d{1,2}(?:[.,]\d+)?)["”]?\s*([EWO])/i
  );
  if (dms) {
    const toDec = (d: string, m: string, s: string) =>
      parseInt(d, 10) + parseInt(m, 10) / 60 + parseFloat(s.replace(',', '.')) / 3600;
    let lat = toDec(dms[1], dms[2], dms[3]);
    let lng = toDec(dms[5], dms[6], dms[7]);
    if (dms[4].toUpperCase() === 'S') lat = -lat;
    if (['W', 'O'].includes(dms[8].toUpperCase())) lng = -lng;
    return { lat, lng };
  }
  return null;
}

export type FieldErrors = Partial<Record<string, string>>;

export function validateGeometry(geometry: AreaGeometry | undefined): string | null {
  if (!geometry) return null;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) return 'Geometría vacía.';
  for (const poly of polygons) {
    const ring = poly[0];
    if (!ring || ring.length < 4) return 'Cada polígono necesita al menos 4 vértices (anillo cerrado).';
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) return 'El anillo del polígono debe estar cerrado (primer vértice = último).';
    for (const [lng, lat] of ring) {
      if (!isInsideBolivia(lat, lng)) return 'La geometría contiene vértices fuera del territorio boliviano.';
    }
  }
  return null;
}

export function validateMiningRecordInput(input: Partial<MiningRecordInput>): FieldErrors {
  const e: FieldErrors = {};
  if (!input.name || input.name.trim().length < 3) e.name = 'Indique el nombre de la operación (mín. 3 caracteres).';
  if (input.lat === undefined || input.lng === undefined || Number.isNaN(input.lat) || Number.isNaN(input.lng)) {
    e.coords = 'Latitud y longitud son obligatorias.';
  } else if (!isInsideBolivia(input.lat, input.lng)) {
    e.coords = 'Las coordenadas están fuera del territorio boliviano (WGS84, grados decimales).';
  }
  if (!input.department) e.department = 'Seleccione el departamento.';
  if (!input.municipality?.trim()) e.municipality = 'Indique el municipio.';
  if (!input.miningType || !(input.miningType in MINING_TYPE)) e.miningType = 'Seleccione el tipo de minería.';
  const c = input.classification;
  if (!c || !(c.status in ADMIN_STATUS)) {
    e.status = 'Seleccione la situación administrativa.';
  } else if (c.status !== 'sin_determinar') {
    // Ninguna clasificación distinta de "sin determinar" sin respaldo documental.
    if (!c.sourceDocument?.trim()) e.sourceDocument = 'Toda clasificación requiere el documento de respaldo.';
    if (!c.sourceInstitution?.trim()) e.sourceInstitution = 'Indique la institución que emite el respaldo.';
    if (!c.consultedAt) e.consultedAt = 'Indique la fecha de consulta de la fuente.';
    if (c.status === 'ilegal_verificada' && c.verificationState === 'no_verificado') {
      e.verificationState = '"Ilegal verificada" exige una determinación oficial verificada.';
    }
  }
  const geomError = validateGeometry(input.geometry);
  if (geomError) e.geometry = geomError;
  return e;
}

/**
 * Detección de duplicados: mismo código de derecho minero, o mismo nombre normalizado
 * a menos de 500 m. Devuelve el registro existente que colisiona.
 */
export function findDuplicate(
  candidate: Pick<MiningRecord, 'name' | 'lat' | 'lng' | 'miningRightCode'>,
  existing: MiningRecord[],
  ignoreId?: string
): MiningRecord | undefined {
  const code = candidate.miningRightCode?.trim().toUpperCase();
  const name = normalizeText(candidate.name);
  return existing.find((r) => {
    if (r.id === ignoreId) return false;
    if (code && r.miningRightCode?.trim().toUpperCase() === code) return true;
    return normalizeText(r.name) === name && distanceKm(r.lat, r.lng, candidate.lat, candidate.lng) < 0.5;
  });
}
