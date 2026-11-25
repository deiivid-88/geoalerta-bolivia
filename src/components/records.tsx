import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, History, Paperclip, Trash2, Upload } from 'lucide-react';
import type { AdminStatus, AuditEntry, ClassificationBasis, Evidence, EvidenceEntity, MiningRecord, MiningRecordInput, MiningType, VerificationState } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { ADMIN_STATUS, ADMIN_STATUS_ORDER, AUDIT_ACTION, MINING_TYPE, MINING_TYPE_ORDER, VERIFICATION_STATE } from '../domain/catalogs';
import { isInsideBolivia, validateMiningRecordInput, type FieldErrors } from '../domain/validation';
import { formatDateTime, todayISO } from '../domain/util';
import { ALLOWED_EVIDENCE_TYPES, formatBytes, MAX_UPLOAD_BYTES } from '../services/files';
import { ServiceError } from '../services';
import { Badge, Button, EmptyState, Field, Input, Modal, Notice, Select, TextArea } from './ui';
import { GeoMap } from './GeoMap';

// ───────────────────────── Formulario de registro ─────────────────────────

type FormState = {
  name: string;
  lat: string;
  lng: string;
  department: string;
  province: string;
  municipality: string;
  locality: string;
  miningType: MiningType;
  mineral: string;
  holder: string;
  miningRightCode: string;
  registeredAt: string;
  source: string;
  observations: string;
  geometryText: string;
  status: AdminStatus;
  sourceInstitution: string;
  sourceDocument: string;
  consultedAt: string;
  verificationState: VerificationState;
};

function toForm(r?: MiningRecord): FormState {
  return {
    name: r?.name ?? '',
    lat: r ? String(r.lat) : '',
    lng: r ? String(r.lng) : '',
    department: r?.department ?? '',
    province: r?.province ?? '',
    municipality: r?.municipality ?? '',
    locality: r?.locality ?? '',
    miningType: r?.miningType ?? 'sin_clasificacion',
    mineral: r?.mineral ?? '',
    holder: r?.holder ?? '',
    miningRightCode: r?.miningRightCode ?? '',
    registeredAt: r?.registeredAt ?? todayISO(),
    source: r?.source ?? '',
    observations: r?.observations ?? '',
    geometryText: r?.geometry ? JSON.stringify(r.geometry) : '',
    status: r?.adminStatus ?? 'sin_determinar',
    sourceInstitution: r?.classification.sourceInstitution ?? '',
    sourceDocument: r?.classification.sourceDocument ?? '',
    consultedAt: r?.classification.consultedAt ?? '',
    verificationState: r?.classification.verificationState ?? 'no_verificado'
  };
}

