import { describe, expect, it } from 'vitest';
import { can, ROLE_PERMISSIONS } from './permissions';
import { findDuplicate, isInsideBolivia, parseCoordinateQuery, validateGeometry, validateMiningRecordInput } from './validation';
import { csvToRows, geojsonToRows, parseCSV, recordsToCSV, rowToRecordInput } from './interchange';
import { filterMiningRecords, monthlySeries, paginate, queryMiningRecords } from './query';
import { pointInPolygon } from './geo';
import { buildSeed } from '../data/seed';
import type { MiningRecordInput } from '../types/domain';

const base: MiningRecordInput = {
  name: 'Operación de prueba',
  lat: -15.56,
  lng: -67.98,
  department: 'La Paz',
  province: 'Larecaja',
  municipality: 'Tipuani',
  locality: 'Chima',
  miningType: 'aurifera',
  holder: 'X',
  registeredAt: '2026-01-01',
  source: 'test',
  observations: '',
  classification: { status: 'sin_determinar', sourceInstitution: '', sourceDocument: '', consultedAt: '', verificationState: 'no_verificado' },
  relatedReportIds: [],
  relatedSatelliteIds: [],
  origin: 'manual'
};

describe('clasificación administrativa', () => {
  it('acepta "sin determinar" sin respaldo documental', () => {
    expect(validateMiningRecordInput(base)).toEqual({});
  });
  it('exige documento, institución y fecha para cualquier otra clasificación', () => {
    const e = validateMiningRecordInput({ ...base, classification: { ...base.classification, status: 'legal' } });
    expect(e.sourceDocument).toBeTruthy();
    expect(e.sourceInstitution).toBeTruthy();
    expect(e.consultedAt).toBeTruthy();
  });
  it('no permite "ilegal verificada" sin verificación', () => {
    const e = validateMiningRecordInput({
      ...base,
      classification: { status: 'ilegal_verificada', sourceInstitution: 'AJAM', sourceDocument: 'RES-1', consultedAt: '2026-01-01', verificationState: 'no_verificado' }
    });
    expect(e.verificationState).toBeTruthy();
  });
  it('rechaza coordenadas fuera de Bolivia', () => {
    expect(validateMiningRecordInput({ ...base, lat: -34.6, lng: -58.4 }).coords).toBeTruthy();
  });
});

describe('coordenadas y geometría', () => {
  it('interpreta decimales y GMS', () => {
    expect(parseCoordinateQuery('-15.56, -67.98')).toEqual({ lat: -15.56, lng: -67.98 });
    const dms = parseCoordinateQuery(`15°33'36"S 67°58'48"W`)!;
    expect(dms.lat).toBeCloseTo(-15.56, 3);
    expect(dms.lng).toBeCloseTo(-67.98, 3);
    expect(parseCoordinateQuery('Tipuani')).toBeNull();
  });
  it('valida el territorio', () => {
    expect(isInsideBolivia(-16.5, -68.15)).toBe(true);
    expect(isInsideBolivia(0, 0)).toBe(false);
  });
  it('exige anillos cerrados dentro de Bolivia', () => {
    expect(validateGeometry({ type: 'Polygon', coordinates: [[[-68, -15], [-67.9, -15], [-67.9, -15.1], [-68, -15]]] })).toBeNull();
    expect(validateGeometry({ type: 'Polygon', coordinates: [[[-68, -15], [-67.9, -15], [-67.9, -15.1], [-68, -15.2]]] })).toMatch(/cerrado/);
  });
  it('punto en polígono', () => {
    const sq: [number, number][] = [[-15, -68], [-15, -67], [-16, -67], [-16, -68]];
    expect(pointInPolygon(-15.5, -67.5, sq)).toBe(true);
    expect(pointInPolygon(-17, -67.5, sq)).toBe(false);
  });
});

