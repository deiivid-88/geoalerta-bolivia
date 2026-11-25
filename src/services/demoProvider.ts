/**
 * Proveedor DEMO: toda la información vive en el navegador (localStorage).
 * Reproduce las reglas del backend (permisos, validación, duplicados, versión optimista,
 * auditoría) para que la interfaz se comporte igual en ambos modos.
 * NO es un mecanismo de seguridad: cualquier usuario del navegador puede leer localStorage.
 */
import type {
  AuditEntry,
  CitizenReport,
  Evidence,
  FieldChange,
  ImportResult,
  MiningRecord,
  PublicReportView,
  Session,
  User
} from '../types/domain';
import { buildSeed, DEMO_PASSWORD, type SeedData } from '../data/seed';
import { can, type Permission } from '../domain/permissions';
import { queryMiningRecords } from '../domain/query';
import { findDuplicate, isInsideBolivia, validateMiningRecordInput } from '../domain/validation';
import { csvToRows, geojsonToRows, rowToRecordInput } from '../domain/interchange';
import { ADMIN_STATUS, REPORT_STATUS, REVIEW_STATE, ALERT_STATUS } from '../domain/catalogs';
import { compressImage, readAsDataURL, readAsText, sha256Hex, MAX_UPLOAD_BYTES } from './files';
import { ServiceError, type DataProvider } from './types';

const STORE_KEY = 'geoalerta.demo.v1';
const SESSION_KEY = 'geoalerta.session';
const SESSION_HOURS = 8;

interface DemoState extends SeedData {
  passwordHashes: Record<string, string>;
}

