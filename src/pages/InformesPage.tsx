import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { BrandLogo } from '../components/BrandLogo';
import { Button, Card, Field, Input, Notice, PageHeader, Select } from '../components/ui';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { ADMIN_STATUS, ADMIN_STATUS_ORDER, ALERT_PRIORITY, ALERT_STATUS, MINING_TYPE, MINING_TYPE_ORDER, REPORT_CATEGORY, REPORT_STATUS, REPORT_STATUS_ORDER, ROLE } from '../domain/catalogs';
import { downloadText, recordsToCSV, recordsToGeoJSON } from '../domain/interchange';
import { formatDate, formatDateTime, todayISO } from '../domain/util';
import { DATA_MODE } from '../services';

type ReportKind = 'situacion' | 'registros' | 'denuncias' | 'alertas';
const KINDS: Record<ReportKind, string> = {
  situacion: 'Informe de situación territorial',
  registros: 'Listado de registros mineros',
  denuncias: 'Informe de denuncias ciudadanas',
  alertas: 'Informe de alertas territoriales'
};

export const InformesPage: React.FC = () => {
  const { miningRecords, reports, alerts, satellites, mutate } = useData();
  const { session, can } = useSession();
  const [kind, setKind] = useState<ReportKind>('situacion');
  const [department, setDepartment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());

  const inScope = <T extends { department: string },>(x: T, date: string) => (!department || x.department === department) && (!from || date.slice(0, 10) >= from) && (!to || date.slice(0, 10) <= to);
  const recs = useMemo(() => miningRecords.filter((r) => inScope(r, r.registeredAt)), [miningRecords, department, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const reps = useMemo(() => reports.filter((r) => inScope(r, r.createdAt)), [reports, department, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const alrs = useMemo(() => alerts.filter((a) => inScope(a, a.createdAt)), [alerts, department, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const sats = useMemo(() => satellites.filter((s) => inScope(s, s.acquisitionDate)), [satellites, department, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const audit = (fmt: string) =>
    mutate((p) => p.audit.logClientEvent({ action: 'exportar', entityType: 'registro_minero', entityId: KINDS[kind], summary: `${KINDS[kind]} (${fmt}) · ámbito: ${department || 'Bolivia'} · ${from || 'inicio'} a ${to}` }), {});

  const print = async () => {
    await audit('impresión/PDF');
    window.print();
  };

  const scopeLabel = `${department || 'Todo el territorio nacional'} · ${from ? formatDate(from) : 'sin fecha inicial'} – ${formatDate(to)}`;

  return (
    <div className="space-y-3">
      <div className="print:hidden space-y-3">
        <PageHeader title="Informes" description="Genere informes con los filtros actuales. Use «Imprimir / PDF» para obtener un documento con encabezado institucional." />
        <Card>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <Field label="Tipo de informe">
              {(id) => (
                <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Departamento">
              {(id) => (
                <Select id={id} value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">Toda Bolivia</option>
                  {DEPARTMENTS.map((d) => <option key={d.code}>{d.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Desde">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label="Hasta">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
            <div className="flex gap-2 flex-wrap">
              <Button variant="primary" icon={<Printer className="w-4 h-4" />} onClick={print}>Imprimir / PDF</Button>
              {kind === 'registros' && can('records.export') && (
                <>
                  <Button icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => (downloadText(`geoalerta_registros_${todayISO()}.csv`, recordsToCSV(recs), 'text/csv;charset=utf-8'), audit('CSV'))}>CSV</Button>
                  <Button icon={<Download className="w-4 h-4" />} onClick={() => (downloadText(`geoalerta_registros_${todayISO()}.geojson`, JSON.stringify(recordsToGeoJSON(recs)), 'application/geo+json'), audit('GeoJSON'))}>GeoJSON</Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Documento */}
      <article className="bg-white border border-ink-200 rounded-lg shadow-card p-6 sm:p-10 print:border-0 print:shadow-none print:p-0 text-sm" aria-label="Vista previa del informe">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy-900 pb-4 mb-5">
          <BrandLogo className="h-12" showSlogan />
          <div className="text-right text-xs text-ink-600">
            <div className="font-bold text-navy-900 text-base">{KINDS[kind]}</div>
            <div>{scopeLabel}</div>
            <div>Generado: {formatDateTime(new Date().toISOString())}</div>
            <div>Por: {session?.user.name} ({session && ROLE[session.user.role].label})</div>
          </div>
        </header>
        {DATA_MODE === 'demo' && (
          <Notice tone="warning" className="mb-5">
            DOCUMENTO DEMOSTRATIVO — Generado con datos de ejemplo. No tiene validez oficial ni representa estadísticas reales.
          </Notice>
        )}

        {kind === 'situacion' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-base font-bold text-navy-900 mb-2">1. Resumen</h2>
              <table className="w-full text-xs border border-ink-200">
                <tbody>
                  {[
                    ['Registros mineros', recs.length],
                    ...ADMIN_STATUS_ORDER.map((s) => [`   ${ADMIN_STATUS[s].label}`, recs.filter((r) => r.adminStatus === s).length]),
                    ['Denuncias recibidas', reps.length],
                    ['Denuncias pendientes de revisión', reps.filter((r) => r.status === 'recibido' || r.status === 'pendiente_revision').length],
                    ['Observaciones satelitales', sats.length],
                    ['Alertas activas', alrs.filter((a) => a.status === 'activa').length]
                  ].map(([k, v]) => (
                    <tr key={String(k)} className="border-b border-ink-100">
                      <td className="px-2 py-1.5 whitespace-pre">{k}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h2 className="text-base font-bold text-navy-900 mb-2">2. Registros por departamento y situación administrativa</h2>
              <ReportTable
                headers={['Departamento', ...ADMIN_STATUS_ORDER.map((s) => ADMIN_STATUS[s].short), 'Total']}
                rows={DEPARTMENTS.map((d) => {
                  const rs = recs.filter((r) => r.department === d.name);
                  return [d.name, ...ADMIN_STATUS_ORDER.map((s) => rs.filter((r) => r.adminStatus === s).length), rs.length];
                }).filter((r) => r[r.length - 1] !== 0)}
              />
            </section>
            <section>
              <h2 className="text-base font-bold text-navy-900 mb-2">3. Registros por tipo de minería</h2>
              <ReportTable headers={['Tipo', 'Registros']} rows={MINING_TYPE_ORDER.map((t) => [MINING_TYPE[t].label, recs.filter((r) => r.miningType === t).length])} />
            </section>
            <section>
              <h2 className="text-base font-bold text-navy-900 mb-2">4. Consideraciones</h2>
              <ul className="list-disc pl-5 text-xs text-ink-700 space-y-1">
                <li>Toda clasificación distinta de «Sin determinar» está respaldada por un documento y fecha de consulta registrados en la ficha del registro.</li>
                <li>La ausencia de un registro en bases de datos no implica ilegalidad.</li>
                <li>Las denuncias ciudadanas y las observaciones satelitales son indicios sujetos a verificación.</li>
              </ul>
            </section>
          </div>
        )}

        {kind === 'registros' && (
          <ReportTable
            headers={['ID', 'Operación', 'Municipio', 'Depto.', 'Tipo', 'Situación', 'Respaldo', 'Actualizado']}
            rows={recs.map((r) => [r.id, r.name, r.municipality, r.department, MINING_TYPE[r.miningType].short, ADMIN_STATUS[r.adminStatus].label, r.classification.sourceDocument || '—', formatDate(r.updatedAt)])}
          />
        )}
        {kind === 'denuncias' && (
          <div className="space-y-4">
            <ReportTable headers={['Estado', 'Denuncias']} rows={REPORT_STATUS_ORDER.map((s) => [REPORT_STATUS[s].label, reps.filter((r) => r.status === s).length])} />
            <ReportTable
              headers={['Código', 'Tipo', 'Municipio', 'Depto.', 'Estado', 'Recibida']}
              rows={reps.map((r) => [r.trackingCode, REPORT_CATEGORY[r.category].short, r.municipality, r.department, REPORT_STATUS[r.status].label, formatDate(r.createdAt)])}
            />
            <p className="text-[11px] text-ink-500">Este informe no incluye datos de contacto de los denunciantes.</p>
          </div>
        )}
        {kind === 'alertas' && (
          <ReportTable
            headers={['ID', 'Alerta', 'Prioridad', 'Estado', 'Ubicación', 'Derivada a', 'Creada']}
            rows={alrs.map((a) => [a.id, a.title, ALERT_PRIORITY[a.priority].label, ALERT_STATUS[a.status].label, `${a.municipality}, ${a.department}`, a.derivedTo ?? '—', formatDate(a.createdAt)])}
          />
        )}
        <footer className="mt-8 pt-3 border-t border-ink-200 text-[10px] text-ink-500 flex justify-between">
          <span>GeoAlerta · Información territorial para actuar a tiempo.</span>
          <span>Documento generado automáticamente</span>
        </footer>
      </article>
    </div>
  );
};

const ReportTable: React.FC<{ headers: string[]; rows: (string | number)[][] }> = ({ headers, rows }) => (
  <table className="w-full text-xs border border-ink-200">
    <thead className="bg-ivory-100">
      <tr>
        {headers.map((h) => <th key={h} scope="col" className="text-left px-2 py-1.5 font-semibold text-navy-900 border-b border-ink-200">{h}</th>)}
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && (
        <tr>
          <td colSpan={headers.length} className="px-2 py-3 text-center text-ink-500">Sin datos en el ámbito seleccionado.</td>
        </tr>
      )}
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-ink-100 break-inside-avoid">
          {r.map((c, j) => <td key={j} className={`px-2 py-1 ${typeof c === 'number' ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
);
