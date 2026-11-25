import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Link2, Lock, Megaphone, Search } from 'lucide-react';
import type { CitizenReport, ReportCategory, ReportStatus } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { buildQuery, navigate, useRoute } from '../app/router';
import { GeoMap } from '../components/GeoMap';
import { AuthImage, HistoryPanel, StatusBadge, useNearbyRecords } from '../components/records';
import { Badge, Button, Card, DataTable, DemoBadge, DL, EmptyState, Field, Input, Notice, PageHeader, Select, TextArea, type Column } from '../components/ui';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { INSTITUTIONS_FOR_DERIVATION, MINING_TYPE, OBSERVATION_TYPE, REPORT_CATEGORY, REPORT_STATUS, REPORT_STATUS_ORDER, WHEN_PRESET } from '../domain/catalogs';
import { distanceKm, formatCoord, formatDate, formatDateTime } from '../domain/util';

export const DenunciasPage: React.FC<{ id?: string }> = ({ id }) => {
  if (id) return <DenunciaDetail id={id} />;
  return <DenunciasList />;
};

const DenunciasList: React.FC = () => {
  const route = useRoute();
  const { reports } = useData();
  const [q, setQ] = useState('');
  const status = route.query.get('estado') ?? '';
  const department = route.query.get('departamento') ?? '';
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const setParam = (k: string, v: string) => navigate(`/denuncias${buildQuery({ estado: status, departamento: department, [k]: v })}`, { replace: true });

  const rows = useMemo(
    () =>
      reports.filter((r) => {
        if (status === 'pendientes' ? !(r.status === 'recibido' || r.status === 'pendiente_revision') : status && r.status !== status) return false;
        if (department && r.department !== department) return false;
        if (category && r.category !== category) return false;
        if (q && !`${r.trackingCode} ${r.municipality} ${r.community}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [reports, status, department, category, q]
  );
  const counts = useMemo(() => Object.fromEntries(REPORT_STATUS_ORDER.map((s) => [s, reports.filter((r) => r.status === s).length])), [reports]);

  const columns: Column<CitizenReport>[] = [
    { key: 'code', header: 'Código', render: (r) => <span className="font-mono text-xs text-navy-800">{r.trackingCode}</span>, sortValue: (r) => r.trackingCode },
    { key: 'cat', header: 'Tipo de actividad observada', render: (r) => <div className="text-xs"><div className="font-semibold text-navy-900">{REPORT_CATEGORY[r.category].label}</div>{r.observedMiningType && <div className="text-ink-500">{MINING_TYPE[r.observedMiningType].label}</div>}</div>, sortValue: (r) => r.category },
    { key: 'loc', header: 'Ubicación', render: (r) => <div className="text-xs"><div>{r.municipality}</div><div className="text-ink-500">{r.department}</div></div>, sortValue: (r) => `${r.department} ${r.municipality}` },
    { key: 'status', header: 'Estado', render: (r) => <Badge className={REPORT_STATUS[r.status].badge}>{REPORT_STATUS[r.status].label}</Badge>, sortValue: (r) => REPORT_STATUS[r.status].order },
    { key: 'mode', header: 'Modalidad', render: (r) => <span className="text-xs inline-flex items-center gap-1">{r.confidentiality === 'confidencial' && <Lock className="w-3 h-3" />}{r.confidentiality === 'anonimo' ? 'Anónima' : 'Confidencial'}</span>, hideOnMobile: true },
    { key: 'links', header: 'Vínculos', render: (r) => <span className="text-[11px] text-ink-600">{[r.relatedMiningRecordId && 'Registro', r.relatedSatelliteId && 'Observación'].filter(Boolean).join(' · ') || '—'}</span>, hideOnMobile: true },
    { key: 'date', header: 'Recibida', render: (r) => <span className="text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span>, sortValue: (r) => r.createdAt }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Denuncias ciudadanas"
        description="Reportes de la ciudadanía. Se gestionan por separado de los registros mineros verificados y no constituyen, por sí mismos, una determinación."
        actions={
          <a href="#/denuncia" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 hover:underline">
            <ExternalLink className="w-4 h-4" /> Formulario público
          </a>
        }
      />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button type="button" onClick={() => setParam('estado', '')} className={`px-2.5 py-1.5 rounded text-xs font-semibold border whitespace-nowrap ${!status ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-ink-300'}`}>
          Todas ({reports.length})
        </button>
        <button type="button" onClick={() => setParam('estado', 'pendientes')} className={`px-2.5 py-1.5 rounded text-xs font-semibold border whitespace-nowrap ${status === 'pendientes' ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-ink-300'}`}>
          Por revisar ({(counts.recibido ?? 0) + (counts.pendiente_revision ?? 0)})
        </button>
        {REPORT_STATUS_ORDER.map((s) => (
          <button key={s} type="button" onClick={() => setParam('estado', s)} className={`px-2.5 py-1.5 rounded text-xs font-semibold border whitespace-nowrap ${status === s ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-ink-300'}`}>
            {REPORT_STATUS[s].label} ({counts[s] ?? 0})
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input aria-label="Buscar por código o localidad" placeholder="Código GA-DEN-… o localidad" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Departamento" value={department} onChange={(e) => setParam('departamento', e.target.value)}>
          <option value="">Departamento: todos</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.code}>{d.name}</option>
          ))}
        </Select>
        <Select aria-label="Tipo" value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
          <option value="">Tipo: todos</option>
          {Object.entries(REPORT_CATEGORY).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/denuncias/${r.id}`)} initialSort={{ key: 'date', order: 'desc' }} />
    </div>
  );
};

const DenunciaDetail: React.FC<{ id: string }> = ({ id }) => {
  const { reports, satellites, miningRecords, mutate } = useData();
  const { can } = useSession();
  const r = reports.find((x) => x.id === id);
  const nearby = useNearbyRecords(r?.lat ?? 0, r?.lng ?? 0, 30);
  const [status, setStatus] = useState<ReportStatus>('pendiente_revision');
  const [publicNote, setPublicNote] = useState('');
  const [institution, setInstitution] = useState('');
  const [internal, setInternal] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (r) {
      setStatus(r.status);
      setPublicNote(r.publicNote);
      setInstitution(r.assignedInstitution ?? '');
    }
  }, [r?.id, r?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <Card><EmptyState title="Denuncia no encontrada." icon={<Megaphone className="w-6 h-6" />} /></Card>;

  const nearbySats = satellites
    .map((s) => ({ s, d: distanceKm(r.lat, r.lng, s.lat, s.lng) }))
    .filter((x) => x.d <= 30)
    .sort((a, b) => a.d - b.d);
  const linkedRecord = miningRecords.find((m) => m.id === r.relatedMiningRecordId);
  const linkedSat = satellites.find((s) => s.id === r.relatedSatelliteId);
  const canReview = can('reports.review');

  const save = async () => {
    setBusy(true);
    const ok = await mutate((p) => p.reports.updateStatus(r.id, { status, publicNote, assignedInstitution: institution, internalNote: internal }), { success: 'Estado actualizado.', reload: ['reports'] });
    setBusy(false);
    if (ok) {
      setInternal('');
      setVersion((v) => v + 1);
    }
  };
  const link = async (links: { relatedSatelliteId?: string | null; relatedMiningRecordId?: string | null }) => {
    const ok = await mutate((p) => p.reports.link(r.id, links), { success: 'Vinculación actualizada.', reload: ['reports', 'miningRecords', 'satellites'] });
    if (ok) setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={<a href="#/denuncias" className="inline-flex items-center gap-1 hover:text-navy-900"><ArrowLeft className="w-3 h-3" /> Denuncias ciudadanas</a>}
        title={`Denuncia ${r.trackingCode}`}
        description={
          <span className="flex flex-wrap gap-2 mt-1 items-center">
            <Badge className={REPORT_STATUS[r.status].badge}>{REPORT_STATUS[r.status].label}</Badge>
            <Badge className="bg-ivory-100 text-ink-700 border-ink-300">Información ciudadana · no verificada</Badge>
            <DemoBadge show={r.origin === 'demo'} />
          </span>
        }
      />
      <div className="grid xl:grid-cols-[1fr_400px] gap-3">
        <div className="space-y-3 min-w-0">
          <Card title="Contenido de la denuncia">
            <DL
              items={[
                ['Tipo de actividad observada', REPORT_CATEGORY[r.category].label],
                ['Tipo de minería observada', r.observedMiningType ? MINING_TYPE[r.observedMiningType].label : undefined],
                ['Fecha de observación', `${formatDate(r.observedDate)} (${WHEN_PRESET[r.observedWhenPreset]})`],
                ['Recibida', formatDateTime(r.createdAt)],
                ['Modalidad', r.confidentiality === 'anonimo' ? 'Anónima (sin datos de contacto)' : 'Confidencial'],
                [
                  'Contacto del denunciante',
                  r.confidentiality === 'anonimo' ? (
                    'No aplica'
                  ) : can('reports.view_sensitive') ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3 h-3 text-coral-700" /> {r.contactInfo || 'No proporcionado'}
                    </span>
                  ) : (
                    <span className="text-ink-500 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Restringido a revisores</span>
                  )
                ]
              ]}
            />
            <div className="mt-3 pt-3 border-t border-ink-100">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Descripción</div>
              <p className="text-sm text-ink-800 whitespace-pre-line">{r.description}</p>
            </div>
            {r.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {r.photos.map((p, i) => (
                  <AuthImage key={i} src={p.dataUrl ?? p.url} alt={`Fotografía ${i + 1} de la denuncia`} className="w-full h-28 object-cover rounded border border-ink-200" />
                ))}
              </div>
            )}
          </Card>

          {canReview && (
            <Card title="Revisión y seguimiento" subtitle="La nota pública es visible para el denunciante en la consulta de seguimiento. La nota interna queda en la bitácora.">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nuevo estado" required>
                  {(fid) => (
                    <Select id={fid} value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
                      {REPORT_STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {REPORT_STATUS[s].label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Institución a la que se deriva" required={status === 'derivado_institucion'}>
                  {(fid) => (
                    <Select id={fid} value={institution} onChange={(e) => setInstitution(e.target.value)}>
                      <option value="">—</option>
                      {INSTITUTIONS_FOR_DERIVATION.map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Nota pública (sin datos personales)" className="sm:col-span-2">
                  {(fid) => <TextArea id={fid} rows={2} value={publicNote} onChange={(e) => setPublicNote(e.target.value)} />}
                </Field>
                <Field label="Nota interna / justificación" required className="sm:col-span-2">
                  {(fid) => <TextArea id={fid} rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />}
                </Field>
              </div>
              <div className="flex justify-end mt-3">
                <Button variant="primary" onClick={save} loading={busy} disabled={!internal.trim() || (status === 'derivado_institucion' && !institution)}>
                  Registrar cambio
                </Button>
              </div>
            </Card>
          )}

          <Card title="Relación con registros y observaciones" subtitle="Vincular no cambia la situación administrativa del registro.">
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1">Registro minero vinculado</div>
                {linkedRecord ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`#/registros/${linkedRecord.id}`} className="text-teal-800 underline font-semibold">{linkedRecord.name}</a>
                    <StatusBadge status={linkedRecord.adminStatus} />
                    {canReview && <Button size="sm" variant="ghost" onClick={() => link({ relatedMiningRecordId: null })}>Desvincular</Button>}
                  </div>
                ) : (
                  <p className="text-ink-500 text-xs">Sin vínculo.</p>
                )}
                {canReview && !linkedRecord && nearby.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {nearby.slice(0, 5).map(({ r: m, d }) => (
                      <li key={m.id} className="flex items-center gap-2 text-xs">
                        <Button size="sm" icon={<Link2 className="w-3 h-3" />} onClick={() => link({ relatedMiningRecordId: m.id })}>Vincular</Button>
                        <span className="truncate">{m.name}</span>
                        <span className="text-ink-500 ml-auto whitespace-nowrap">{d.toFixed(1)} km</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1">Observación satelital vinculada</div>
                {linkedSat ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`#/satelital/${linkedSat.id}`} className="text-teal-800 underline font-mono text-xs">{linkedSat.id}</a>
                    <span className="text-xs">{OBSERVATION_TYPE[linkedSat.observationType]}</span>
                    {canReview && <Button size="sm" variant="ghost" onClick={() => link({ relatedSatelliteId: null })}>Desvincular</Button>}
                  </div>
                ) : (
                  <p className="text-ink-500 text-xs">Sin vínculo.</p>
                )}
                {canReview && !linkedSat && nearbySats.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {nearbySats.slice(0, 5).map(({ s, d }) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs">
                        <Button size="sm" icon={<Link2 className="w-3 h-3" />} onClick={() => link({ relatedSatelliteId: s.id })}>Vincular</Button>
                        <span className="truncate">{s.id} · {OBSERVATION_TYPE[s.observationType]} · {formatDate(s.acquisitionDate)}</span>
                        <span className="text-ink-500 ml-auto whitespace-nowrap">{d.toFixed(1)} km</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <Card title="Historial">
            <HistoryPanel entityId={r.trackingCode} refreshKey={version} />
          </Card>
        </div>

        <Card title="Ubicación aproximada" bodyClassName="p-0">
          <GeoMap
            className="h-80"
            reports={[r]}
            records={nearby.slice(0, 10).map((x) => x.r)}
            satellites={nearbySats.slice(0, 10).map((x) => x.s)}
            selected={{ kind: 'report', id: r.id }}
            focus={{ lat: r.lat, lng: r.lng, zoom: 10, key: r.id }}
          />
          <div className="p-4 text-sm">
            <DL cols={1} items={[['Coordenadas', <span key="c" className="font-mono text-xs">{formatCoord(r.lat, r.lng)}</span>], ['Lugar', `${r.community}, ${r.municipality} · ${r.department}`], ['Referencia', r.locationDescription]]} />
            <Notice className="mt-3">El mapa muestra también registros y observaciones a ≤ 30 km para facilitar la vinculación.</Notice>
          </div>
        </Card>
      </div>
    </div>
  );
};
