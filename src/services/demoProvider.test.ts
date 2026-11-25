import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProvider } from './demoProvider';
import { DEMO_PASSWORD } from '../data/seed';
import { ServiceError } from './types';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v))
  };
}

const newProvider = () => createDemoProvider(memoryStorage());

describe('proveedor demo', () => {
  beforeEach(() => sessionStorage.clear());

  it('rechaza credenciales incorrectas y cuentas desactivadas', async () => {
    const p = newProvider();
    await expect(p.auth.login('admin@demo.geoalerta.bo', 'mala')).rejects.toThrow('Credenciales incorrectas');
    await expect(p.auth.login('noexiste@demo.geoalerta.bo', DEMO_PASSWORD)).rejects.toThrow('Credenciales incorrectas');
    await expect(p.auth.login('baja@demo.geoalerta.bo', DEMO_PASSWORD)).rejects.toThrow('desactivada');
  });

  it('exige sesión para datos institucionales', async () => {
    const p = newProvider();
    await expect(p.miningRecords.all()).rejects.toBeInstanceOf(ServiceError);
  });

  it('el analista no puede clasificar; el revisor sí, y queda auditado', async () => {
    const p = newProvider();
    await p.auth.login('analista@demo.geoalerta.bo', DEMO_PASSWORD);
    const [rec] = await p.miningRecords.all();
    const basis = { status: 'legal' as const, sourceInstitution: 'AJAM', sourceDocument: 'Contrato 1', consultedAt: '2026-11-01', verificationState: 'verificado_documental' as const };
    await expect(p.miningRecords.classify(rec.id, basis, rec.version)).rejects.toMatchObject({ status: 403 });

    await p.auth.login('revisor@demo.geoalerta.bo', DEMO_PASSWORD);
    const updated = await p.miningRecords.classify(rec.id, basis, rec.version);
    expect(updated.adminStatus).toBe('legal');
    expect(updated.version).toBe(rec.version + 1);
    const hist = await p.audit.list({ entityId: rec.id });
    expect(hist[0].action).toBe('clasificar');
    expect(hist[0].userName).toContain('Revisor');
  });

  it('control de versiones: rechaza ediciones sobre una versión antigua', async () => {
    const p = newProvider();
    await p.auth.login('admin@demo.geoalerta.bo', DEMO_PASSWORD);
    const [rec] = await p.miningRecords.all();
    await p.miningRecords.update(rec.id, { observations: 'cambio 1' }, rec.version);
    await expect(p.miningRecords.update(rec.id, { observations: 'cambio 2' }, rec.version)).rejects.toMatchObject({ status: 409 });
  });

  it('impide crear duplicados', async () => {
    const p = newProvider();
    await p.auth.login('admin@demo.geoalerta.bo', DEMO_PASSWORD);
    const [rec] = await p.miningRecords.all();
    const { id: _id, version: _v, evidences: _e, updatedAt: _u, adminStatus: _a, ...rest } = rec;
    await expect(p.miningRecords.create({ ...rest, classification: { ...rec.classification } })).rejects.toMatchObject({ status: 409 });
  });

  it('denuncia pública: código único y seguimiento sin datos personales', async () => {
    const p = newProvider();
    const input = {
      category: 'actividad_minera' as const,
      department: 'La Paz',
      municipality: 'Tipuani',
      community: 'Chima',
      locationDescription: 'Río',
      lat: -15.56,
      lng: -67.98,
      observedWhenPreset: 'hoy' as const,
      observedDate: '2026-11-25',
      description: 'Se observan dragas trabajando en el río.',
      photos: [],
      confidentiality: 'confidencial' as const,
      contactInfo: '70000000'
    };
    const a = await p.reports.submitPublic(input);
    const b = await p.reports.submitPublic(input);
    expect(a.trackingCode).not.toBe(b.trackingCode);
    expect(a.trackingCode).toMatch(/^GA-DEN-\d{4}-\d{6}$/);
    const view = await p.reports.track(a.trackingCode.toLowerCase());
    expect(view?.status).toBe('recibido');
    expect(JSON.stringify(view)).not.toContain('70000000');
    expect(view).not.toHaveProperty('lat');

    // El analista ve la denuncia, pero no el contacto.
    await p.auth.login('analista@demo.geoalerta.bo', DEMO_PASSWORD);
    const asAnalyst = (await p.reports.all()).find((r) => r.trackingCode === a.trackingCode)!;
    expect(asAnalyst.contactInfo).not.toBe('70000000');
    await p.auth.login('revisor@demo.geoalerta.bo', DEMO_PASSWORD);
    const asReviewer = (await p.reports.all()).find((r) => r.trackingCode === a.trackingCode)!;
    expect(asReviewer.contactInfo).toBe('70000000');
  });

  it('importa CSV omitiendo duplicados y degradando clasificaciones sin respaldo', async () => {
    const p = newProvider();
    await p.auth.login('analista@demo.geoalerta.bo', DEMO_PASSWORD);
    const csv = [
      'nombre,latitud,longitud,departamento,municipio,tipo_mineria,situacion_administrativa',
      'Mina Nueva Uno,-15.40,-67.90,La Paz,Guanay,aurifera,Ilegal verificada',
      'Mina Nueva Uno,-15.40,-67.90,La Paz,Guanay,aurifera,',
      'Fuera,-34.6,-58.4,La Paz,Guanay,aurifera,'
    ].join('\n');
    const file = new File([csv], 'datos.csv', { type: 'text/csv' });
    const r = await p.miningRecords.importFile(file, { format: 'csv', sourceLabel: 'Prueba' });
    expect(r.created).toBe(1);
    expect(r.skippedDuplicates).toBe(1);
    expect(r.errors).toHaveLength(1);
    const created = (await p.miningRecords.query({ q: 'Mina Nueva Uno' })).items[0];
    expect(created.adminStatus).toBe('sin_determinar');
  });

  it('la consulta institucional no puede modificar nada', async () => {
    const p = newProvider();
    await p.auth.login('consulta@demo.geoalerta.bo', DEMO_PASSWORD);
    const [rec] = await p.miningRecords.all();
    await expect(p.miningRecords.update(rec.id, { name: 'x' }, rec.version)).rejects.toMatchObject({ status: 403 });
    await expect(p.audit.list()).rejects.toMatchObject({ status: 403 });
  });
});
