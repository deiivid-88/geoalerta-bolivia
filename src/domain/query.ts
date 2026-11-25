import type { MiningRecord, MiningRecordQuery, Page } from '../types/domain';
import { parseCoordinateQuery } from './validation';
import { distanceKm, normalizeText } from './util';

export { distanceKm, normalizeText };

/** Coincidencia de texto libre por nombre, identificador, código de derecho, titular o localidad. */
export function matchesText(record: MiningRecord, q: string): boolean {
  const needle = normalizeText(q);
  if (!needle) return true;
  const haystack = normalizeText(
    [
      record.id,
      record.name,
      record.miningRightCode ?? '',
      record.holder,
      record.municipality,
      record.locality,
      record.province
    ].join(' ')
  );
  return haystack.includes(needle);
}

export function filterMiningRecords(records: MiningRecord[], q: MiningRecordQuery): MiningRecord[] {
  const coords = q.q ? parseCoordinateQuery(q.q) : null;
  return records.filter((r) => {
    if (q.department && r.department !== q.department) return false;
    if (q.province && r.province !== q.province) return false;
    if (q.municipality && r.municipality !== q.municipality) return false;
    if (q.miningType && r.miningType !== q.miningType) return false;
    if (q.adminStatus && r.adminStatus !== q.adminStatus) return false;
    if (q.verificationState && r.classification.verificationState !== q.verificationState) return false;
    if (q.dateFrom && r.registeredAt < q.dateFrom) return false;
    if (q.dateTo && r.registeredAt > q.dateTo) return false;
    if (q.q) {
      // Búsqueda por coordenadas: registros a ≤ 10 km del punto.
      if (coords) return distanceKm(coords.lat, coords.lng, r.lat, r.lng) <= 10;
      if (!matchesText(r, q.q)) return false;
    }
    return true;
  });
}

export function sortBy<T>(items: T[], key: keyof T | undefined, order: 'asc' | 'desc' = 'asc'): T[] {
  if (!key) return items;
  const dir = order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'es', { numeric: true }) * dir;
  });
}

export function paginate<T>(items: T[], page = 1, pageSize = 25): Page<T> {
  const safeSize = Math.min(Math.max(1, pageSize), 500);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), total: items.length, page: safePage, pageSize: safeSize };
}

export function queryMiningRecords(records: MiningRecord[], q: MiningRecordQuery): Page<MiningRecord> {
  const filtered = filterMiningRecords(records, q);
  const sorted = sortBy(filtered, q.sort ?? 'updatedAt', q.order ?? 'desc');
  return paginate(sorted, q.page, q.pageSize);
}

/** Cuenta elementos por clave, preservando un orden de categorías opcional. */
export function countBy<T, K extends string>(items: T[], key: (item: T) => K, order?: K[]): { key: K; count: number }[] {
  const map = new Map<K, number>();
  order?.forEach((k) => map.set(k, 0));
  items.forEach((it) => {
    const k = key(it);
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([k, count]) => ({ key: k, count }));
}

/** Serie mensual (YYYY-MM) de los últimos `months` meses hasta `reference`. */
export function monthlySeries<T>(
  items: T[],
  getDate: (item: T) => string,
  months: number,
  reference: Date = new Date(),
  getValue: (item: T) => number = () => 1
): { month: string; label: string; value: number }[] {
  const out: { month: string; label: string; value: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - i, 1));
    const month = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('es-BO', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    out.push({ month, label, value: 0 });
  }
  const index = new Map(out.map((o, i) => [o.month, i]));
  items.forEach((it) => {
    const idx = index.get(getDate(it).slice(0, 7));
    if (idx !== undefined) out[idx].value += getValue(it);
  });
  return out;
}