export const RecordFormModal: React.FC<{ open: boolean; onClose: () => void; record?: MiningRecord; onSaved?: (r: MiningRecord) => void }> = ({ open, onClose, record, onSaved }) => {
  const { mutate } = useData();
  const { can } = useSession();
  const [f, setF] = useState<FormState>(toForm(record));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setF(toForm(record));
      setErrors({});
    }
  }, [open, record]);

  const dept = DEPARTMENTS.find((d) => d.name === f.department);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const canClassify = can('records.classify');
  const lat = parseFloat(f.lat.replace(',', '.'));
  const lng = parseFloat(f.lng.replace(',', '.'));

  const submit = async () => {
    let geometry: MiningRecord['geometry'];
    if (f.geometryText.trim()) {
      try {
        const g = JSON.parse(f.geometryText);
        geometry = g.type === 'Feature' ? g.geometry : g;
      } catch {
        setErrors({ geometry: 'La geometría debe ser GeoJSON válido (Polygon o MultiPolygon).' });
        return;
      }
    }
    const input: MiningRecordInput = {
      name: f.name.trim(),
      lat,
      lng,
      department: f.department,
      province: f.province.trim(),
      municipality: f.municipality.trim(),
      locality: f.locality.trim(),
      miningType: f.miningType,
      mineral: f.mineral.trim() || undefined,
      holder: f.holder.trim() || 'No identificado',
      miningRightCode: f.miningRightCode.trim() || undefined,
      registeredAt: f.registeredAt,
      source: f.source.trim() || 'Registro manual',
      observations: f.observations.trim(),
      geometry,
      classification: {
        status: f.status,
        sourceInstitution: f.sourceInstitution.trim(),
        sourceDocument: f.sourceDocument.trim(),
        consultedAt: f.consultedAt,
        verificationState: f.verificationState
      },
      relatedReportIds: record?.relatedReportIds ?? [],
      relatedSatelliteIds: record?.relatedSatelliteIds ?? [],
      origin: record?.origin ?? 'manual'
    };
    const v = validateMiningRecordInput(input);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const { classification: _c, ...patch } = input;
      const saved = await mutate(
        (p) => (record ? p.miningRecords.update(record.id, patch, record.version) : p.miningRecords.create(input)),
        { success: record ? 'Registro actualizado.' : 'Registro creado.', reload: ['miningRecords'] }
      );
      if (saved) {
        onSaved?.(saved);
        onClose();
      }
    } catch (e) {
      if (e instanceof ServiceError && e.fieldErrors) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={record ? `Editar ${record.id}` : 'Nuevo registro minero'}
      subtitle="Los campos con * son obligatorios. Las coordenadas se expresan en WGS84 (grados decimales)."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {record ? 'Guardar cambios' : 'Crear registro'}
          </Button>
        </>
      }
    >
      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-4">
          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-navy-800 mb-2 col-span-full">Identificación</legend>
            <Field label="Nombre del establecimiento u operación" required error={errors.name} className="sm:col-span-2">
              {(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} />}
            </Field>
            <Field label="Titular u operador registrado">
              {(id) => <Input id={id} value={f.holder} onChange={(e) => set('holder', e.target.value)} placeholder="No identificado" />}
            </Field>
            <Field label="Código / número de derecho minero" hint="Se usa para detectar duplicados.">
              {(id) => <Input id={id} value={f.miningRightCode} onChange={(e) => set('miningRightCode', e.target.value)} />}
            </Field>
            <Field label="Tipo de actividad minera" required error={errors.miningType}>
              {(id) => (
                <Select id={id} value={f.miningType} onChange={(e) => set('miningType', e.target.value as MiningType)}>
                  {MINING_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {MINING_TYPE[t].label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Mineral / material">{(id) => <Input id={id} value={f.mineral} onChange={(e) => set('mineral', e.target.value)} />}</Field>
          </fieldset>

          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-navy-800 mb-2 col-span-full">Ubicación</legend>
            <Field label="Latitud" required error={errors.coords}>
              {(id) => <Input id={id} inputMode="decimal" value={f.lat} onChange={(e) => set('lat', e.target.value)} placeholder="-15.5600" />}
            </Field>
            <Field label="Longitud" required>
              {(id) => <Input id={id} inputMode="decimal" value={f.lng} onChange={(e) => set('lng', e.target.value)} placeholder="-67.9800" />}
            </Field>
            <Field label="Departamento" required error={errors.department}>
              {(id) => (
                <Select id={id} value={f.department} onChange={(e) => setF((p) => ({ ...p, department: e.target.value, municipality: '', province: '' }))}>
                  <option value="">Seleccione…</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.code}>{d.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Municipio" required error={errors.municipality}>
              {(id) => (
                <>
                  <Input
                    id={id}
                    list="ga-municipios"
                    value={f.municipality}
                    onChange={(e) => {
                      const m = dept?.municipalities.find((x) => x.name === e.target.value);
                      setF((p) => ({ ...p, municipality: e.target.value, province: m?.province ?? p.province }));
                    }}
                  />
                  <datalist id="ga-municipios">
                    {dept?.municipalities.map((m) => (
                      <option key={m.name} value={m.name} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Provincia">{(id) => <Input id={id} value={f.province} onChange={(e) => set('province', e.target.value)} />}</Field>
            <Field label="Comunidad o localidad">{(id) => <Input id={id} value={f.locality} onChange={(e) => set('locality', e.target.value)} />}</Field>
            <Field
              label="Geometría del área de operación (GeoJSON, opcional)"
              error={errors.geometry}
              hint='Polygon o MultiPolygon en EPSG:4326, p. ej. {"type":"Polygon","coordinates":[[[lng,lat],…]]}'
              className="sm:col-span-2"
            >
              {(id) => <TextArea id={id} rows={3} className="font-mono text-xs" value={f.geometryText} onChange={(e) => set('geometryText', e.target.value)} />}
            </Field>
          </fieldset>

          <fieldset className="grid sm:grid-cols-2 gap-3">
            <legend className="text-xs font-bold uppercase tracking-wide text-navy-800 mb-2 col-span-full">Fuente y observaciones</legend>
            <Field label="Fuente de información">{(id) => <Input id={id} value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="Registro manual" />}</Field>
            <Field label="Fecha de registro" required>{(id) => <Input id={id} type="date" value={f.registeredAt} onChange={(e) => set('registeredAt', e.target.value)} />}</Field>
            <Field label="Observaciones" className="sm:col-span-2">
              {(id) => <TextArea id={id} rows={3} value={f.observations} onChange={(e) => set('observations', e.target.value)} />}
            </Field>
          </fieldset>

          {!record && (
            <fieldset className="grid sm:grid-cols-2 gap-3 rounded-md border border-ink-200 p-3 bg-ivory-50">
              <legend className="text-xs font-bold uppercase tracking-wide text-navy-800 px-1">Situación administrativa inicial</legend>
              {!canClassify && (
                <Notice className="sm:col-span-2">Su rol registra operaciones como «Sin determinar». La clasificación la asigna un revisor institucional con respaldo documental.</Notice>
              )}
              <ClassificationFields f={f} set={set} errors={errors} disabled={!canClassify} />
            </fieldset>
          )}
          {record && <Notice>La situación administrativa se modifica desde la ficha con «Cambiar clasificación», que exige respaldo documental.</Notice>}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-700">Vista previa de ubicación</p>
          <div className="rounded-md overflow-hidden border border-ink-200">
            <GeoMap
              className="h-72"
              layers={{ departments: true, protectedAreas: true }}
              pin={Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null}
              focus={Number.isFinite(lat) && Number.isFinite(lng) && isInsideBolivia(lat, lng) ? { lat, lng, zoom: 10, key: `${lat},${lng}` } : null}
              onMapClick={(la, ln) => setF((p) => ({ ...p, lat: la.toFixed(5), lng: ln.toFixed(5) }))}
              ariaLabel="Mapa para seleccionar coordenadas"
            />
          </div>
          <p className="text-[11px] text-ink-500">Haga clic en el mapa para tomar las coordenadas, o escríbalas manualmente.</p>
        </div>
      </div>
    </Modal>
  );
};

function ClassificationFields({
  f,
  set,
  errors,
  disabled
}: {
  f: Pick<FormState, 'status' | 'sourceInstitution' | 'sourceDocument' | 'consultedAt' | 'verificationState'>;
  set: (k: 'status' | 'sourceInstitution' | 'sourceDocument' | 'consultedAt' | 'verificationState', v: string) => void;
  errors: FieldErrors;
  disabled?: boolean;
}) {
  return (
    <>
      <Field label="Situación administrativa" required error={errors.status} className="sm:col-span-2">
        {(id) => (
          <Select id={id} value={f.status} disabled={disabled} onChange={(e) => set('status', e.target.value)}>
            {ADMIN_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ADMIN_STATUS[s].label} — {ADMIN_STATUS[s].description}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {f.status !== 'sin_determinar' && (
        <>
          <Field label="Institución que respalda" required error={errors.sourceInstitution}>
            {(id) => <Input id={id} disabled={disabled} value={f.sourceInstitution} onChange={(e) => set('sourceInstitution', e.target.value)} placeholder="p. ej. AJAM" />}
          </Field>
          <Field label="Documento de respaldo" required error={errors.sourceDocument}>
            {(id) => <Input id={id} disabled={disabled} value={f.sourceDocument} onChange={(e) => set('sourceDocument', e.target.value)} placeholder="Resolución / contrato / informe N.º" />}
          </Field>
          <Field label="Fecha de consulta de la fuente" required error={errors.consultedAt}>
            {(id) => <Input id={id} type="date" disabled={disabled} value={f.consultedAt} onChange={(e) => set('consultedAt', e.target.value)} />}
          </Field>
          <Field label="Estado de verificación" error={errors.verificationState}>
            {(id) => (
              <Select id={id} disabled={disabled} value={f.verificationState} onChange={(e) => set('verificationState', e.target.value)}>
                {Object.entries(VERIFICATION_STATE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}
    </>
  );
}

// ───────────────────────── Clasificación ─────────────────────────

export const ClassifyModal: React.FC<{ open: boolean; onClose: () => void; record: MiningRecord }> = ({ open, onClose, record }) => {
  const { mutate } = useData();
  const [f, setF] = useState({
    status: record.adminStatus,
    sourceInstitution: record.classification.sourceInstitution,
    sourceDocument: record.classification.sourceDocument,
    consultedAt: record.classification.consultedAt || todayISO(),
    verificationState: record.classification.verificationState,
    notes: ''
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const submit = async () => {
    const basis: Omit<ClassificationBasis, 'determinedBy' | 'determinedAt'> = { ...f, notes: f.notes.trim() || undefined };
    const v = validateMiningRecordInput({ ...record, classification: basis });
    const relevant = Object.fromEntries(Object.entries(v).filter(([k]) => ['status', 'sourceDocument', 'sourceInstitution', 'consultedAt', 'verificationState'].includes(k)));
    setErrors(relevant);
    if (Object.keys(relevant).length) return;
    setBusy(true);
    try {
      const ok = await mutate((p) => p.miningRecords.classify(record.id, basis, record.version), { success: 'Clasificación actualizada y registrada en el historial.', reload: ['miningRecords'] });
      if (ok) onClose();
    } catch (e) {
      if (e instanceof ServiceError && e.fieldErrors) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Cambiar clasificación administrativa"
      subtitle={`${record.id} · ${record.name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Registrar clasificación
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Notice tone="warning">
          No clasifique una actividad como ilegal solo porque no aparezca en una base de datos. «Ilegal verificada» exige una determinación o registro
          oficial; ante indicios sin determinación use «Presuntamente irregular».
        </Notice>
        <div className="grid sm:grid-cols-2 gap-3">
          <ClassificationFields f={f} set={(k, v) => setF((p) => ({ ...p, [k]: v }))} errors={errors} />
          <Field label="Notas de la determinación" className="sm:col-span-2">
            {(id) => <TextArea id={id} rows={2} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />}
          </Field>
        </div>
      </div>
    </Modal>
  );
};

// ───────────────────────── Evidencias ─────────────────────────

/** Imagen protegida: en modo API se descarga con el token de sesión. */
export const AuthImage: React.FC<{ src?: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const { provider } = useData();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    let created: string | undefined;
    if (src) {
      provider.evidences
        .objectUrl(src)
        .then((u) => {
          created = u.startsWith('blob:') ? u : undefined;
          if (alive) setUrl(u);
        })
        .catch(() => alive && setUrl(undefined));
    }
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, provider]);
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`${className ?? ''} bg-ink-100`} aria-label={alt} />;
};

/** Descarga autenticada de un archivo. */
export async function openEvidence(provider: ReturnType<typeof useData>['provider'], url: string, fileName: string) {
  const u = await provider.evidences.objectUrl(url);
  const a = document.createElement('a');
  a.href = u;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (u.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(u), 30000);
}

const DOC_TYPES: { value: Evidence['docType']; label: string }[] = [
  { value: 'resolucion', label: 'Resolución' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'informe_tecnico', label: 'Informe técnico' },
  { value: 'acta', label: 'Acta de inspección' },
  { value: 'fotografia', label: 'Fotografía' },
  { value: 'imagen_satelital', label: 'Imagen satelital' },
  { value: 'otro', label: 'Otro' }
];

export const EvidencePanel: React.FC<{ entityType: EvidenceEntity; entityId: string; evidences: Evidence[]; reload: ('miningRecords' | 'satellites')[] }> = ({ entityType, entityId, evidences, reload }) => {
  const { mutate, provider } = useData();
  const { can } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<Evidence['docType']>('informe_tecnico');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const allowed = can('evidence.upload');

  const upload = async () => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return setErr('El archivo supera 15 MB.');
    if (file.type && !ALLOWED_EVIDENCE_TYPES.includes(file.type)) return setErr('Formato no permitido. Use PDF, imagen (JPG/PNG/WebP), Word o texto.');
    setErr('');
    setBusy(true);
    const ok = await mutate((p) => p.evidences.upload(entityType, entityId, file, { title: title.trim() || file.name, docType }), { success: 'Evidencia adjuntada.', reload });
    setBusy(false);
    if (ok) {
      setFile(null);
      setTitle('');
    }
  };

  return (
    <div className="space-y-3">
      {evidences.length === 0 ? (
        <EmptyState title="Sin evidencias documentales adjuntas." icon={<Paperclip className="w-6 h-6" />} />
      ) : (
        <ul className="divide-y divide-ink-100 border border-ink-200 rounded-md">
          {evidences.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              {e.mimeType.startsWith('image/') && (e.dataUrl || e.url) ? (
                <AuthImage src={e.dataUrl ?? e.url} alt="" className="w-10 h-10 object-cover rounded border border-ink-200" />
              ) : (
                <FileText className="w-8 h-8 text-ink-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-navy-900 truncate">{e.title}</div>
                <div className="text-[11px] text-ink-500 truncate">
                  {DOC_TYPES.find((d) => d.value === e.docType)?.label} · {e.fileName} · {formatBytes(e.sizeBytes)} · {e.uploadedBy} · {formatDateTime(e.uploadedAt)}
                </div>
                {e.sha256 && <div className="text-[10px] text-ink-400 font-mono truncate" title="Huella SHA-256 para verificar integridad">SHA-256 {e.sha256}</div>}
              </div>
              {(e.url || e.dataUrl) && (
                <button
                  type="button"
                  onClick={() => openEvidence(provider, (e.dataUrl ?? e.url)!, e.fileName).catch((err) => setErr(err.message))}
                  className="p-1.5 rounded hover:bg-ink-100 text-navy-800"
                  aria-label={`Descargar ${e.title}`}
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {allowed && (
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-coral-50 text-coral-700"
                  aria-label={`Retirar ${e.title}`}
                  onClick={() => window.confirm(`¿Retirar la evidencia «${e.title}»? La acción queda registrada.`) && mutate((p) => p.evidences.remove(e), { success: 'Evidencia retirada.', reload })}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {allowed && (
        <div className="grid sm:grid-cols-[1fr_160px_1fr_auto] gap-2 items-end rounded-md border border-dashed border-ink-300 p-3">
          <Field label="Archivo (PDF, imagen, Word · máx. 15 MB)">
            {(id) => <input id={id} type="file" accept={ALLOWED_EVIDENCE_TYPES.join(',')} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs w-full" />}
          </Field>
          <Field label="Tipo">
            {(id) => (
              <Select id={id} value={docType} onChange={(e) => setDocType(e.target.value as Evidence['docType'])}>
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Título descriptivo">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Button variant="accent" icon={<Upload className="w-4 h-4" />} onClick={upload} disabled={!file} loading={busy}>
            Adjuntar
          </Button>
          {err && <p className="text-xs text-coral-700 sm:col-span-4">{err}</p>}
        </div>
      )}
    </div>
  );
};

// ───────────────────────── Historial ─────────────────────────

export const HistoryPanel: React.FC<{ entityId: string; refreshKey?: unknown }> = ({ entityId, refreshKey }) => {
  const { provider } = useData();
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    provider.audit
      .list({ entityId })
      .then((r) => alive && setItems(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [provider, entityId, refreshKey]);

  if (err) return <Notice tone="danger">{err}</Notice>;
  if (!items) return <p className="text-xs text-ink-500">Cargando historial…</p>;
  if (!items.length) return <EmptyState title="Sin modificaciones registradas." icon={<History className="w-6 h-6" />} />;
  return <AuditTimeline items={items} />;
};

export const AuditTimeline: React.FC<{ items: AuditEntry[] }> = ({ items }) => (
  <ol className="relative border-l-2 border-ink-200 ml-2 space-y-3">
    {items.map((a) => (
      <li key={a.id} className="ml-4">
        <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-white border-2 border-teal-700" aria-hidden />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
          <span className="font-semibold text-navy-900">{AUDIT_ACTION[a.action]}</span>
          <span>{formatDateTime(a.timestamp)}</span>
          <span>·</span>
          <span>{a.userName}</span>
        </div>
        <p className="text-sm text-ink-800">{a.summary}</p>
        {a.changes && a.changes.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {a.changes.map((c, i) => (
              <li key={i} className="text-[11px] text-ink-600">
                <span className="font-mono">{c.field}</span>: <span className="line-through text-ink-400">{c.from}</span> → <strong className="text-ink-800">{c.to}</strong>
              </li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ol>
);

export const StatusBadge: React.FC<{ status: AdminStatus }> = ({ status }) => (
  <Badge className={ADMIN_STATUS[status].badge} dot={ADMIN_STATUS[status].color} title={ADMIN_STATUS[status].description}>
    {ADMIN_STATUS[status].label}
  </Badge>
);

export const VerificationBadge: React.FC<{ state: VerificationState }> = ({ state }) => <Badge className={VERIFICATION_STATE[state].badge}>{VERIFICATION_STATE[state].label}</Badge>;

/** Sugiere registros cercanos (≤ radio km) para vincular. */
export function useNearbyRecords(lat: number, lng: number, radiusKm = 25) {
  const { miningRecords } = useData();
  return useMemo(() => {
    const R = 6371;
    return miningRecords
      .map((r) => {
        const dLat = ((r.lat - lat) * Math.PI) / 180;
        const dLng = ((r.lng - lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((r.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return { r, d: 2 * R * Math.asin(Math.sqrt(a)) };
      })
      .filter((x) => x.d <= radiusKm)
      .sort((a, b) => a.d - b.d);
  }, [miningRecords, lat, lng, radiusKm]);
}
