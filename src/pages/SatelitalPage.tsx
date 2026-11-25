import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, FileCheck2, Link2, Plus, Satellite, User as UserRound } from 'lucide-react';
import type { ConfidenceLevel, DocumentalVerification, ObservationOrigin, ReviewState, SatelliteObservation, SatelliteObservationType } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { navigate } from '../app/router';
import { GeoMap } from '../components/GeoMap';
import { EvidencePanel, HistoryPanel, StatusBadge, useNearbyRecords } from '../components/records';
import { SatelliteComparator } from '../components/SatelliteComparator';
import { Badge, Button, Card, DataTable, DemoBadge, DL, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, Tabs, TextArea, type Column } from '../components/ui';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { CONFIDENCE, DOC_VERIFICATION_RESULT, OBSERVATION_ORIGIN, OBSERVATION_TYPE, REVIEW_STATE, SENSOR } from '../domain/catalogs';
import { formatCoord, formatDate, formatDateTime, todayISO } from '../domain/util';
import { isInsideBolivia } from '../domain/validation';

export const SatelitalPage: React.FC<{ id?: string }> = ({ id }) => (id ? <ObservationDetail id={id} /> : <ObservationList />);

const ObservationList: React.FC = () => {
  const { satellites } = useData();
  const { can } = useSession();
  const [origin, setOrigin] = useState<ObservationOrigin | ''>('');
  const [type, setType] = useState<SatelliteObservationType | ''>('');
  const [review, setReview] = useState<ReviewState | ''>('');
  const [department, setDepartment] = useState('');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(
    () => satellites.filter((s) => (!origin || s.origin === origin) && (!type || s.observationType === type) && (!review || s.reviewState === review) && (!department || s.department === department)),
    [satellites, origin, type, review, department]
  );

  const columns: Column<SatelliteObservation>[] = [
    { key: 'id', header: 'ID', render: (s) => <span className="font-mono text-xs text-navy-800">{s.id}</span>, sortValue: (s) => s.id },
    {
      key: 'origin',
      header: 'Origen',
      render: (s) => (
        <Badge className={OBSERVATION_ORIGIN[s.origin].badge}>
          {s.origin === 'automatizada' ? <Bot className="w-3 h-3" /> : <UserRound className="w-3 h-3" />} {s.origin === 'automatizada' ? 'Automatizada' : 'Analista'}
        </Badge>
      ),
      sortValue: (s) => s.origin
    },
    { key: 'type', header: 'Tipo de cambio', render: (s) => <div className="text-xs"><div className="font-semibold text-navy-900">{OBSERVATION_TYPE[s.observationType]}</div><div className="text-ink-500">{SENSOR[s.sensor]}</div></div>, sortValue: (s) => s.observationType },
    { key: 'loc', header: 'Ubicación', render: (s) => <div className="text-xs"><div>{s.municipality}</div><div className="text-ink-500">{s.department}</div></div>, sortValue: (s) => s.department },
    { key: 'area', header: 'Sup. (ha)', render: (s) => <span className="tabular-nums text-xs">{s.approxAreaHa}</span>, sortValue: (s) => s.approxAreaHa, hideOnMobile: true },
    { key: 'conf', header: 'Confianza', render: (s) => <Badge className={CONFIDENCE[s.confidence].badge}>{CONFIDENCE[s.confidence].label.replace('Confianza ', '')}</Badge>, sortValue: (s) => ['alta', 'media', 'baja'].indexOf(s.confidence), hideOnMobile: true },
    { key: 'review', header: 'Revisión', render: (s) => <Badge className={REVIEW_STATE[s.reviewState].badge}>{REVIEW_STATE[s.reviewState].label}</Badge>, sortValue: (s) => s.reviewState },
    { key: 'doc', header: 'Verif. documental', render: (s) => (s.documentalVerification ? <FileCheck2 className="w-4 h-4 text-teal-700" aria-label="Con verificación documental" /> : <span className="text-[11px] text-ink-400">Pendiente</span>), hideOnMobile: true },
    { key: 'date', header: 'Adquisición', render: (s) => <span className="text-xs whitespace-nowrap">{formatDate(s.acquisitionDate)}</span>, sortValue: (s) => s.acquisitionDate }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Observaciones satelitales"
        description="Historial de cambios territoriales detectados o interpretados sobre imágenes satelitales. Una observación no es una verificación documental."
        actions={can('satellite.create') && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>Registrar observación</Button>}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <Notice>
          <strong>Detección automatizada:</strong> resultado de un algoritmo de cambio (marcador con borde discontinuo). Requiere interpretación de un analista.
        </Notice>
        <Notice>
          <strong>Verificación documental:</strong> contraste posterior con un documento institucional. Se registra por separado y nunca la genera el sensor.
        </Notice>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select aria-label="Origen" value={origin} onChange={(e) => setOrigin(e.target.value as ObservationOrigin)}>
          <option value="">Origen: todos</option>
          <option value="automatizada">Detección automatizada</option>
          <option value="interpretacion_manual">Interpretación de analista</option>
        </Select>
        <Select aria-label="Tipo de cambio" value={type} onChange={(e) => setType(e.target.value as SatelliteObservationType)}>
          <option value="">Tipo: todos</option>
          {Object.entries(OBSERVATION_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Estado de revisión" value={review} onChange={(e) => setReview(e.target.value as ReviewState)}>
          <option value="">Revisión: todas</option>
          {Object.entries(REVIEW_STATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select aria-label="Departamento" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Departamento: todos</option>
          {DEPARTMENTS.map((d) => <option key={d.code}>{d.name}</option>)}
        </Select>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/satelital/${s.id}`)} initialSort={{ key: 'date', order: 'desc' }} />
      <CreateObservationModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
};

const ObservationDetail: React.FC<{ id: string }> = ({ id }) => {
  const { satellites, reports, miningRecords, mutate } = useData();
  const { can } = useSession();
  const o = satellites.find((s) => s.id === id);
  const nearby = useNearbyRecords(o?.lat ?? 0, o?.lng ?? 0, 20);
  const [tab, setTab] = useState<'detalle' | 'comparador' | 'evidencias' | 'historial'>('detalle');
  const [reviewState, setReviewState] = useState<ReviewState>('en_interpretacion');
  const [note, setNote] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => o && setReviewState(o.reviewState), [o?.id, o?.reviewState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!o) return <Card><EmptyState title="Observación no encontrada." icon={<Satellite className="w-6 h-6" />} /></Card>;
  const linkedRecords = miningRecords.filter((m) => o.relatedMiningRecordIds.includes(m.id));
  const linkedReports = reports.filter((r) => o.relatedReportIds.includes(r.id) || r.relatedSatelliteId === o.id);

  const toggleRecord = async (recId: string) => {
    const next = o.relatedMiningRecordIds.includes(recId) ? o.relatedMiningRecordIds.filter((x) => x !== recId) : [...o.relatedMiningRecordIds, recId];
    const ok = await mutate((p) => p.satellites.link(o.id, { relatedMiningRecordIds: next }), { success: 'Vínculos actualizados.', reload: ['satellites', 'miningRecords'] });
    if (ok) setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={<a href="#/satelital" className="inline-flex items-center gap-1 hover:text-navy-900"><ArrowLeft className="w-3 h-3" /> Observaciones satelitales</a>}
        title={o.zoneName}
        description={
          <span className="flex flex-wrap items-center gap-2 mt-1">
            <span className="font-mono text-xs text-navy-800">{o.id}</span>
            <Badge className={OBSERVATION_ORIGIN[o.origin].badge}>{OBSERVATION_ORIGIN[o.origin].label}</Badge>
            <Badge className={REVIEW_STATE[o.reviewState].badge}>{REVIEW_STATE[o.reviewState].label}</Badge>
            <Badge className={CONFIDENCE[o.confidence].badge}>{CONFIDENCE[o.confidence].label}</Badge>
            <DemoBadge show={o.dataOrigin === 'demo'} />
          </span>
        }
      />
      <div className="grid xl:grid-cols-[1fr_400px] gap-3">
        <div className="space-y-3 min-w-0">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'detalle', label: 'Detalle y revisión' }, { id: 'comparador', label: 'Comparación temporal' }, { id: 'evidencias', label: `Evidencia visual (${o.evidences.length})` }, { id: 'historial', label: 'Historial' }]} />
          {tab === 'detalle' && (
            <>
              <Card title="Datos de la observación" subtitle={OBSERVATION_ORIGIN[o.origin].description}>
                <DL
                  items={[
                    ['Tipo de observación', OBSERVATION_TYPE[o.observationType]],
                    ['Sensor', SENSOR[o.sensor]],
                    ['Fecha de adquisición', formatDate(o.acquisitionDate)],
                    ['Fecha de comparación', formatDate(o.comparisonDate)],
                    ['Superficie estimada', `${o.approxAreaHa} ha`],
                    ['Nivel de confianza', CONFIDENCE[o.confidence].label],
                    ['Registrada por', `${o.createdBy} · ${formatDateTime(o.createdAt)}`],
                    ['Ubicación', `${o.municipality} · ${o.department}`]
                  ]}
                />
                <div className="mt-3 pt-3 border-t border-ink-100">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Descripción del cambio territorial</div>
                  <p className="text-sm text-ink-800">{o.changeDescription}</p>
                </div>
              </Card>

              {can('satellite.review') && (
                <Card title="Revisión técnica (interpretación)">
                  <div className="grid sm:grid-cols-[220px_1fr_auto] gap-2 items-end">
                    <Field label="Estado de revisión">
                      {(fid) => (
                        <Select id={fid} value={reviewState} onChange={(e) => setReviewState(e.target.value as ReviewState)}>
                          {Object.entries(REVIEW_STATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </Select>
                      )}
                    </Field>
                    <Field label="Nota técnica (obligatoria)">{(fid) => <Input id={fid} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
                    <Button
                      variant="primary"
                      disabled={!note.trim() || reviewState === o.reviewState}
                      onClick={async () => {
                        const ok = await mutate((p) => p.satellites.review(o.id, reviewState, note), { success: 'Revisión registrada.', reload: ['satellites'] });
                        if (ok) {
                          setNote('');
                          setVersion((v) => v + 1);
                        }
                      }}
                    >
                      Registrar
                    </Button>
                  </div>
                </Card>
              )}

              <Card
                title="Verificación documental"
                subtitle="Contraste con documentación institucional. Independiente del resultado del sensor."
                actions={can('satellite.verify_documental') && <Button size="sm" icon={<FileCheck2 className="w-3.5 h-3.5" />} onClick={() => setVerifying(true)}>{o.documentalVerification ? 'Actualizar' : 'Registrar verificación'}</Button>}
              >
                {o.documentalVerification ? (
                  <DL
                    items={[
                      ['Resultado', DOC_VERIFICATION_RESULT[o.documentalVerification.result]],
                      ['Documento', o.documentalVerification.document],
                      ['Institución', o.documentalVerification.institution],
                      ['Verificado por', `${o.documentalVerification.verifiedBy} · ${formatDateTime(o.documentalVerification.verifiedAt)}`],
                      ['Notas', o.documentalVerification.notes]
                    ]}
                  />
                ) : (
                  <p className="text-sm text-ink-500">Sin verificación documental registrada.</p>
                )}
              </Card>

              <Card title="Posibles relaciones con registros mineros" subtitle="Registros a ≤ 20 km. Vincular no modifica la clasificación del registro.">
                {linkedReports.length > 0 && (
                  <p className="text-xs text-ink-600 mb-2">
                    Denuncias relacionadas: {linkedReports.map((r) => <a key={r.id} href={`#/denuncias/${r.id}`} className="text-teal-800 underline font-mono mr-2">{r.trackingCode}</a>)}
                  </p>
                )}
                {nearby.length === 0 && linkedRecords.length === 0 ? (
                  <p className="text-sm text-ink-500">No hay registros mineros cercanos.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {[...linkedRecords.filter((m) => !nearby.some((n) => n.r.id === m.id)).map((r) => ({ r, d: NaN })), ...nearby].slice(0, 12).map(({ r, d }) => {
                      const linked = o.relatedMiningRecordIds.includes(r.id);
                      return (
                        <li key={r.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                          <a href={`#/registros/${r.id}`} className="text-teal-800 underline">{r.name}</a>
                          <StatusBadge status={r.adminStatus} />
                          <span className="text-xs text-ink-500">{Number.isNaN(d) ? '' : `${d.toFixed(1)} km`}</span>
                          {can('satellite.review') && (
                            <Button size="sm" className="ml-auto" variant={linked ? 'secondary' : 'ghost'} icon={<Link2 className="w-3 h-3" />} onClick={() => toggleRecord(r.id)}>
                              {linked ? 'Desvincular' : 'Vincular'}
                            </Button>
                          )}
                          {!can('satellite.review') && linked && <Badge className="ml-auto">Vinculado</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </>
          )}
          {tab === 'comparador' && <SatelliteComparator observation={o} />}
          {tab === 'evidencias' && (
            <Card title="Evidencia visual" subtitle="Recortes de imagen, mapas o informes que respaldan la observación.">
              <EvidencePanel entityType="observacion" entityId={o.id} evidences={o.evidences} reload={['satellites']} />
            </Card>
          )}
          {tab === 'historial' && (
            <Card title="Historial de la observación">
              <HistoryPanel entityId={o.id} refreshKey={version} />
            </Card>
          )}
        </div>
        <Card title="Ubicación" bodyClassName="p-0">
          <GeoMap className="h-80" satellites={[o]} records={nearby.map((n) => n.r)} reports={linkedReports} selected={{ kind: 'satellite', id: o.id }} focus={{ lat: o.lat, lng: o.lng, zoom: 11, key: o.id }} onSelect={(s) => s.kind === 'record' && navigate(`/registros/${s.id}`)} />
          <div className="p-4"><DL cols={1} items={[['Coordenadas', <span key="c" className="font-mono text-xs">{formatCoord(o.lat, o.lng)}</span>]]} /></div>
        </Card>
      </div>
      {verifying && <VerifyModal obsId={o.id} current={o.documentalVerification} onClose={() => { setVerifying(false); setVersion((v) => v + 1); }} />}
    </div>
  );
};

const VerifyModal: React.FC<{ obsId: string; current?: DocumentalVerification; onClose: () => void }> = ({ obsId, current, onClose }) => {
  const { mutate } = useData();
  const [f, setF] = useState({ result: current?.result ?? 'no_concluyente', document: current?.document ?? '', institution: current?.institution ?? '', notes: current?.notes ?? '' });
  return (
    <Modal
      open
      onClose={onClose}
      title="Verificación documental"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!f.document.trim() || !f.institution.trim()} onClick={async () => (await mutate((p) => p.satellites.verifyDocumental(obsId, f as Omit<DocumentalVerification, 'verifiedBy' | 'verifiedAt'>), { success: 'Verificación registrada.', reload: ['satellites'] })) && onClose()}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Resultado">
          {(id) => (
            <Select id={id} value={f.result} onChange={(e) => setF({ ...f, result: e.target.value as DocumentalVerification['result'] })}>
              {Object.entries(DOC_VERIFICATION_RESULT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Documento consultado" required>{(id) => <Input id={id} value={f.document} onChange={(e) => setF({ ...f, document: e.target.value })} />}</Field>
        <Field label="Institución" required>{(id) => <Input id={id} value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />}</Field>
        <Field label="Notas">{(id) => <TextArea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
        <Notice tone="warning">«Sin respaldo documental localizado» no equivale a ilegalidad: indica que no se encontró documentación en las fuentes consultadas.</Notice>
      </div>
    </Modal>
  );
};

const CreateObservationModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { mutate } = useData();
  const empty = { sensor: 'sentinel2' as SatelliteObservation['sensor'], origin: 'interpretacion_manual' as ObservationOrigin, observationType: 'remocion_vegetacion' as SatelliteObservationType, acquisitionDate: todayISO(), comparisonDate: '', department: '', municipality: '', zoneName: '', lat: '', lng: '', approxAreaHa: '', confidence: 'media' as ConfidenceLevel, changeDescription: '' };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) {
      setF(empty);
      setErr('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const lat = parseFloat(f.lat);
  const lng = parseFloat(f.lng);
  const dept = DEPARTMENTS.find((d) => d.name === f.department);
  const nearby = useNearbyRecords(Number.isFinite(lat) ? lat : 0, Number.isFinite(lng) ? lng : 0, 10);
  const [linkIds, setLinkIds] = useState<string[]>([]);

  const submit = async () => {
    if (!isInsideBolivia(lat, lng)) return setErr('Coordenadas inválidas o fuera de Bolivia.');
    if (!f.department || !f.municipality.trim() || !f.changeDescription.trim()) return setErr('Complete departamento, municipio y descripción del cambio.');
    const area = parseFloat(f.approxAreaHa);
    if (!(area >= 0)) return setErr('Indique la superficie estimada en hectáreas.');
    const ok = await mutate(
      (p) =>
        p.satellites.create({
          sensor: f.sensor,
          origin: f.origin,
          observationType: f.observationType,
          acquisitionDate: f.acquisitionDate,
          comparisonDate: f.comparisonDate || undefined,
          department: f.department,
          municipality: f.municipality.trim(),
          zoneName: f.zoneName.trim() || `Sector ${f.municipality.trim()}`,
          lat,
          lng,
          approxAreaHa: area,
          confidence: f.confidence,
          reviewState: 'pendiente_revision',
          changeDescription: f.changeDescription.trim(),
          relatedReportIds: [],
          relatedMiningRecordIds: linkIds,
          beforeScene: f.observationType === 'acopio_relaves' ? 'highland_tailings' : f.observationType === 'sedimentos' || f.observationType === 'alteracion_cauce' ? 'river_meander' : 'forest_clearing'
        }),
      { success: 'Observación registrada.', reload: ['satellites', 'miningRecords'] }
    );
    if (ok) {
      onClose();
      navigate(`/satelital/${ok.id}`);
    }
  };
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Registrar observación satelital" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit}>Registrar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Origen">
          {(id) => (
            <Select id={id} value={f.origin} onChange={(e) => set('origin', e.target.value)}>
              <option value="interpretacion_manual">Interpretación de analista</option>
              <option value="automatizada">Detección automatizada (importada de un algoritmo)</option>
            </Select>
          )}
        </Field>
        <Field label="Sensor">{(id) => <Select id={id} value={f.sensor} onChange={(e) => set('sensor', e.target.value)}>{Object.entries(SENSOR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Tipo de observación">{(id) => <Select id={id} value={f.observationType} onChange={(e) => set('observationType', e.target.value)}>{Object.entries(OBSERVATION_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Nivel de confianza">{(id) => <Select id={id} value={f.confidence} onChange={(e) => set('confidence', e.target.value)}>{Object.entries(CONFIDENCE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>}</Field>
        <Field label="Fecha de adquisición" required>{(id) => <Input id={id} type="date" value={f.acquisitionDate} onChange={(e) => set('acquisitionDate', e.target.value)} />}</Field>
        <Field label="Fecha de imagen de comparación">{(id) => <Input id={id} type="date" value={f.comparisonDate} onChange={(e) => set('comparisonDate', e.target.value)} />}</Field>
        <Field label="Latitud" required>{(id) => <Input id={id} value={f.lat} onChange={(e) => set('lat', e.target.value)} placeholder="-15.55" />}</Field>
        <Field label="Longitud" required>{(id) => <Input id={id} value={f.lng} onChange={(e) => set('lng', e.target.value)} placeholder="-67.97" />}</Field>
        <Field label="Departamento" required>{(id) => <Select id={id} value={f.department} onChange={(e) => set('department', e.target.value)}><option value="">Seleccione…</option>{DEPARTMENTS.map((d) => <option key={d.code}>{d.name}</option>)}</Select>}</Field>
        <Field label="Municipio" required>
          {(id) => (
            <>
              <Input id={id} list="sat-mun" value={f.municipality} onChange={(e) => set('municipality', e.target.value)} />
              <datalist id="sat-mun">{dept?.municipalities.map((m) => <option key={m.name} value={m.name} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Nombre de la zona">{(id) => <Input id={id} value={f.zoneName} onChange={(e) => set('zoneName', e.target.value)} />}</Field>
        <Field label="Superficie estimada (ha)" required>{(id) => <Input id={id} inputMode="decimal" value={f.approxAreaHa} onChange={(e) => set('approxAreaHa', e.target.value)} />}</Field>
        <Field label="Descripción del cambio territorial" required className="sm:col-span-2">{(id) => <TextArea id={id} value={f.changeDescription} onChange={(e) => set('changeDescription', e.target.value)} />}</Field>
        {nearby.length > 0 && (
          <fieldset className="sm:col-span-2 border border-ink-200 rounded-md p-3">
            <legend className="text-xs font-semibold px-1">Posibles relaciones (registros a ≤ 10 km)</legend>
            {nearby.slice(0, 6).map(({ r, d }) => (
              <label key={r.id} className="flex items-center gap-2 text-xs py-0.5">
                <input type="checkbox" className="accent-teal-700" checked={linkIds.includes(r.id)} onChange={() => setLinkIds((l) => (l.includes(r.id) ? l.filter((x) => x !== r.id) : [...l, r.id]))} />
                {r.name} · {d.toFixed(1)} km
              </label>
            ))}
          </fieldset>
        )}
        {err && <Notice tone="danger" className="sm:col-span-2">{err}</Notice>}
      </div>
    </Modal>
  );
};
