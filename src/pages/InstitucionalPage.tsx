import React, { useState } from 'react';
import { Building2, ExternalLink, Pencil } from 'lucide-react';
import type { InstitutionalSource, SourceAvailability } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { Badge, Button, Card, DataTable, DemoBadge, DL, Field, Input, Modal, Notice, PageHeader, Select, TextArea, type Column } from '../components/ui';
import { SOURCE_AVAILABILITY } from '../domain/catalogs';
import { formatDate } from '../domain/util';
import type { SourceDocument } from '../types/domain';

export const InstitucionalPage: React.FC = () => {
  const { sources, sourceDocuments, miningRecords } = useData();
  const { can } = useSession();
  const [editing, setEditing] = useState<InstitutionalSource | null>(null);
  const [selected, setSelected] = useState<string>('');

  const docs = selected ? sourceDocuments.filter((d) => d.sourceId === selected) : sourceDocuments;
  const usage = (src: InstitutionalSource) => miningRecords.filter((r) => r.classification.sourceInstitution.toUpperCase().includes(src.acronym.split(' ')[0].toUpperCase())).length;

  const docColumns: Column<SourceDocument>[] = [
    { key: 'code', header: 'Referencia', render: (d) => <span className="font-mono text-[11px]">{d.codeReference}</span>, sortValue: (d) => d.codeReference },
    { key: 'title', header: 'Documento / registro', render: (d) => <div><div className="font-semibold text-navy-900 text-sm flex items-center gap-1.5">{d.title} <DemoBadge show={d.origin === 'demo'} /></div><div className="text-[11px] text-ink-500">{d.recordType}</div></div>, sortValue: (d) => d.title },
    { key: 'inst', header: 'Institución', render: (d) => <span className="text-xs">{d.institution}</span>, sortValue: (d) => d.institution },
    { key: 'loc', header: 'Ubicación', render: (d) => <span className="text-xs">{d.municipality} · {d.department}</span>, hideOnMobile: true },
    { key: 'upd', header: 'Actualización', render: (d) => <span className="text-xs">{formatDate(d.updatedAt)}</span>, sortValue: (d) => d.updatedAt }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Información institucional"
        description="Catálogo de fuentes oficiales previstas para alimentar GeoAlerta, con su estado de integración y condiciones de uso."
      />
      <Notice tone="warning">
        <strong>Ninguna conexión institucional está activa.</strong> GeoAlerta no consulta en tiempo real a SERGEOMIN, AJAM, ministerios, INE, SERNAP ni gobiernos
        autónomos. Cada integración requiere convenio, credenciales o servicio publicado por la institución. Mientras tanto, la información puede cargarse
        manualmente (importación CSV/Excel/GeoJSON/Shapefile) indicando su fuente.
      </Notice>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sources.map((s) => (
          <Card
            key={s.id}
            className={selected === s.id ? 'ring-2 ring-teal-600' : ''}
            title={
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700" /> {s.acronym}
              </span>
            }
            subtitle={s.institution}
            actions={can('sources.manage') && <Button size="sm" variant="ghost" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing(s)} aria-label={`Editar ${s.acronym}`} />}
          >
            <div className="space-y-2">
              <Badge className={SOURCE_AVAILABILITY[s.availability].badge}>{SOURCE_AVAILABILITY[s.availability].label}</Badge>
              <DL
                cols={1}
                items={[
                  ['Tipo de información', s.infoType],
                  ['Última actualización', s.updatedAt ? formatDate(s.updatedAt) : 'Sin datos cargados'],
                  ['Referencia documental', s.referenceUrl ? <a key="r" href={s.referenceUrl} target="_blank" rel="noreferrer noopener" className="text-teal-800 underline inline-flex items-center gap-1">{s.reference} <ExternalLink className="w-3 h-3" /></a> : s.reference],
                  ['Condiciones de uso', s.usageConditions],
                  ['Notas', s.notes],
                  ['Registros que citan esta fuente', usage(s)]
                ]}
              />
              <button type="button" onClick={() => setSelected((v) => (v === s.id ? '' : s.id))} className="text-xs font-semibold text-teal-800 hover:underline">
                {selected === s.id ? 'Mostrar todas las referencias' : 'Ver referencias de esta fuente'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Referencias documentales registradas" subtitle="Documentos concretos asociados a cada fuente (los existentes son demostrativos)." bodyClassName="p-0">
        <DataTable rows={docs} columns={docColumns} rowKey={(d) => d.id} pageSize={10} />
      </Card>

      {editing && <EditSourceModal source={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const EditSourceModal: React.FC<{ source: InstitutionalSource; onClose: () => void }> = ({ source, onClose }) => {
  const { mutate } = useData();
  const [f, setF] = useState(source);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Fuente ${source.acronym}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={async () => (await mutate((p) => p.sources.update(source.id, { availability: f.availability, updatedAt: f.updatedAt, reference: f.reference, referenceUrl: f.referenceUrl, usageConditions: f.usageConditions, notes: f.notes }), { success: 'Fuente actualizada.', reload: ['sources'] })) && onClose()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Estado de disponibilidad" hint="Marque «Servicio conectado» solo cuando exista una integración técnica operativa.">
          {(id) => (
            <Select id={id} value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value as SourceAvailability })}>
              {Object.entries(SOURCE_AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Fecha de última actualización de datos">{(id) => <Input id={id} type="date" value={f.updatedAt ?? ''} onChange={(e) => setF({ ...f, updatedAt: e.target.value })} />}</Field>
        <Field label="Referencia documental">{(id) => <Input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />}</Field>
        <Field label="Enlace">{(id) => <Input id={id} type="url" value={f.referenceUrl ?? ''} onChange={(e) => setF({ ...f, referenceUrl: e.target.value })} />}</Field>
        <Field label="Condiciones de utilización">{(id) => <TextArea id={id} value={f.usageConditions} onChange={(e) => setF({ ...f, usageConditions: e.target.value })} />}</Field>
        <Field label="Notas">{(id) => <TextArea id={id} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
};
