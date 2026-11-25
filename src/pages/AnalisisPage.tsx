import React, { useMemo, useState } from 'react';
import { useData, useReferenceDate } from '../app/data';
import { navigate, buildQuery } from '../app/router';
import { ChartCard, DonutChart, HBarChart, LineChart, StackedBars } from '../components/charts';
import { StatusBadge } from '../components/records';
import { Card, DataTable, KpiCard, Notice, PageHeader, Select, type Column } from '../components/ui';
import { DEPARTMENTS, PROTECTED_AREAS_DEMO } from '../data/boliviaGeo';
import { ADMIN_STATUS, ADMIN_STATUS_ORDER, DATA_COLORS, MINING_TYPE, MINING_TYPE_ORDER, VERIFICATION_STATE } from '../domain/catalogs';
import { pointInPolygon } from '../domain/geo';
import { monthlySeries } from '../domain/query';
import type { MiningRecord } from '../types/domain';

export const AnalisisPage: React.FC = () => {
  const { miningRecords, reports, satellites } = useData();
  const ref = useReferenceDate();
  const [department, setDepartment] = useState('');
  const [months, setMonths] = useState(12);

  const recs = useMemo(() => miningRecords.filter((r) => !department || r.department === department), [miningRecords, department]);
  const reps = useMemo(() => reports.filter((r) => !department || r.department === department), [reports, department]);
  const sats = useMemo(() => satellites.filter((s) => !department || s.department === department), [satellites, department]);

  const withoutSupport = recs.filter((r) => r.adminStatus !== 'sin_determinar' && r.classification.verificationState === 'no_verificado');
  const crossed = recs.filter((r) => r.relatedSatelliteIds.length > 0 && r.relatedReportIds.length > 0);
  const inProtected = useMemo(
    () => recs.filter((r) => PROTECTED_AREAS_DEMO.some((a) => pointInPolygon(r.lat, r.lng, a.polygon))),
    [recs]
  );
  const priority = useMemo(
    () =>
      recs
        .filter((r) => r.adminStatus === 'presuntamente_irregular' || r.adminStatus === 'sin_determinar')
        .map((r) => ({ r, score: r.relatedSatelliteIds.length * 2 + r.relatedReportIds.length * 2 + (inProtected.includes(r) ? 3 : 0) + (r.adminStatus === 'presuntamente_irregular' ? 1 : 0) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score),
    [recs, inProtected]
  );

  const matrix = MINING_TYPE_ORDER.map((t) => ({ key: t, label: MINING_TYPE[t].short, values: Object.fromEntries(ADMIN_STATUS_ORDER.map((s) => [s, recs.filter((r) => r.miningType === t && r.adminStatus === s).length])) })).filter((row) => Object.values(row.values).some((v) => v > 0));
  const verif = Object.entries(VERIFICATION_STATE).map(([k, v], i) => ({ key: k, label: v.label, value: recs.filter((r) => r.classification.verificationState === k).length, color: [DATA_COLORS.neutral, DATA_COLORS.navy, DATA_COLORS.teal, DATA_COLORS.gold][i] }));
  const repSeries = monthlySeries(reps, (r) => r.createdAt, months, ref);
  const satSeries = monthlySeries(sats, (s) => s.acquisitionDate, months, ref);
  const byMunicipality = useMemo(() => {
    const m = new Map<string, { municipality: string; department: string; total: number; irregular: number; reports: number; obs: number }>();
    recs.forEach((r) => {
      const k = `${r.department}|${r.municipality}`;
      const e = m.get(k) ?? { municipality: r.municipality, department: r.department, total: 0, irregular: 0, reports: 0, obs: 0 };
      e.total++;
      if (r.adminStatus === 'presuntamente_irregular' || r.adminStatus === 'ilegal_verificada') e.irregular++;
      m.set(k, e);
    });
    reps.forEach((r) => {
      const e = m.get(`${r.department}|${r.municipality}`);
      if (e) e.reports++;
    });
    sats.forEach((s) => {
      const e = m.get(`${s.department}|${s.municipality}`);
      if (e) e.obs++;
    });
    return Array.from(m.values());
  }, [recs, reps, sats]);

  type MunRow = (typeof byMunicipality)[number];
  const munColumns: Column<MunRow>[] = [
    { key: 'm', header: 'Municipio', render: (r) => <span className="font-semibold text-navy-900">{r.municipality}</span>, sortValue: (r) => r.municipality },
    { key: 'd', header: 'Departamento', render: (r) => r.department, sortValue: (r) => r.department },
    { key: 't', header: 'Registros', render: (r) => <span className="tabular-nums">{r.total}</span>, sortValue: (r) => r.total },
    { key: 'i', header: 'Presunta irreg. / ilegal verif.', render: (r) => <span className="tabular-nums">{r.irregular}</span>, sortValue: (r) => r.irregular },
    { key: 'r', header: 'Denuncias', render: (r) => <span className="tabular-nums">{r.reports}</span>, sortValue: (r) => r.reports },
    { key: 'o', header: 'Observaciones', render: (r) => <span className="tabular-nums">{r.obs}</span>, sortValue: (r) => r.obs }
  ];
  const prioColumns: Column<{ r: MiningRecord; score: number }>[] = [
    { key: 'n', header: 'Registro', render: ({ r }) => <div><div className="font-semibold text-navy-900">{r.name}</div><div className="font-mono text-[11px] text-ink-500">{r.id}</div></div>, sortValue: ({ r }) => r.name },
    { key: 's', header: 'Situación', render: ({ r }) => <StatusBadge status={r.adminStatus} /> },
    { key: 'e', header: 'Indicios', render: ({ r }) => <span className="text-xs">{r.relatedSatelliteIds.length} obs. · {r.relatedReportIds.length} den.{inProtected.includes(r) ? ' · área protegida (ref.)' : ''}</span> },
    { key: 'p', header: 'Puntaje', render: ({ score }) => <strong className="tabular-nums">{score}</strong>, sortValue: ({ score }) => score }
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Análisis territorial"
        description="Cruces entre registros, denuncias, observaciones satelitales y capas de referencia para priorizar la verificación."
        actions={
          <>
            <Select aria-label="Departamento" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-44">
              <option value="">Toda Bolivia</option>
              {DEPARTMENTS.map((d) => <option key={d.code}>{d.name}</option>)}
            </Select>
            <Select aria-label="Periodo" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="w-36">
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
              <option value={24}>24 meses</option>
            </Select>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard label="Registros en el ámbito" value={recs.length} accent={DATA_COLORS.navyDeep} />
        <KpiCard label="Con observación y denuncia vinculadas" value={crossed.length} accent={DATA_COLORS.gold} hint="Coincidencia entre fuentes" />
        <KpiCard label="Dentro de áreas protegidas (referenciales)" value={inProtected.length} accent={DATA_COLORS.coral} hint="Polígonos aproximados, no oficiales" />
        <KpiCard label="Clasificados sin verificación" value={withoutSupport.length} accent={DATA_COLORS.navy} hint="Requieren verificar respaldo" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <ChartCard
          title="Tipo de minería × situación administrativa"
          legend={ADMIN_STATUS_ORDER.map((s) => ({ label: ADMIN_STATUS[s].short, color: ADMIN_STATUS[s].color }))}
          table={{ headers: ['Tipo', ...ADMIN_STATUS_ORDER.map((s) => ADMIN_STATUS[s].short)], rows: matrix.map((m) => [m.label, ...ADMIN_STATUS_ORDER.map((s) => m.values[s])]) }}
        >
          <StackedBars rows={matrix} segments={ADMIN_STATUS_ORDER.map((s) => ({ key: s, label: ADMIN_STATUS[s].label, color: ADMIN_STATUS[s].color }))} onSelect={(t, s) => navigate(`/registros${buildQuery({ tipo: t, estado: s, departamento: department })}`)} />
        </ChartCard>
        <ChartCard title="Estado de verificación de los registros" table={{ headers: ['Estado', 'Registros'], rows: verif.map((v) => [v.label, v.value]) }}>
          <DonutChart data={verif} centerLabel="registros" />
        </ChartCard>
        <ChartCard
          title="Denuncias y observaciones por mes"
          subtitle="Mismo tipo de medida (conteo) en un único eje"
          legend={[{ label: 'Denuncias', color: DATA_COLORS.gold }, { label: 'Observaciones satelitales', color: DATA_COLORS.teal }]}
          table={{ headers: ['Mes', 'Denuncias', 'Observaciones'], rows: repSeries.map((m, i) => [m.month, m.value, satSeries[i].value]) }}
        >
          <LineChart labels={repSeries.map((m) => m.label)} series={[{ key: 'r', label: 'Denuncias', color: DATA_COLORS.gold, values: repSeries.map((m) => m.value) }, { key: 's', label: 'Observaciones', color: DATA_COLORS.teal, values: satSeries.map((m) => m.value) }]} />
        </ChartCard>
        <ChartCard title="Superficie observada por departamento" subtitle="Suma de superficie estimada (ha) de observaciones no descartadas" table={{ headers: ['Departamento', 'ha'], rows: DEPARTMENTS.map((d) => [d.name, +sats.filter((s) => s.department === d.name && s.reviewState !== 'descartada').reduce((a, s) => a + s.approxAreaHa, 0).toFixed(1)]) }}>
          <HBarChart
            data={DEPARTMENTS.map((d) => ({ key: d.name, label: d.name, value: +sats.filter((s) => s.department === d.name && s.reviewState !== 'descartada').reduce((a, s) => a + s.approxAreaHa, 0).toFixed(1) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)}
            color={DATA_COLORS.navy}
            valueSuffix=" ha"
          />
        </ChartCard>
      </div>

      <Card title="Priorización para verificación" subtitle="Registros «presuntamente irregulares» o «sin determinar» con más indicios convergentes. El puntaje ordena el trabajo; no determina legalidad." bodyClassName="p-0">
        <DataTable rows={priority} columns={prioColumns} rowKey={(x) => x.r.id} onRowClick={(x) => navigate(`/registros/${x.r.id}`)} initialSort={{ key: 'p', order: 'desc' }} pageSize={10} />
      </Card>
      <Card title="Resumen por municipio" bodyClassName="p-0">
        <DataTable rows={byMunicipality} columns={munColumns} rowKey={(r) => `${r.department}-${r.municipality}`} initialSort={{ key: 't', order: 'desc' }} pageSize={10} />
      </Card>
      <Notice>Puntaje = 2 × observaciones vinculadas + 2 × denuncias vinculadas + 3 si está dentro de un área protegida referencial + 1 si es «presuntamente irregular».</Notice>
    </div>
  );
};
