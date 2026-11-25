import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Filter, Map as MapIcon, Plus, RotateCcw, Search, Upload } from 'lucide-react';
import type { AdminStatus, ImportResult, MiningRecord, MiningRecordQuery, MiningType, Page, VerificationState } from '../types/domain';
import { useData } from '../app/data';
import { useSession } from '../app/session';
import { buildQuery, navigate, useRoute } from '../app/router';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { ADMIN_STATUS, ADMIN_STATUS_ORDER, MINING_TYPE, MINING_TYPE_ORDER, VERIFICATION_STATE } from '../domain/catalogs';
import { filterMiningRecords } from '../domain/query';
import { downloadText, recordsToCSV, recordsToGeoJSON } from '../domain/interchange';
import { formatDate, todayISO } from '../domain/util';
import { parseCoordinateQuery } from '../domain/validation';
import { Button, DataTable, DemoBadge, Field, Input, Modal, Notice, PageHeader, Select, type Column } from '../components/ui';
import { RecordFormModal, StatusBadge, VerificationBadge } from '../components/records';

type Filters = Required<Pick<MiningRecordQuery, 'q' | 'department' | 'province' | 'municipality' | 'dateFrom' | 'dateTo'>> & {
  miningType: MiningType | '';
  adminStatus: AdminStatus | '';
  verificationState: VerificationState | '';
};

const FROM_URL: Record<string, keyof Filters> = { q: 'q', departamento: 'department', provincia: 'province', municipio: 'municipality', tipo: 'miningType', estado: 'adminStatus', verificacion: 'verificationState', desde: 'dateFrom', hasta: 'dateTo' };

