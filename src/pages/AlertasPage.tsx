import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Siren } from 'lucide-react';
import type { AlertPriority, AlertStatus, AlertType, EntityRef, TerritorialAlert } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { buildQuery, navigate, useRoute } from '../app/router';
import { GeoMap } from '../components/GeoMap';
import { HistoryPanel } from '../components/records';
import { Badge, Button, Card, DataTable, DemoBadge, DL, EmptyState, Field, Input, Modal, Notice, PageHeader, Select, TextArea, type Column } from '../components/ui';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { ALERT_PRIORITY, ALERT_STATUS, ALERT_TYPE, INSTITUTIONS_FOR_DERIVATION } from '../domain/catalogs';
import { formatDate, formatDateTime } from '../domain/util';
import { isInsideBolivia } from '../domain/validation';

const REF_LINK: Record<EntityRef['type'], (id: string) => string> = {
  registro_minero: (id) => `#/registros/${id}`,
  denuncia: (id) => `#/denuncias/${id}`,
  observacion: (id) => `#/satelital/${id}`
};
const REF_LABEL: Record<EntityRef['type'], string> = { registro_minero: 'Registro', denuncia: 'Denuncia', observacion: 'Observación' };

export const AlertasPage: React.FC = () => {
  const route = useRoute();
  const { alerts } = useData();
  const { can } = useSession();
  const status = (route.query.get('estado') ?? '') as AlertStatus | '';
  const selectedId = route.query.get('id') ?? '';
  const [priority, setPriority] = useState<AlertPriority | ''>('');
  const [type, setType] = useState<AlertType | ''>('');
  const [creating, setCreating] = useState(false);
  const setQ = (params: Record<string, string>) => navigate(`/alertas${buildQuery({ estado: status, id: selectedId, ...params })}`, { replace: true });

  const rows = useMemo(() => alerts.filter((a) => (!status || a.status === status) && (!priority || a.priority === priority) && (!type || a.type === type)), [alerts, status, priority, type]);
  const selected = alerts.find((a) => a.id === selectedId);

  const columns: Column<TerritorialAlert>[] = [
    { key: 'p', header: 'Prioridad', render: (a) => <Badge className={ALERT_PRIORITY[a.priority].badge}>{ALERT_PRIORITY[a.priority].label.replace('Prioridad ', '')}</Badge>, sortValue: (a) => ['alta', 'media', 'baja'].indexOf(a.priority) },
    { key: 't', header: 'Alerta', render: (a) => <div><div className="font-semibold text-navy-900 flex items-center gap-1.5">{a.title} <DemoBadge show={a.origin === 'demo'} /></div><div className="text-[11px] text-ink-500">{ALERT_TYPE[a.type]} · {a.id}</div></div>, sortValue: (a) => a.title },
    { key: 'l', header: 'Ubicación', render: (a) => <span className="text-xs">{a.municipality} · {a.department}</span>, sortValue: (a) => a.department, hideOnMobile: true },
    { key: 's', header: 'Estado', render: (a) => <Badge className={ALERT_STATUS[a.status].badge}>{ALERT_STATUS[a.status].label}</Badge>, sortValue: (a) => a.status },
    { key: 'd', header: 'Creada', render: (a) => <span className="text-xs whitespace-nowrap">{formatDate(a.createdAt)}</span>, sortValue: (a) => a.createdAt }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Alertas territoriales"
        description="Situaciones que requieren atención institucional. Una alerta señala prioridad de revisión, no una determinación de ilegalidad."
        actions={can('alerts.manage') && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>Nueva alerta</Button>}
      />
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Estado" value={status} onChange={(e) => setQ({ estado: e.target.value })} className="w-44">
          <option value="">Estado: todos</option>
          {Object.entries(ALERT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select aria-label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as AlertPriority)} className="w-44">
          <option value="">Prioridad: todas</option>
          {Object.entries(ALERT_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value as AlertType)} className="w-56">
          <option value="">Tipo: todos</option>
          {Object.entries(ALERT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <div className="grid xl:grid-cols-[1fr_420px] gap-3 items-start">
        <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} selectedKey={selectedId} onRowClick={(a) => setQ({ id: a.id })} initialSort={{ key: 'p', order: 'asc' }} />
        {selected ? <AlertDetail alert={selected} /> : <Card><EmptyState title="Seleccione una alerta para ver su detalle y gestionarla." icon={<Siren className="w-6 h-6" />} /></Card>}
      </div>
      <CreateAlertModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
};

const AlertDetail: React.FC<{ alert: TerritorialAlert }> = ({ alert: a }) => {
  const { mutate } = useData();
  const { can } = useSession();
  const [status, setStatus] = useState<AlertStatus>(a.status);
  const [note, setNote] = useState('');
  const [derivedTo, setDerivedTo] = useState(a.derivedTo ?? '');
  const [v, setV] = useState(0);
  useEffect(() => {
    setStatus(a.status);
    setDerivedTo(a.derivedTo ?? '');
  }, [a.id, a.status, a.derivedTo]);
  const canChange = status === 'derivada' ? can('alerts.derive') : can('alerts.manage');

  return (
    <Card title={a.title} subtitle={`${a.id} · ${ALERT_TYPE[a.type]}`} bodyClassName="p-0">
      <GeoMap className="h-52" alerts={[a]} focus={{ lat: a.lat, lng: a.lng, zoom: 10, key: a.id }} layers={{ departments: true }} />
      <div className="p-4 space-y-4">
        <div className="flex gap-1.5 flex-wrap">
          <Badge className={ALERT_PRIORITY[a.priority].badge}>{ALERT_PRIORITY[a.priority].label}</Badge>
          <Badge className={ALERT_STATUS[a.status].badge}>{ALERT_STATUS[a.status].label}</Badge>
        </div>
        <p className="text-sm text-ink-800">{a.description}</p>
        <DL cols={1} items={[['Ubicación', `${a.municipality} · ${a.department}`], ['Creada', `${formatDateTime(a.createdAt)} · ${a.createdBy}`], ['Derivada a', a.derivedTo]]} />
        {a.related.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1">Elementos relacionados</div>
            <ul className="space-y-0.5">
              {a.related.map((r) => (
                <li key={`${r.type}-${r.id}`} className="text-xs">
                  {REF_LABEL[r.type]}: <a href={REF_LINK[r.type](r.id)} className="font-mono text-teal-800 underline">{r.id}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(can('alerts.manage') || can('alerts.derive')) && (
          <div className="border-t border-ink-200 pt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Estado">
                {(id) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as AlertStatus)}>
                    {Object.entries(ALERT_STATUS).map(([k, val]) => <option key={k} value={k} disabled={k === 'derivada' && !can('alerts.derive')}>{val.label}</option>)}
                  </Select>
                )}
              </Field>
              {status === 'derivada' && (
                <Field label="Institución">
                  {(id) => (
                    <Select id={id} value={derivedTo} onChange={(e) => setDerivedTo(e.target.value)}>
                      <option value="">Seleccione…</option>
                      {INSTITUTIONS_FOR_DERIVATION.map((i) => <option key={i}>{i}</option>)}
                    </Select>
                  )}
                </Field>
              )}
            </div>
            <Field label="Nota">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <Button
              variant="primary"
              className="w-full"
              disabled={!canChange || status === a.status || !note.trim() || (status === 'derivada' && !derivedTo)}
              onClick={async () => {
                const ok = await mutate((p) => p.alerts.updateStatus(a.id, status, note, status === 'derivada' ? derivedTo : undefined), { success: 'Alerta actualizada.', reload: ['alerts'] });
                if (ok) {
                  setNote('');
                  setV((x) => x + 1);
                }
              }}
            >
              Actualizar alerta
            </Button>
          </div>
        )}
        <div className="border-t border-ink-200 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-2">Historial</div>
          <HistoryPanel entityId={a.id} refreshKey={v} />
        </div>
      </div>
    </Card>
  );
};

const CreateAlertModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { mutate } = useData();
  const empty = { title: '', type: 'observacion_satelital' as AlertType, priority: 'media' as AlertPriority, department: '', municipality: '', lat: '', lng: '', description: '', relatedType: 'registro_minero' as EntityRef['type'], relatedId: '' };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) {
      setF(empty);
      setErr('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    const lat = parseFloat(f.lat);
    const lng = parseFloat(f.lng);
    if (!f.title.trim() || !f.department || !f.description.trim()) return setErr('Complete título, departamento y descripción.');
    if (!isInsideBolivia(lat, lng)) return setErr('Coordenadas inválidas o fuera de Bolivia.');
    const ok = await mutate(
      (p) =>
        p.alerts.create({
          title: f.title.trim(),
          type: f.type,
          priority: f.priority,
          status: 'activa',
          department: f.department,
          municipality: f.municipality.trim(),
          lat,
          lng,
          description: f.description.trim(),
          related: f.relatedId.trim() ? [{ type: f.relatedType, id: f.relatedId.trim() }] : []
        }),
      { success: 'Alerta creada.', reload: ['alerts'] }
    );
    if (ok) {
      onClose();
      navigate(`/alertas?id=${ok.id}`);
    }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Nueva alerta territorial" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={submit}>Crear alerta</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Título" required className="sm:col-span-2">{(id) => <Input id={id} value={f.title} onChange={(e) => set('title', e.target.value)} />}</Field>
        <Field label="Tipo">{(id) => <Select id={id} value={f.type} onChange={(e) => set('type', e.target.value)}>{Object.entries(ALERT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Prioridad">{(id) => <Select id={id} value={f.priority} onChange={(e) => set('priority', e.target.value)}>{Object.entries(ALERT_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>}</Field>
        <Field label="Departamento" required>{(id) => <Select id={id} value={f.department} onChange={(e) => set('department', e.target.value)}><option value="">Seleccione…</option>{DEPARTMENTS.map((d) => <option key={d.code}>{d.name}</option>)}</Select>}</Field>
        <Field label="Municipio">{(id) => <Input id={id} value={f.municipality} onChange={(e) => set('municipality', e.target.value)} />}</Field>
        <Field label="Latitud" required>{(id) => <Input id={id} value={f.lat} onChange={(e) => set('lat', e.target.value)} />}</Field>
        <Field label="Longitud" required>{(id) => <Input id={id} value={f.lng} onChange={(e) => set('lng', e.target.value)} />}</Field>
        <Field label="Elemento relacionado">{(id) => <Select id={id} value={f.relatedType} onChange={(e) => set('relatedType', e.target.value)}>{Object.entries(REF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
        <Field label="Identificador relacionado">{(id) => <Input id={id} value={f.relatedId} onChange={(e) => set('relatedId', e.target.value)} placeholder="GA-MIN-000012" />}</Field>
        <Field label="Descripción" required className="sm:col-span-2">{(id) => <TextArea id={id} value={f.description} onChange={(e) => set('description', e.target.value)} />}</Field>
        {err && <Notice tone="danger" className="sm:col-span-2">{err}</Notice>}
      </div>
    </Modal>
  );
};