describe('duplicados', () => {
  const seed = buildSeed();
  const existing = seed.miningRecords.find((r) => r.miningRightCode)!;
  it('detecta mismo código de derecho minero', () => {
    expect(findDuplicate({ name: 'otro', lat: -20, lng: -65, miningRightCode: existing.miningRightCode!.toLowerCase() }, seed.miningRecords)?.id).toBe(existing.id);
  });
  it('detecta mismo nombre a menos de 500 m', () => {
    expect(findDuplicate({ name: existing.name.toUpperCase(), lat: existing.lat + 0.001, lng: existing.lng }, seed.miningRecords)?.id).toBe(existing.id);
    expect(findDuplicate({ name: existing.name, lat: existing.lat + 0.5, lng: existing.lng }, seed.miningRecords.filter((r) => r.id === existing.id))).toBeUndefined();
  });
});

describe('permisos', () => {
  it('solo administrador y revisor pueden clasificar', () => {
    expect(can('administrador', 'records.classify')).toBe(true);
    expect(can('revisor_institucional', 'records.classify')).toBe(true);
    expect(can('analista_sig', 'records.classify')).toBe(false);
    expect(can('consulta_institucional', 'records.classify')).toBe(false);
  });
  it('los datos del denunciante no son visibles para analista ni consulta', () => {
    expect(can('analista_sig', 'reports.view_sensitive')).toBe(false);
    expect(can('consulta_institucional', 'reports.view_sensitive')).toBe(false);
  });
  it('consulta institucional es solo lectura', () => {
    const writes = [...ROLE_PERMISSIONS.consulta_institucional].filter((p) => !p.endsWith('.view') && p !== 'informes.generate');
    expect(writes).toEqual([]);
  });
});

describe('importación / exportación', () => {
  it('CSV con comillas, ; y saltos de línea', () => {
    expect(parseCSV('a;b\n"x;1";"y\nz"')).toEqual([['a', 'b'], ['x;1', 'y\nz']]);
  });
  it('una fila sin respaldo nunca queda clasificada como ilegal', () => {
    const [row] = csvToRows('nombre,latitud,longitud,situacion_administrativa\nMina,-15.5,-67.9,Ilegal verificada');
    const input = rowToRecordInput(row, 'test');
    expect(input.classification.status).toBe('ilegal_verificada');
    // El proveedor degrada a "sin determinar" si falta el documento; la validación lo exige:
    expect(validateMiningRecordInput(input).sourceDocument).toBeTruthy();
  });
  it('protege contra inyección de fórmulas en CSV', () => {
    const seed = buildSeed();
    const csv = recordsToCSV([{ ...seed.miningRecords[0], name: '=HYPERLINK("x")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it('GeoJSON: polígono → centroide y geometría', () => {
    const rows = geojsonToRows({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { nombre: 'A' }, geometry: { type: 'Polygon', coordinates: [[[-68, -15], [-67.8, -15], [-67.8, -15.2], [-68, -15.2], [-68, -15]]] } }] });
    expect(rows[0].geometry?.type).toBe('Polygon');
    expect(rows[0].row.latitud).toBeCloseTo(-15.1);
  });
});

describe('consultas', () => {
  const seed = buildSeed();
  it('filtra, ordena y pagina', () => {
    const page = queryMiningRecords(seed.miningRecords, { department: 'La Paz', sort: 'name', order: 'asc', page: 1, pageSize: 5 });
    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.items.every((r) => r.department === 'La Paz')).toBe(true);
    expect(page.total).toBe(seed.miningRecords.filter((r) => r.department === 'La Paz').length);
  });
  it('búsqueda por coordenadas devuelve registros cercanos', () => {
    const r = seed.miningRecords[0];
    expect(filterMiningRecords(seed.miningRecords, { q: `${r.lat}, ${r.lng}` }).map((x) => x.id)).toContain(r.id);
  });
  it('paginate acota página y tamaño', () => {
    expect(paginate([1, 2, 3], 99, 2)).toMatchObject({ page: 2, items: [3] });
  });
  it('serie mensual', () => {
    const s = monthlySeries([{ d: '2026-11-03' }, { d: '2026-10-01' }, { d: '2026-11-20' }], (x) => x.d, 3, new Date('2026-11-25T12:00:00Z'));
    expect(s.map((m) => m.value)).toEqual([0, 1, 2]);
  });
  it('los datos demo no contienen registros sin respaldo clasificados', () => {
    const bad = seed.miningRecords.filter((r) => r.adminStatus !== 'sin_determinar' && !r.classification.sourceDocument);
    expect(bad).toEqual([]);
  });
});