const nowISO = () => new Date().toISOString().slice(0, 19);
const today = () => nowISO().slice(0, 10);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function createDemoProvider(storage: Storage = window.localStorage): DataProvider {
  let state: DemoState | null = null;
  let session: Session | null = null;

  async function load(): Promise<DemoState> {
    if (state) return state;
    const raw = storage.getItem(STORE_KEY);
    if (raw) {
      try {
        state = JSON.parse(raw) as DemoState;
        return state;
      } catch {
        storage.removeItem(STORE_KEY);
      }
    }
    const seed = buildSeed();
    const hash = await sha256Hex(`geoalerta:${DEMO_PASSWORD}`);
    state = { ...seed, passwordHashes: Object.fromEntries(seed.users.map((u) => [u.id, hash])) };
    persist();
    return state;
  }

  function persist() {
    if (!state) return;
    try {
      storage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      throw new ServiceError(
        'El almacenamiento local del navegador está lleno. En modo demo los adjuntos ocupan espacio: elimine algunos o restablezca los datos demostrativos.',
        507
      );
    }
  }

  function requireSession(permission?: Permission): Session {
    if (!session) throw new ServiceError('La sesión expiró. Vuelva a iniciar sesión.', 401);
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session = null;
      sessionStorage.removeItem(SESSION_KEY);
      throw new ServiceError('La sesión expiró. Vuelva a iniciar sesión.', 401);
    }
    if (permission && !can(session.user.role, permission)) {
      throw new ServiceError('Su rol no tiene permiso para realizar esta acción.', 403);
    }
    return session;
  }

  function audit(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'userId' | 'userName' | 'userRole'>, actor?: Session | 'ciudadano') {
    const s = state!;
    const isCitizen = actor === 'ciudadano';
    const who = isCitizen ? null : (actor ?? session);
    s.audit.unshift({
      id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowISO(),
      userId: who?.user.id ?? 'ANON',
      userName: who?.user.name ?? 'Ciudadanía (anónimo)',
      userRole: who?.user.role ?? 'ciudadano',
      ...entry
    });
  }

  function nextId(prefix: string, existing: string[], width = 6): string {
    const re = new RegExp(`^${prefix}(\\d+)$`);
    const max = existing.reduce((m, id) => {
      const mm = id.match(re);
      return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
    }, 0);
    return `${prefix}${String(max + 1).padStart(width, '0')}`;
  }

  function diff<T extends object>(before: T, after: T, fields: (keyof T)[]): FieldChange[] {
    return fields
      .filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]))
      .map((f) => ({ field: String(f), from: fmt(before[f]), to: fmt(after[f]) }));
  }
  const fmt = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v));

  function findRecord(id: string): MiningRecord {
    const r = state!.miningRecords.find((x) => x.id === id);
    if (!r) throw new ServiceError(`No existe el registro ${id}.`, 404);
    return r;
  }

  function checkVersion(r: MiningRecord, expected: number) {
    if (r.version !== expected) {
      throw new ServiceError('Otro usuario modificó este registro mientras lo editaba. Recargue la ficha y vuelva a aplicar sus cambios.', 409);
    }
  }

  const provider: DataProvider = {
    mode: 'demo',

    auth: {
      async login(email, password) {
        const s = await load();
        const user = s.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        const hash = await sha256Hex(`geoalerta:${password}`);
        // Mismo mensaje para usuario inexistente o contraseña incorrecta (no revela cuentas).
        if (!user || s.passwordHashes[user.id] !== hash) throw new ServiceError('Credenciales incorrectas.', 401);
        if (!user.active) throw new ServiceError('La cuenta está desactivada. Contacte al administrador.', 403);
        user.lastLoginAt = nowISO();
        session = { user: clone(user), expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString() };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        audit({ action: 'iniciar_sesion', entityType: 'sesion', entityId: user.id, summary: 'Inicio de sesión (modo demo).' });
        persist();
        return clone(session);
      },
      async logout() {
        session = null;
        sessionStorage.removeItem(SESSION_KEY);
      },
      async restore() {
        await load();
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        try {
          const s = JSON.parse(raw) as Session;
          const user = state!.users.find((u) => u.id === s.user.id);
          if (!user || !user.active || new Date(s.expiresAt).getTime() < Date.now()) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
          }
          session = { ...s, user: clone(user) };
          return clone(session);
        } catch {
          return null;
        }
      }
    },

    miningRecords: {
      async query(q) {
        requireSession('records.view');
        return clone(queryMiningRecords((await load()).miningRecords, q));
      },
      async all() {
        requireSession('records.view');
        return clone((await load()).miningRecords);
      },
      async get(id) {
        requireSession('records.view');
        await load();
        return clone(findRecord(id));
      },
      async create(input) {
        const sess = requireSession('records.create');
        const s = await load();
        if (input.classification.status !== 'sin_determinar' && !can(sess.user.role, 'records.classify')) {
          throw new ServiceError('Su rol solo puede crear registros "Sin determinar". La clasificación la asigna un revisor.', 403);
        }
        const errors = validateMiningRecordInput(input);
        if (Object.keys(errors).length) throw new ServiceError('Revise los campos marcados.', 422, errors as Record<string, string>);
        const dup = findDuplicate(input, s.miningRecords);
        if (dup) throw new ServiceError(`Posible duplicado de ${dup.id} (${dup.name}). Revise el registro existente.`, 409);
        const ts = nowISO();
        const record: MiningRecord = {
          ...input,
          id: nextId('GA-MIN-', s.miningRecords.map((r) => r.id)),
          adminStatus: input.classification.status,
          classification: { ...input.classification, determinedBy: sess.user.name, determinedAt: ts },
          updatedAt: today(),
          evidences: [],
          version: 1
        };
        s.miningRecords.unshift(record);
        audit({ action: 'crear', entityType: 'registro_minero', entityId: record.id, summary: `Registro creado: ${record.name} (${ADMIN_STATUS[record.adminStatus].label}).` });
        persist();
        return clone(record);
      },
      async update(id, patch, expectedVersion) {
        requireSession('records.edit');
        const s = await load();
        const r = findRecord(id);
        checkVersion(r, expectedVersion);
        const next: MiningRecord = { ...r, ...patch } as MiningRecord;
        const errors = validateMiningRecordInput({ ...next, classification: next.classification });
        if (Object.keys(errors).length) throw new ServiceError('Revise los campos marcados.', 422, errors as Record<string, string>);
        const dup = findDuplicate(next, s.miningRecords, id);
        if (dup) throw new ServiceError(`El cambio genera un posible duplicado de ${dup.id}.`, 409);
        const changes = diff(r, next, ['name', 'lat', 'lng', 'department', 'province', 'municipality', 'locality', 'miningType', 'mineral', 'holder', 'miningRightCode', 'source', 'observations', 'geometry']);
        if (!changes.length) return clone(r);
        next.updatedAt = today();
        next.version = r.version + 1;
        Object.assign(r, next);
        audit({ action: 'actualizar', entityType: 'registro_minero', entityId: id, summary: `Actualización de ${changes.length} campo(s).`, changes });
        persist();
        return clone(r);
      },
      async classify(id, basis, expectedVersion) {
        const sess = requireSession('records.classify');
        await load();
        const r = findRecord(id);
        checkVersion(r, expectedVersion);
        const errors = validateMiningRecordInput({ ...r, classification: basis });
        if (Object.keys(errors).length) throw new ServiceError('La clasificación requiere respaldo documental.', 422, errors as Record<string, string>);
        const before = r.adminStatus;
        r.classification = { ...basis, determinedBy: sess.user.name, determinedAt: nowISO() };
        r.adminStatus = basis.status;
        r.updatedAt = today();
        r.version += 1;
        audit({
          action: 'clasificar',
          entityType: 'registro_minero',
          entityId: id,
          summary: `Clasificación respaldada en "${basis.sourceDocument || 'sin documento'}" (${basis.sourceInstitution || '—'}).`,
          changes: [{ field: 'situacion_administrativa', from: ADMIN_STATUS[before].label, to: ADMIN_STATUS[basis.status].label }]
        });
        persist();
        return clone(r);
      },
      async remove(id, reason) {
        requireSession('records.delete');
        const s = await load();
        const r = findRecord(id);
        if (!reason.trim()) throw new ServiceError('Indique el motivo de la eliminación.', 422);
        s.miningRecords = s.miningRecords.filter((x) => x.id !== id);
        audit({ action: 'eliminar', entityType: 'registro_minero', entityId: id, summary: `Eliminado "${r.name}". Motivo: ${reason}` });
        persist();
      },
      async importFile(file, options) {
        requireSession('records.import');
        const s = await load();
        if (options.format === 'xlsx' || options.format === 'shapefile') {
          throw new ServiceError('La importación de Excel y Shapefile la procesa el backend (GDAL/openpyxl). Active el modo API o convierta el archivo a CSV/GeoJSON.', 501);
        }
        const text = await readAsText(file);
        const rows =
          options.format === 'csv'
            ? csvToRows(text).map((row) => ({ row, geometry: undefined }))
            : geojsonToRows(JSON.parse(text));
        const result: ImportResult = { created: 0, skippedDuplicates: 0, errors: [] };
        rows.forEach(({ row, geometry }, i) => {
          const input = { ...rowToRecordInput(row, options.sourceLabel), geometry };
          // La importación nunca asigna una clasificación sin respaldo: si falta, queda "Sin determinar".
          if (input.classification.status !== 'sin_determinar' && (!input.classification.sourceDocument || !input.classification.consultedAt)) {
            input.classification = { ...input.classification, status: 'sin_determinar', verificationState: 'no_verificado' };
          }
          const errors = validateMiningRecordInput(input);
          if (Object.keys(errors).length) {
            result.errors.push({ row: i + 2, message: Object.values(errors).join(' ') });
            return;
          }
          if (findDuplicate(input, s.miningRecords)) {
            result.skippedDuplicates++;
            return;
          }
          const ts = nowISO();
          s.miningRecords.unshift({
            ...input,
            id: nextId('GA-MIN-', s.miningRecords.map((r) => r.id)),
            adminStatus: input.classification.status,
            classification: { ...input.classification, determinedBy: `Importación ${options.format.toUpperCase()}`, determinedAt: ts },
            updatedAt: today(),
            evidences: [],
            version: 1
          });
          result.created++;
        });
        audit({ action: 'importar', entityType: 'registro_minero', entityId: file.name, summary: `Importación ${options.format.toUpperCase()}: ${result.created} creados, ${result.skippedDuplicates} duplicados omitidos, ${result.errors.length} con errores.` });
        persist();
        return result;
      }
    },

    evidences: {
      async upload(entityType, entityId, file, meta) {
        const sess = requireSession('evidence.upload');
        const s = await load();
        if (file.size > MAX_UPLOAD_BYTES) throw new ServiceError('El archivo supera el máximo de 15 MB.', 413);
        const isImage = file.type.startsWith('image/');
        let dataUrl: string | undefined;
        if (isImage) dataUrl = await compressImage(file);
        else if (file.size <= 400 * 1024) dataUrl = await readAsDataURL(file);
        const evidence: Evidence = {
          id: `EVD-${Date.now().toString(36)}`,
          entityType,
          entityId,
          title: meta.title || file.name,
          docType: meta.docType,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          sha256: await sha256Hex(await file.arrayBuffer()),
          uploadedAt: nowISO(),
          uploadedBy: sess.user.name,
          dataUrl
        };
        const target =
          entityType === 'registro_minero'
            ? s.miningRecords.find((r) => r.id === entityId)
            : entityType === 'observacion'
              ? s.satellites.find((r) => r.id === entityId)
              : undefined;
        if (!target) throw new ServiceError('No se encontró el elemento al que adjuntar la evidencia.', 404);
        target.evidences.push(evidence);
        audit({ action: 'adjuntar', entityType: entityType === 'registro_minero' ? 'registro_minero' : 'observacion', entityId, summary: `Evidencia adjuntada: ${evidence.title} (${file.name}).` });
        persist();
        return clone(evidence);
      },
      async remove(evidence) {
        requireSession('evidence.upload');
        const s = await load();
        const list = evidence.entityType === 'registro_minero' ? s.miningRecords : s.satellites;
        const target = (list as { id: string; evidences: Evidence[] }[]).find((r) => r.id === evidence.entityId);
        if (target) target.evidences = target.evidences.filter((e) => e.id !== evidence.id);
        audit({ action: 'eliminar', entityType: evidence.entityType === 'registro_minero' ? 'registro_minero' : 'observacion', entityId: evidence.entityId, summary: `Evidencia retirada: ${evidence.title}.` });
        persist();
      },
      async objectUrl(url) {
        return url; // en modo demo los archivos ya son data: URLs
      }
    },

    reports: {
      async all() {
        const sess = requireSession('reports.view');
        const s = await load();
        const canSeeSensitive = can(sess.user.role, 'reports.view_sensitive');
        return clone(s.reports).map((r) => (canSeeSensitive ? r : { ...r, contactInfo: r.contactInfo ? '••• (restringido)' : undefined }));
      },
      async submitPublic(input) {
        const s = await load();
        if (!isInsideBolivia(input.lat, input.lng)) throw new ServiceError('La ubicación indicada está fuera de Bolivia.', 422);
        if (input.description.trim().length < 10) throw new ServiceError('Describa brevemente lo observado (mín. 10 caracteres).', 422);
        const year = new Date().getFullYear();
        const trackingCode = nextId(`GA-DEN-${year}-`, s.reports.map((r) => r.trackingCode));
        const ts = nowISO();
        const report: CitizenReport = {
          ...input,
          contactInfo: input.confidentiality === 'confidencial' ? input.contactInfo?.trim() || undefined : undefined,
          id: nextId('DEN-', s.reports.map((r) => r.id), 3),
          trackingCode,
          createdAt: ts,
          updatedAt: ts,
          status: 'recibido',
          publicNote: 'Su denuncia fue recibida y está en fila para revisión inicial.',
          origin: 'manual'
        };
        s.reports.unshift(report);
        audit({ action: 'crear', entityType: 'denuncia', entityId: trackingCode, summary: `Denuncia ciudadana recibida en ${report.department} (${report.confidentiality}).` }, 'ciudadano');
        persist();
        return { trackingCode };
      },
      async track(code) {
        const s = await load();
        const r = s.reports.find((x) => x.trackingCode.toUpperCase() === code.trim().toUpperCase());
        if (!r) return null;
        const view: PublicReportView = {
          trackingCode: r.trackingCode,
          category: r.category,
          department: r.department,
          municipality: r.municipality,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          status: r.status,
          publicNote: r.publicNote,
          assignedInstitution: r.assignedInstitution
        };
        return view;
      },
      async updateStatus(id, change) {
        requireSession('reports.review');
        const s = await load();
        const r = s.reports.find((x) => x.id === id);
        if (!r) throw new ServiceError('Denuncia no encontrada.', 404);
        if (!change.internalNote.trim()) throw new ServiceError('Registre una nota interna que justifique el cambio.', 422);
        const before = r.status;
        r.status = change.status;
        r.publicNote = change.publicNote;
        r.assignedInstitution = change.assignedInstitution || undefined;
        r.updatedAt = nowISO();
        audit({
          action: change.status === 'derivado_institucion' ? 'derivar' : 'cambiar_estado',
          entityType: 'denuncia',
          entityId: r.trackingCode,
          summary: change.internalNote,
          changes: [{ field: 'estado', from: REPORT_STATUS[before].label, to: REPORT_STATUS[change.status].label }]
        });
        persist();
        return clone(r);
      },
      async link(id, links) {
        requireSession('reports.review');
        const s = await load();
        const r = s.reports.find((x) => x.id === id);
        if (!r) throw new ServiceError('Denuncia no encontrada.', 404);
        const changes: FieldChange[] = [];
        if (links.relatedMiningRecordId !== undefined) {
          const prev = r.relatedMiningRecordId;
          if (prev) {
            const old = s.miningRecords.find((m) => m.id === prev);
            if (old) old.relatedReportIds = old.relatedReportIds.filter((x) => x !== id);
          }
          r.relatedMiningRecordId = links.relatedMiningRecordId ?? undefined;
          if (r.relatedMiningRecordId) {
            const rec = findRecord(r.relatedMiningRecordId);
            if (!rec.relatedReportIds.includes(id)) rec.relatedReportIds.push(id);
          }
          changes.push({ field: 'registro_minero', from: prev ?? '—', to: r.relatedMiningRecordId ?? '—' });
        }
        if (links.relatedSatelliteId !== undefined) {
          const prev = r.relatedSatelliteId;
          r.relatedSatelliteId = links.relatedSatelliteId ?? undefined;
          if (r.relatedSatelliteId && !s.satellites.some((x) => x.id === r.relatedSatelliteId)) throw new ServiceError('Observación no encontrada.', 404);
          s.satellites.forEach((sat) => {
            sat.relatedReportIds = sat.relatedReportIds.filter((x) => x !== id);
            if (sat.id === r.relatedSatelliteId) sat.relatedReportIds.push(id);
          });
          changes.push({ field: 'observacion_satelital', from: prev ?? '—', to: r.relatedSatelliteId ?? '—' });
        }
        audit({ action: 'vincular', entityType: 'denuncia', entityId: r.trackingCode, summary: 'Vinculación de denuncia actualizada.', changes });
        persist();
        return clone(r);
      }
    },

    satellites: {
      async all() {
        requireSession('satellite.view');
        return clone((await load()).satellites);
      },
      async create(input) {
        const sess = requireSession('satellite.create');
        const s = await load();
        if (!isInsideBolivia(input.lat, input.lng)) throw new ServiceError('Coordenadas fuera de Bolivia.', 422);
        if (!(input.approxAreaHa >= 0)) throw new ServiceError('Superficie estimada inválida.', 422);
        const year = input.acquisitionDate.slice(0, 4);
        const obs = {
          ...input,
          id: nextId(`GA-SAT-${year}-M`, s.satellites.map((x) => x.id), 4),
          evidences: [],
          createdAt: nowISO(),
          createdBy: sess.user.name,
          dataOrigin: 'manual' as const
        };
        obs.relatedMiningRecordIds.forEach((rid) => {
          const rec = s.miningRecords.find((m) => m.id === rid);
          if (rec && !rec.relatedSatelliteIds.includes(obs.id)) rec.relatedSatelliteIds.push(obs.id);
        });
        s.satellites.unshift(obs);
        audit({ action: 'crear', entityType: 'observacion', entityId: obs.id, summary: `Observación registrada (${obs.origin === 'automatizada' ? 'automatizada' : 'interpretación manual'}).` });
        persist();
        return clone(obs);
      },
      async review(id, reviewState, note) {
        requireSession('satellite.review');
        const s = await load();
        const o = s.satellites.find((x) => x.id === id);
        if (!o) throw new ServiceError('Observación no encontrada.', 404);
        if (!note.trim()) throw new ServiceError('Registre una nota técnica.', 422);
        const before = o.reviewState;
        o.reviewState = reviewState;
        audit({ action: 'cambiar_estado', entityType: 'observacion', entityId: id, summary: note, changes: [{ field: 'estado_revision', from: REVIEW_STATE[before].label, to: REVIEW_STATE[reviewState].label }] });
        persist();
        return clone(o);
      },
      async verifyDocumental(id, v) {
        const sess = requireSession('satellite.verify_documental');
        const s = await load();
        const o = s.satellites.find((x) => x.id === id);
        if (!o) throw new ServiceError('Observación no encontrada.', 404);
        if (!v.document.trim() || !v.institution.trim()) throw new ServiceError('Indique documento e institución de respaldo.', 422);
        o.documentalVerification = { ...v, verifiedBy: sess.user.name, verifiedAt: nowISO() };
        audit({ action: 'actualizar', entityType: 'observacion', entityId: id, summary: `Verificación documental: ${v.result} — ${v.document} (${v.institution}).` });
        persist();
        return clone(o);
      },
      async link(id, links) {
        requireSession('satellite.review');
        const s = await load();
        const o = s.satellites.find((x) => x.id === id);
        if (!o) throw new ServiceError('Observación no encontrada.', 404);
        if (links.relatedMiningRecordIds) {
          s.miningRecords.forEach((m) => {
            m.relatedSatelliteIds = m.relatedSatelliteIds.filter((x) => x !== id);
            if (links.relatedMiningRecordIds!.includes(m.id)) m.relatedSatelliteIds.push(id);
          });
          o.relatedMiningRecordIds = links.relatedMiningRecordIds;
        }
        if (links.relatedReportIds) o.relatedReportIds = links.relatedReportIds;
        audit({ action: 'vincular', entityType: 'observacion', entityId: id, summary: `Vínculos: ${o.relatedMiningRecordIds.length} registro(s), ${o.relatedReportIds.length} denuncia(s).` });
        persist();
        return clone(o);
      }
    },

    alerts: {
      async all() {
        requireSession('alerts.view');
        return clone((await load()).alerts);
      },
      async create(input) {
        const sess = requireSession('alerts.manage');
        const s = await load();
        if (!input.title.trim()) throw new ServiceError('Indique un título.', 422);
        const year = new Date().getFullYear();
        const ts = nowISO();
        const alert = { ...input, id: nextId(`GA-ALR-${year}-`, s.alerts.map((a) => a.id)), createdAt: ts, updatedAt: ts, createdBy: sess.user.name, origin: 'manual' as const };
        s.alerts.unshift(alert);
        audit({ action: 'crear', entityType: 'alerta', entityId: alert.id, summary: alert.title });
        persist();
        return clone(alert);
      },
      async updateStatus(id, status, note, derivedTo) {
        requireSession(status === 'derivada' ? 'alerts.derive' : 'alerts.manage');
        const s = await load();
        const a = s.alerts.find((x) => x.id === id);
        if (!a) throw new ServiceError('Alerta no encontrada.', 404);
        if (status === 'derivada' && !derivedTo) throw new ServiceError('Seleccione la institución a la que se deriva.', 422);
        const before = a.status;
        a.status = status;
        a.derivedTo = derivedTo ?? a.derivedTo;
        a.updatedAt = nowISO();
        audit({ action: status === 'derivada' ? 'derivar' : 'cambiar_estado', entityType: 'alerta', entityId: id, summary: note || '—', changes: [{ field: 'estado', from: ALERT_STATUS[before].label, to: ALERT_STATUS[status].label }] });
        persist();
        return clone(a);
      }
    },

    sources: {
      async all() {
        requireSession('sources.view');
        return clone((await load()).sources);
      },
      async documents() {
        requireSession('sources.view');
        return clone((await load()).sourceDocuments);
      },
      async update(id, patch) {
        requireSession('sources.manage');
        const s = await load();
        const src = s.sources.find((x) => x.id === id);
        if (!src) throw new ServiceError('Fuente no encontrada.', 404);
        const changes = diff(src, { ...src, ...patch }, ['availability', 'updatedAt', 'reference', 'referenceUrl', 'usageConditions', 'notes']);
        Object.assign(src, patch);
        audit({ action: 'actualizar', entityType: 'fuente', entityId: id, summary: `Fuente ${src.acronym} actualizada.`, changes });
        persist();
        return clone(src);
      }
    },

    users: {
      async all() {
        requireSession('admin.users');
        return clone((await load()).users);
      },
      async create(input) {
        requireSession('admin.users');
        const s = await load();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) throw new ServiceError('Correo electrónico inválido.', 422);
        if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ServiceError('Ya existe un usuario con ese correo.', 409);
        if (input.password.length < 12) throw new ServiceError('La contraseña debe tener al menos 12 caracteres.', 422);
        const { password, ...rest } = input;
        const user: User = { ...rest, id: nextId('USR-', s.users.map((u) => u.id), 3), createdAt: nowISO() };
        s.users.push(user);
        s.passwordHashes[user.id] = await sha256Hex(`geoalerta:${password}`);
        audit({ action: 'crear', entityType: 'usuario', entityId: user.id, summary: `Usuario ${user.email} creado con rol ${user.role}.` });
        persist();
        return clone(user);
      },
      async update(id, patch) {
        const sess = requireSession('admin.users');
        const s = await load();
        const u = s.users.find((x) => x.id === id);
        if (!u) throw new ServiceError('Usuario no encontrado.', 404);
        if (id === sess.user.id && (patch.active === false || (patch.role && patch.role !== 'administrador'))) {
          throw new ServiceError('No puede desactivar ni quitarse el rol de administrador a sí mismo.', 422);
        }
        const { password, ...rest } = patch;
        const changes = diff(u, { ...u, ...rest }, ['name', 'role', 'institution', 'active']);
        Object.assign(u, rest);
        if (password) {
          if (password.length < 12) throw new ServiceError('La contraseña debe tener al menos 12 caracteres.', 422);
          s.passwordHashes[id] = await sha256Hex(`geoalerta:${password}`);
          changes.push({ field: 'contraseña', from: '•••', to: 'restablecida' });
        }
        audit({ action: 'actualizar', entityType: 'usuario', entityId: id, summary: `Usuario ${u.email} actualizado.`, changes });
        persist();
        return clone(u);
      }
    },

    audit: {
      async list(filter) {
        const sess = requireSession();
        const s = await load();
        // Historial de una entidad concreta: visible para quien puede ver la entidad.
        // Bitácora completa: solo con permiso audit.view.
        if (!filter?.entityId && !can(sess.user.role, 'audit.view')) throw new ServiceError('Sin permiso para consultar la bitácora.', 403);
        let items = s.audit;
        if (filter?.entityType) items = items.filter((a) => a.entityType === filter.entityType);
        if (filter?.entityId) items = items.filter((a) => a.entityId === filter.entityId);
        return clone(items.slice(0, filter?.limit ?? 500));
      },
      async logClientEvent(entry) {
        requireSession();
        await load();
        audit(entry);
        persist();
      }
    }
  };

  return provider;
}

/** Borra los datos demostrativos del navegador (se regeneran al recargar). */
export function resetDemoData(storage: Storage = window.localStorage) {
  storage.removeItem(STORE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
