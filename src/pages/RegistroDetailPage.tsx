import React, { useState } from 'react';
import { ArrowLeft, Crosshair, Megaphone, Pencil, Satellite, Scale, Trash2 } from 'lucide-react';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { navigate } from '../app/router';
import { GeoMap } from '../components/GeoMap';
import { ClassifyModal, EvidencePanel, HistoryPanel, RecordFormModal, StatusBadge, VerificationBadge } from '../components/records';
import { Badge, Button, Card, DemoBadge, DL, EmptyState, Field, Modal, Notice, PageHeader, Tabs, TextArea } from '../components/ui';
import { ADMIN_STATUS, MINING_TYPE, OBSERVATION_TYPE, REPORT_CATEGORY, REPORT_STATUS, REVIEW_STATE } from '../domain/catalogs';
import { formatCoord, formatDate, formatDateTime, formatNumber } from '../domain/util';

type Tab = 'expediente' | 'evidencias' | 'vinculos' | 'historial';

export const RegistroDetailPage: React.FC<{ id: string }> = ({ id }) => {
  const { miningRecords, reports, satellites, mutate, loading } = useData();
  const { can } = useSession();
  const record = miningRecords.find((r) => r.id === id);
  const [tab, setTab] = useState<Tab>('expediente');
  const [editing, setEditing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState('');

  if (!record) {
    return loading ? null : (
      <Card>
        <EmptyState title={`No se encontró el registro ${id}.`}>
          <a href="#/registros" className="text-teal-800 underline">
            Volver a registros mineros
          </a>
        </EmptyState>
      </Card>
    );
  }

  const linkedReports = reports.filter((r) => record.relatedReportIds.includes(r.id) || r.relatedMiningRecordId === record.id);
  const linkedSats = satellites.filter((s) => record.relatedSatelliteIds.includes(s.id) || s.relatedMiningRecordIds.includes(record.id));
  const c = record.classification;

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={
          <a href="#/registros" className="inline-flex items-center gap-1 hover:text-navy-900">
            <ArrowLeft className="w-3 h-3" /> Registros mineros
          </a>
        }
        title={record.name}
        description={
          <span className="flex flex-wrap items-center gap-2 mt-1">
            <span className="font-mono text-xs text-navy-800">{record.id}</span>
            <StatusBadge status={record.adminStatus} />
            <VerificationBadge state={c.verificationState} />
            <DemoBadge show={record.origin === 'demo'} />
            <span className="text-xs text-ink-500">Versión {record.version}</span>
          </span>
        }
        actions={
          <>
            <Button icon={<Crosshair className="w-4 h-4" />} onClick={() => navigate(`/mapa?sel=record:${record.id}`)}>
              Ver en mapa
            </Button>
            {can('records.edit') && (
              <Button icon={<Pencil className="w-4 h-4" />} onClick={() => setEditing(true)}>
                Editar / coordenadas
              </Button>
            )}
            {can('records.classify') && (
              <Button variant="primary" icon={<Scale className="w-4 h-4" />} onClick={() => setClassifying(true)}>
                Cambiar clasificación
              </Button>
            )}
            {can('records.delete') && (
              <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleting(true)}>
                Eliminar
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-3">
        <div className="space-y-3 min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'expediente', label: 'Expediente' },
              { id: 'evidencias', label: `Evidencias (${record.evidences.length})` },
              { id: 'vinculos', label: `Vínculos (${linkedReports.length + linkedSats.length})` },
              { id: 'historial', label: 'Historial de modificaciones' }
            ]}
          />

          {tab === 'expediente' && (
            <>
              <Card title="Situación administrativa" subtitle={ADMIN_STATUS[record.adminStatus].description}>
                {record.adminStatus === 'sin_determinar' && (
                  <Notice className="mb-3">La ausencia de información documental no implica ilegalidad. Este registro requiere consulta a las fuentes institucionales.</Notice>
                )}
                <DL
                  items={[
                    ['Clasificación', <StatusBadge key="s" status={record.adminStatus} />],
                    ['Estado de verificación', <VerificationBadge key="v" state={c.verificationState} />],
                    ['Institución de respaldo', c.sourceInstitution],
                    ['Documento de respaldo', c.sourceDocument],
                    ['Fecha de consulta de la fuente', formatDate(c.consultedAt)],
                    ['Determinado por', `${c.determinedBy} · ${formatDateTime(c.determinedAt)}`],
                    ...(c.notes ? ([['Notas', c.notes]] as [string, string][]) : [])
                  ]}
                />
              </Card>
              <Card title="Datos de la operación">
                <DL
                  items={[
                    ['Titular u operador registrado', record.holder],
                    ['Código de derecho minero', record.miningRightCode && <span className="font-mono">{record.miningRightCode}</span>],
                    ['Tipo de actividad minera', MINING_TYPE[record.miningType].label],
                    ['Mineral / material', record.mineral],
                    ['Fecha de registro', formatDate(record.registeredAt)],
                    ['Última actualización', formatDate(record.updatedAt)],
                    ['Fuente de información', record.source],
                    ['Origen del dato', record.origin === 'demo' ? 'Demostrativo' : record.origin === 'importado' ? 'Importado' : record.origin === 'institucional' ? 'Fuente institucional' : 'Registro manual']
                  ]}
                />
                {record.observations && (
                  <div className="mt-3 pt-3 border-t border-ink-100">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Observaciones</div>
                    <p className="text-sm text-ink-800 whitespace-pre-line">{record.observations}</p>
                  </div>
                )}
              </Card>
            </>
          )}

          {tab === 'evidencias' && (
            <Card title="Evidencias documentales" subtitle="Resoluciones, contratos, informes, actas y fotografías asociadas al expediente.">
              <EvidencePanel entityType="registro_minero" entityId={record.id} evidences={record.evidences} reload={['miningRecords']} />
            </Card>
          )}

          {tab === 'vinculos' && (
            <>
              <Card title="Denuncias ciudadanas relacionadas" subtitle="Las denuncias no constituyen verificación oficial.">
                {linkedReports.length === 0 ? (
                  <EmptyState title="Sin denuncias vinculadas." icon={<Megaphone className="w-6 h-6" />} />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {linkedReports.map((r) => (
                      <li key={r.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                        <a href={`#/denuncias/${r.id}`} className="font-mono text-xs text-teal-800 underline">
                          {r.trackingCode}
                        </a>
                        <span>{REPORT_CATEGORY[r.category].label}</span>
                        <Badge className={REPORT_STATUS[r.status].badge}>{REPORT_STATUS[r.status].label}</Badge>
                        <span className="text-xs text-ink-500 ml-auto">{formatDate(r.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Observaciones satelitales relacionadas">
                {linkedSats.length === 0 ? (
                  <EmptyState title="Sin observaciones vinculadas." icon={<Satellite className="w-6 h-6" />} />
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {linkedSats.map((s) => (
                      <li key={s.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                        <a href={`#/satelital/${s.id}`} className="font-mono text-xs text-teal-800 underline">
                          {s.id}
                        </a>
                        <span>{OBSERVATION_TYPE[s.observationType]}</span>
                        <Badge className={REVIEW_STATE[s.reviewState].badge}>{REVIEW_STATE[s.reviewState].label}</Badge>
                        <span className="text-xs text-ink-500 ml-auto">{formatDate(s.acquisitionDate)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}

          {tab === 'historial' && (
            <Card title="Historial de modificaciones" subtitle="Bitácora inalterable de cambios sobre este registro.">
              <HistoryPanel entityId={record.id} refreshKey={record.version} />
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card title="Ubicación" bodyClassName="p-0">
            <GeoMap
              className="h-72"
              records={[record]}
              reports={linkedReports}
              satellites={linkedSats}
              focus={{ lat: record.lat, lng: record.lng, zoom: record.geometry ? 12 : 11, key: record.id }}
              selected={{ kind: 'record', id: record.id }}
              highlightDepartment={record.department}
            />
            <div className="p-4">
              <DL
                items={[
                  ['Latitud, longitud (WGS84)', <span key="c" className="font-mono text-xs">{formatCoord(record.lat, record.lng)}</span>],
                  ['Departamento', record.department],
                  ['Provincia', record.province],
                  ['Municipio', record.municipality],
                  ['Comunidad / localidad', record.locality],
                  ['Área de operación', record.geometry ? (record.areaHa ? `${formatNumber(record.areaHa, 1)} ha` : 'Polígono disponible') : 'Sin geometría']
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      <RecordFormModal open={editing} onClose={() => setEditing(false)} record={record} />
      {classifying && <ClassifyModal open={classifying} onClose={() => setClassifying(false)} record={record} />}
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Eliminar ${record.id}`}
        footer={
          <>
            <Button onClick={() => setDeleting(false)}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 10}
              onClick={async () => {
                const ok = await mutate((p) => p.miningRecords.remove(record.id, reason.trim()).then(() => true), { success: 'Registro eliminado.', reload: ['miningRecords'] });
                if (ok) navigate('/registros');
              }}
            >
              Eliminar definitivamente
            </Button>
          </>
        }
      >
        <Notice tone="danger">La eliminación queda en la bitácora. En la base de datos central el registro se conserva como «eliminado lógicamente» para auditoría.</Notice>
        <Field label="Motivo (mín. 10 caracteres)" required className="mt-3">
          {(fid) => <TextArea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </Modal>
    </div>
  );
};