export const RegistrosPage: React.FC = () => {
  const route = useRoute();
  const { provider, miningRecords, mutate } = useData();
  const { can } = useSession();

  const filters: Filters = useMemo(() => {
    const f: Filters = { q: '', department: '', province: '', municipality: '', miningType: '', adminStatus: '', verificationState: '', dateFrom: '', dateTo: '' };
    Object.entries(FROM_URL).forEach(([param, key]) => {
      const v = route.query.get(param);
      if (v) (f as Record<string, string>)[key] = v;
    });
    return f;
  }, [route.query]);

  const setFilter = (key: keyof Filters, value: string) => {
    const params: Record<string, string> = {};
    Object.entries(FROM_URL).forEach(([param, k]) => {
      const v = k === key ? value : filters[k];
      if (v) params[param] = v;
    });
    if (key === 'department') {
      delete params.provincia;
      delete params.municipio;
    }
    navigate(`/registros${buildQuery(params)}`, { replace: true });
  };

  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'updatedAt', order: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [result, setResult] = useState<Page<MiningRecord>>({ items: [], total: 0, page: 1, pageSize: 25 });
  const [loadErr, setLoadErr] = useState('');
  const [qInput, setQInput] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => setQInput(filters.q), [filters.q]);
  useEffect(() => setPage(1), [filters]);

  // Consulta paginada (en modo API, la paginación y el orden los resuelve PostgreSQL).
  useEffect(() => {
    let alive = true;
    provider.miningRecords
      .query({ ...filters, sort: sort.key as keyof MiningRecord, order: sort.order, page, pageSize })
      .then((r) => alive && (setResult(r), setLoadErr('')))
      .catch((e) => alive && setLoadErr(e.message));
    return () => {
      alive = false;
    };
  }, [provider, filters, sort, page, pageSize, miningRecords]);

  const dept = DEPARTMENTS.find((d) => d.name === filters.department);
  const provinces = dept ? Array.from(new Set(dept.municipalities.map((m) => m.province))) : [];
  const municipalities = dept ? dept.municipalities.filter((m) => !filters.province || m.province === filters.province) : [];
  const coordSearch = filters.q ? parseCoordinateQuery(filters.q) : null;
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'q' && v).length;

  const exportAs = async (format: 'csv' | 'geojson') => {
    const rows = filterMiningRecords(miningRecords, filters);
    const stamp = todayISO();
    if (format === 'csv') downloadText(`geoalerta_registros_${stamp}.csv`, recordsToCSV(rows), 'text/csv;charset=utf-8');
    else downloadText(`geoalerta_registros_${stamp}.geojson`, JSON.stringify(recordsToGeoJSON(rows), null, 1), 'application/geo+json');
    await mutate((p) => p.audit.logClientEvent({ action: 'exportar', entityType: 'registro_minero', entityId: `${rows.length} registros`, summary: `Exportación ${format.toUpperCase()} de ${rows.length} registros con filtros aplicados.` }), {});
  };

  const columns: Column<MiningRecord>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs text-navy-800">{r.id}</span> },
    {
      key: 'name',
      header: 'Operación',
      render: (r) => (
        <div className="min-w-[180px]">
          <div className="font-semibold text-navy-900 flex items-center gap-1.5">
            {r.name} <DemoBadge show={r.origin === 'demo'} />
          </div>
          <div className="text-[11px] text-ink-500">{r.holder}</div>
        </div>
      )
    },
    { key: 'department', header: 'Ubicación', render: (r) => <div className="text-xs"><div>{r.municipality}</div><div className="text-ink-500">{r.province} · {r.department}</div></div> },
    { key: 'miningType', header: 'Tipo', render: (r) => <span className="text-xs">{MINING_TYPE[r.miningType].short}</span>, hideOnMobile: true },
    { key: 'adminStatus', header: 'Situación', render: (r) => <StatusBadge status={r.adminStatus} /> },
    { key: 'verification', header: 'Verificación', render: (r) => <VerificationBadge state={r.classification.verificationState} />, hideOnMobile: true },
    { key: 'miningRightCode', header: 'Cód. derecho', render: (r) => <span className="font-mono text-[11px]">{r.miningRightCode ?? '—'}</span>, hideOnMobile: true },
    { key: 'updatedAt', header: 'Actualizado', render: (r) => <span className="text-xs whitespace-nowrap">{formatDate(r.updatedAt)}</span>, hideOnMobile: true }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Registros mineros"
        description="Inventario georreferenciado de operaciones mineras con su situación administrativa y respaldo documental."
        actions={
          <>
            <Button icon={<MapIcon className="w-4 h-4" />} onClick={() => navigate(`/mapa${buildQuery({ departamento: filters.department, estado: filters.adminStatus, tipo: filters.miningType })}`)}>
              Ver en mapa
            </Button>
            {can('records.export') && (
              <>
                <Button icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => exportAs('csv')}>
                  CSV
                </Button>
                <Button icon={<Download className="w-4 h-4" />} onClick={() => exportAs('geojson')}>
                  GeoJSON
                </Button>
              </>
            )}
            {can('records.import') && (
              <Button icon={<Upload className="w-4 h-4" />} onClick={() => setImporting(true)}>
                Importar
              </Button>
            )}
            {can('records.create') && (
              <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
                Nuevo registro
              </Button>
            )}
          </>
        }
      />

      <div className="bg-white rounded-lg border border-ink-200 shadow-card p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter('q', qInput.trim());
            }}
          >
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              aria-label="Buscar registros"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onBlur={() => qInput.trim() !== filters.q && setFilter('q', qInput.trim())}
              placeholder="Nombre, ID (GA-MIN-…), código de derecho, titular, municipio o coordenadas «-15.56, -67.98»"
              className="pl-9"
            />
          </form>
          <Button icon={<Filter className="w-4 h-4" />} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            Filtros {activeFilterCount > 0 && <span className="bg-teal-700 text-white rounded px-1.5 text-[10px]">{activeFilterCount}</span>}
          </Button>
          {(activeFilterCount > 0 || filters.q) && (
            <Button variant="ghost" icon={<RotateCcw className="w-4 h-4" />} onClick={() => navigate('/registros', { replace: true })}>
              Limpiar
            </Button>
          )}
        </div>
        {coordSearch && (
          <p className="text-xs text-teal-800">
            Búsqueda por coordenadas: registros a ≤ 10 km de {coordSearch.lat.toFixed(4)}, {coordSearch.lng.toFixed(4)}.
          </p>
        )}
        <div className={`${showFilters || activeFilterCount ? 'grid' : 'hidden'} grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2`}>
          <Select aria-label="Departamento" value={filters.department} onChange={(e) => setFilter('department', e.target.value)}>
            <option value="">Departamento: todos</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code}>{d.name}</option>
            ))}
          </Select>
          <Select aria-label="Provincia" value={filters.province} onChange={(e) => setFilter('province', e.target.value)} disabled={!dept}>
            <option value="">Provincia: todas</option>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select aria-label="Municipio" value={filters.municipality} onChange={(e) => setFilter('municipality', e.target.value)} disabled={!dept}>
            <option value="">Municipio: todos</option>
            {municipalities.map((m) => (
              <option key={m.name}>{m.name}</option>
            ))}
          </Select>
          <Select aria-label="Tipo de minería" value={filters.miningType} onChange={(e) => setFilter('miningType', e.target.value)}>
            <option value="">Tipo: todos</option>
            {MINING_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {MINING_TYPE[t].label}
              </option>
            ))}
          </Select>
          <Select aria-label="Situación administrativa" value={filters.adminStatus} onChange={(e) => setFilter('adminStatus', e.target.value)}>
            <option value="">Situación: todas</option>
            {ADMIN_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ADMIN_STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select aria-label="Estado de verificación" value={filters.verificationState} onChange={(e) => setFilter('verificationState', e.target.value)}>
            <option value="">Verificación: todas</option>
            {Object.entries(VERIFICATION_STATE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label="Registrado desde" title="Registrado desde" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
          <Input type="date" aria-label="Registrado hasta" title="Registrado hasta" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
        </div>
      </div>

      {loadErr && <Notice tone="danger">{loadErr}</Notice>}

      <DataTable
        rows={result.items}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/registros/${r.id}`)}
        controlled={{
          sort,
          onSort: setSort,
          page: result.page,
          pageSize,
          total: result.total,
          onPage: setPage,
          onPageSize: (n) => {
            setPageSize(n);
            setPage(1);
          }
        }}
      />

      <RecordFormModal open={creating} onClose={() => setCreating(false)} onSaved={(r) => navigate(`/registros/${r.id}`)} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </div>
  );
};

const ImportModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { mutate } = useData();
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setSourceLabel('');
    }
  }, [open]);

  const ext = file?.name.split('.').pop()?.toLowerCase() ?? '';
  const format = ext === 'csv' ? 'csv' : ext === 'geojson' || ext === 'json' ? 'geojson' : ext === 'xlsx' ? 'xlsx' : ext === 'zip' ? 'shapefile' : null;

  const run = async () => {
    if (!file || !format) return;
    setBusy(true);
    const r = await mutate((p) => p.miningRecords.importFile(file, { format, sourceLabel: sourceLabel.trim() || `Importación ${file.name}` }), { reload: ['miningRecords'] });
    setBusy(false);
    if (r) setResult(r);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Importar registros mineros"
      subtitle="CSV, Excel (.xlsx), GeoJSON o Shapefile (.zip con .shp, .shx, .dbf y .prj)"
      footer={
        <>
          <Button onClick={onClose}>{result ? 'Cerrar' : 'Cancelar'}</Button>
          {!result && (
            <Button variant="primary" onClick={run} disabled={!file || !format} loading={busy}>
              Importar
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <Notice>
          Columnas esperadas: <code className="text-[11px]">nombre, latitud, longitud, departamento, provincia, municipio, localidad, tipo_mineria, situacion_administrativa, institucion_respaldo, documento_respaldo, fecha_consulta, estado_verificacion, titular, codigo_derecho_minero, fecha_registro, fuente, observaciones</code>.
          Las filas sin documento de respaldo se importan como <strong>Sin determinar</strong>. Los duplicados (mismo código de derecho, o mismo nombre a menos de 500 m) se omiten.
        </Notice>
        <Field label="Archivo">{(id) => <input id={id} type="file" accept=".csv,.xlsx,.geojson,.json,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />}</Field>
        {file && !format && <Notice tone="danger">Formato no reconocido. Use .csv, .xlsx, .geojson o .zip (Shapefile).</Notice>}
        <Field label="Fuente de los datos" hint="Se guardará en cada registro importado.">
          {(id) => <Input id={id} value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="p. ej. Inventario técnico 2026 — Gobernación" />}
        </Field>
        <a
          className="text-xs text-teal-800 underline"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent('nombre,latitud,longitud,departamento,provincia,municipio,localidad,tipo_mineria,mineral,situacion_administrativa,institucion_respaldo,documento_respaldo,fecha_consulta,estado_verificacion,titular,codigo_derecho_minero,fecha_registro,fuente,observaciones\n')}`}
          download="plantilla_registros_geoalerta.csv"
        >
          Descargar plantilla CSV
        </a>
        {result && (
          <div className="rounded-md border border-ink-200 p-3 space-y-1">
            <p>
              <strong className="text-teal-800">{result.created}</strong> registros creados · <strong>{result.skippedDuplicates}</strong> duplicados omitidos ·{' '}
              <strong className={result.errors.length ? 'text-coral-700' : ''}>{result.errors.length}</strong> filas con errores
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-40 overflow-y-auto text-xs text-coral-800 list-disc pl-5">
                {result.errors.slice(0, 100).map((e) => (
                  <li key={e.row}>
                    Fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
