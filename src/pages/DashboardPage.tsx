import React, { useMemo, useState } from 'react';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { useData, useReferenceDate } from '../app/data';
import { navigate, buildQuery } from '../app/router';
import { ChartCard, DonutChart, HBarChart, LineChart, StackedBars } from '../components/charts';
import { GeoMap, MapLegend, type MapSelection } from '../components/GeoMap';
import { Badge, Card, KpiCard, Notice, PageHeader, Spinner } from '../components/ui';
import { DEPARTMENTS } from '../data/boliviaGeo';
import { ADMIN_STATUS, ADMIN_STATUS_ORDER, ALERT_PRIORITY, DATA_COLORS, MINING_TYPE, MINING_TYPE_ORDER } from '../domain/catalogs';
import { countBy, monthlySeries } from '../domain/query';
import { formatDate, formatNumber } from '../domain/util';
import { DATA_MODE } from '../services';

export const DashboardPage: React.FC = () => {
  const { miningRecords: records, reports, satellites, alerts, loading } = useData();
  const ref = useReferenceDate();
  const [selected, setSelected] = useState<MapSelection | null>(null);

  const byStatus = useMemo(() => Object.fromEntries(countBy(records, (r) => r.adminStatus, ADMIN_STATUS_ORDER).map((c) => [c.key, c.count])), [records]);
  const pendingReports = reports.filter((r) => r.status === 'recibido' || r.status === 'pendiente_revision').length;
  const activeAlerts = alerts.filter((a) => a.status === 'activa');

  const deptRows = useMemo(
    () =>
      DEPARTMENTS.map((d) => {
        const rs = records.filter((r) => r.department === d.name);
        return { key: d.name, label: d.name, total: rs.length, values: Object.fromEntries(ADMIN_STATUS_ORDER.map((s) => [s, rs.filter((r) => r.adminStatus === s).length])) };
      }).sort((a, b) => b.total - a.total),
    [records]
  );
  const typeData = useMemo(
    () => countBy(records, (r) => r.miningType, MINING_TYPE_ORDER).map((c) => ({ key: c.key, label: MINING_TYPE[c.key].short, value: c.count })),
    [records]
  );
  const recordSeries = useMemo(() => monthlySeries(records, (r) => r.registeredAt, 24, ref), [records, ref]);
  const reportDept = useMemo(
    () => DEPARTMENTS.map((d) => ({ key: d.name, label: d.name, value: reports.filter((r) => r.department === d.name).length })).sort((a, b) => b.value - a.value),
    [reports]
  );
  const settlements = useMemo(() => satellites.filter((s) => s.observationType === 'posible_asentamiento' && s.reviewState !== 'descartada'), [satellites]);
  const settlementCount = useMemo(() => monthlySeries(settlements, (s) => s.acquisitionDate, 12, ref), [settlements, ref]);
  const settlementArea = useMemo(() => monthlySeries(settlements, (s) => s.acquisitionDate, 12, ref, (s) => s.approxAreaHa), [settlements, ref]);

  if (loading && !records.length) return <Spinner label="Cargando información territorial…" />;

  const go = (path: string, q: Record<string, string> = {}) => navigate(path + buildQuery(q));
  const total = records.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Centro de monitoreo territorial"
        description="Situación consolidada de los registros mineros, denuncias, observaciones satelitales y alertas en el territorio boliviano."
        actions={<span className="text-xs text-ink-500">Datos al {formatDate(ref.toISOString().slice(0, 10))}</span>}
      />
      {DATA_MODE === 'demo' && (
        <Notice tone="warning">
          <strong>Datos demostrativos.</strong> Todas las cifras de este panel se calculan sobre un conjunto de ejemplo y no representan estadísticas
          oficiales. Para ver información real, conecte la plataforma a la base de datos central (ver documentación).
        </Notice>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <KpiCard label="Registros mineros" value={formatNumber(total)} accent={DATA_COLORS.navyDeep} onClick={() => go('/registros')} hint="Total en el sistema" />
        {ADMIN_STATUS_ORDER.map((s) => (
          <KpiCard
            key={s}
            label={ADMIN_STATUS[s].label}
            value={formatNumber(byStatus[s] ?? 0)}
            accent={ADMIN_STATUS[s].color}
            hint={total ? `${Math.round(((byStatus[s] ?? 0) / total) * 100)}% del total` : undefined}
            onClick={() => go('/registros', { estado: s })}
          />
        ))}
        <KpiCard label="Denuncias recibidas" value={formatNumber(reports.length)} accent={DATA_COLORS.navy} onClick={() => go('/denuncias')} />
        <KpiCard label="Denuncias pendientes de revisión" value={formatNumber(pendingReports)} accent={DATA_COLORS.gold} onClick={() => go('/denuncias', { estado: 'pendientes' })} />
        <KpiCard label="Observaciones satelitales" value={formatNumber(satellites.length)} accent={DATA_COLORS.teal} onClick={() => go('/satelital')} />
        <KpiCard label="Alertas territoriales activas" value={formatNumber(activeAlerts.length)} accent={DATA_COLORS.coral} onClick={() => go('/alertas', { estado: 'activa' })} />
      </div>

      {/* Mapa principal */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">
        <Card
          title="Mapa de Bolivia"
          subtitle="Registros por situación administrativa, denuncias, observaciones y alertas activas"
          bodyClassName="p-0"
          actions={
            <a href="#/mapa" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline">
              <Maximize2 className="w-3.5 h-3.5" /> Abrir mapa completo
            </a>
          }
        >
          <GeoMap
            className="h-[440px] sm:h-[520px]"
            records={records}
            reports={reports.filter((r) => r.status !== 'cerrado')}
            satellites={satellites.filter((s) => s.reviewState !== 'descartada')}
            alerts={activeAlerts}
            layers={{ rivers: false }}
            selected={selected}
            onSelect={(sel) => {
              setSelected(sel);
              if (sel.kind === 'record') navigate(`/registros/${sel.id}`);
              else navigate(`/mapa${buildQuery({ sel: `${sel.kind}:${sel.id}` })}`);
            }}
          />
          <div className="px-4 py-2.5 border-t border-ink-100 bg-ivory-50">
            <MapLegend compact />
          </div>
        </Card>

        <Card
          title="Alertas activas"
          subtitle="Ordenadas por prioridad"
          bodyClassName="p-0"
          actions={
            <a href="#/alertas" className="text-xs font-semibold text-teal-800 hover:underline inline-flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </a>
          }
        >
          <ul className="divide-y divide-ink-100 max-h-[560px] overflow-y-auto">
            {activeAlerts.length === 0 && <li className="p-4 text-xs text-ink-500">Sin alertas activas.</li>}
            {[...activeAlerts]
              .sort((a, b) => ['alta', 'media', 'baja'].indexOf(a.priority) - ['alta', 'media', 'baja'].indexOf(b.priority) || b.createdAt.localeCompare(a.createdAt))
              .map((a) => (
                <li key={a.id}>
                  <a href={`#/alertas?id=${encodeURIComponent(a.id)}`} className="block px-4 py-2.5 hover:bg-ivory-50">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={ALERT_PRIORITY[a.priority].badge}>{ALERT_PRIORITY[a.priority].label}</Badge>
                      <span className="text-[11px] text-ink-500">{formatDate(a.createdAt)}</span>
                    </div>
                    <div className="text-sm font-semibold text-navy-900 leading-snug">{a.title}</div>
                    <div className="text-[11px] text-ink-500">
                      {a.department} · {a.municipality}
                    </div>
                  </a>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <ChartCard
          title="Actividades mineras por departamento"
          subtitle="Barras segmentadas por situación administrativa · clic para filtrar"
          legend={ADMIN_STATUS_ORDER.map((s) => ({ label: ADMIN_STATUS[s].short, color: ADMIN_STATUS[s].color }))}
          table={{ headers: ['Departamento', ...ADMIN_STATUS_ORDER.map((s) => ADMIN_STATUS[s].short), 'Total'], rows: deptRows.map((d) => [d.label, ...ADMIN_STATUS_ORDER.map((s) => d.values[s]), d.total]) }}
        >
          <StackedBars
            rows={deptRows}
            segments={ADMIN_STATUS_ORDER.map((s) => ({ key: s, label: ADMIN_STATUS[s].label, color: ADMIN_STATUS[s].color }))}
            onSelect={(dept, status) => go('/registros', { departamento: dept, estado: status })}
          />
        </ChartCard>

        <ChartCard
          title="Clasificación por situación administrativa"
          subtitle="Proporción sobre el total de registros"
          table={{ headers: ['Situación', 'Registros'], rows: ADMIN_STATUS_ORDER.map((s) => [ADMIN_STATUS[s].label, byStatus[s] ?? 0]) }}
        >
          <DonutChart
            data={ADMIN_STATUS_ORDER.map((s) => ({ key: s, label: ADMIN_STATUS[s].label, value: byStatus[s] ?? 0, color: ADMIN_STATUS[s].color }))}
            centerLabel="registros"
            onSelect={(d) => go('/registros', { estado: d.key })}
          />
        </ChartCard>

        <ChartCard title="Distribución por tipo de minería" subtitle="Número de registros" table={{ headers: ['Tipo', 'Registros'], rows: typeData.map((d) => [MINING_TYPE[d.key].label, d.value]) }}>
          <HBarChart data={typeData} color={DATA_COLORS.navy} onSelect={(d) => go('/registros', { tipo: d.key })} />
        </ChartCard>

        <ChartCard
          title="Evolución temporal de registros"
          subtitle="Nuevos registros por mes · últimos 24 meses"
          table={{ headers: ['Mes', 'Nuevos registros'], rows: recordSeries.map((m) => [m.month, m.value]) }}
        >
          <LineChart labels={recordSeries.map((m) => m.label)} series={[{ key: 'r', label: 'Nuevos registros', color: DATA_COLORS.teal, values: recordSeries.map((m) => m.value) }]} />
        </ChartCard>

        <ChartCard title="Denuncias por departamento" subtitle="Total de denuncias ciudadanas recibidas" table={{ headers: ['Departamento', 'Denuncias'], rows: reportDept.map((d) => [d.label, d.value]) }}>
          <HBarChart data={reportDept} color={DATA_COLORS.gold} onSelect={(d) => go('/denuncias', { departamento: d.key })} />
        </ChartCard>

        <ChartCard
          title="Evolución de posibles asentamientos"
          subtitle="Observaciones satelitales «posible asentamiento» por mes · 12 meses"
          table={{ headers: ['Mes', 'Observaciones', 'Superficie estimada (ha)'], rows: settlementCount.map((m, i) => [m.month, m.value, +settlementArea[i].value.toFixed(1)]) }}
        >
          <LineChart labels={settlementCount.map((m) => m.label)} series={[{ key: 'n', label: 'Observaciones', color: DATA_COLORS.coral, values: settlementCount.map((m) => m.value) }]} />
          <div className="flex items-baseline justify-between mt-2 text-xs">
            <span className="text-ink-600">Superficie estimada acumulada (12 meses)</span>
            <strong className="text-navy-900 tabular-nums">{formatNumber(settlementArea.reduce((s, m) => s + m.value, 0), 1)} ha</strong>
          </div>
          <p className="text-[10px] text-ink-500 mt-1">Detecciones de cambio, no confirmaciones de asentamientos. Superficie mensual en la vista de tabla.</p>
        </ChartCard>
      </div>
    </div>
  );
};
