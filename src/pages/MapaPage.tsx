import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BarChart3, Box, Compass, Crosshair, Download, ExternalLink, Filter, Layers, MapPin, Play, Search, X } from 'lucide-react';
import type { AdminStatus, MiningType, VerificationState } from '../types/domain';
import { useData } from '../app/data';
import { navigate, useRoute } from '../app/router';
import { DEFAULT_LAYERS, GeoMap, MapLegend, type LayerVisibility, type MapLayerKey, type MapSelection } from '../components/GeoMap';
import { GuidedTourORO42, TOUR_STEPS } from '../components/GuidedTourORO42';
import { DEMO_MAP_EVENT, getDemoMapScene, type DemoMapScene } from '../components/Demo60sController';
import { Oro42DecisionModal } from '../components/Oro42DecisionModal';
import { PilotoSwipeModal } from '../components/PilotoSwipeModal';
import { StatusBadge, VerificationBadge } from '../components/records';
import { Badge, Button, DemoBadge, DL, Input, Select, cx } from '../components/ui';
import { BOLIVIA_CENTER, BOLIVIA_ZOOM, DEPARTMENTS } from '../data/boliviaGeo';
import {
  ADMIN_STATUS,
  ADMIN_STATUS_ORDER,
  ALERT_PRIORITY,
  ALERT_STATUS,
  ALERT_TYPE,
  CONFIDENCE,
  MINING_TYPE,
  MINING_TYPE_ORDER,
  OBSERVATION_ORIGIN,
  OBSERVATION_TYPE,
  REPORT_CATEGORY,
  REPORT_STATUS,
  REVIEW_STATE,
  SENSOR,
  VERIFICATION_STATE
} from '../domain/catalogs';
import { filterMiningRecords, normalizeText } from '../domain/query';
import { formatCoord, formatDate } from '../domain/util';
import { isInsideBolivia, parseCoordinateQuery } from '../domain/validation';

const PILOTO_VIEW = { lat: -15.47, lng: -67.8, zoom: 12 };
const GeoMap3D = lazy(() => import('../components/GeoMap3D').then((m) => ({ default: m.GeoMap3D })));

const LAYER_LABELS: Record<MapLayerKey, string> = {
  records: 'Registros mineros (puntos)',
  polygons: 'Áreas de operación (polígonos)',
  reports: 'Denuncias ciudadanas',
  satellites: 'Observaciones satelitales',
  alerts: 'Alertas territoriales',
  sourceDocs: 'Referencias institucionales (demo)',
  protectedAreas: 'Áreas protegidas (referencial)',
  departments: 'Límites departamentales (referencial)',
  rivers: 'Ríos principales (referencial)',
  desafio4Persistente: 'Focos persistentes (2022–2026)',
  desafio4Nuevo: 'Expansión nueva (2022–2026)',
  desafio4Sar: 'Anomalías Radar SAR (sin nubes)',
  desafio4Prioridad: 'Índice de prioridad ORO-4.2 (0–100)',
  pilotoS2_2022: 'Sentinel-2 Óptico (2022)',
  pilotoS2_2026: 'Sentinel-2 Óptico (2026)',
  pilotoNdti: 'Turbidez en río · NDTI (2026)',
  pilotoSar: 'Radar Sentinel-1 VV (sin nubes)',
  pilotoRiesgoHg: 'Mapa de riesgo Hg (0–100)',
  pilotoPasivos: 'Pasivos / colas en reposo',
  pilotoTop15: 'Top 15 cuadrantes y GPS (ORO-4.2)'
};

const PILOTO_KEYS: MapLayerKey[] = [
  'pilotoS2_2022',
  'pilotoS2_2026',
  'pilotoNdti',
  'pilotoSar',
  'pilotoRiesgoHg',
  'pilotoPasivos',
  'pilotoTop15'
];

const LAYER_GROUPS: { id: 'base' | 'nacional' | 'piloto'; title: string; keys: MapLayerKey[] }[] = [
  {
    id: 'base',
    title: 'Gestión territorial y referencia',
    keys: ['records', 'polygons', 'reports', 'satellites', 'alerts', 'sourceDocs', 'protectedAreas', 'departments', 'rivers']
  },
  {
    id: 'nacional',
    title: 'Motor Nacional ORO-4.2 (Bolivia)',
    keys: ['desafio4Persistente', 'desafio4Nuevo', 'desafio4Sar', 'desafio4Prioridad']
  },
  {
    id: 'piloto',
    title: 'Zona Piloto · Tipuani–Mapiri–Kaka',
    keys: PILOTO_KEYS
  }
];

export const MapaPage: React.FC = () => {
  const route = useRoute();
  const { miningRecords, reports, satellites, alerts, sourceDocuments } = useData();

  const [department, setDepartment] = useState(route.query.get('departamento') ?? '');
  const [province, setProvince] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [miningType, setMiningType] = useState<MiningType | ''>((route.query.get('tipo') as MiningType) ?? '');
  const [adminStatus, setAdminStatus] = useState<AdminStatus | ''>((route.query.get('estado') as AdminStatus) ?? '');
  const [verification, setVerification] = useState<VerificationState | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [search, setSearch] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number; key: string } | null>(null);
  const [selected, setSelected] = useState<MapSelection | null>(() => {
    const sel = route.query.get('sel');
    if (!sel) return null;
    const [kind, ...rest] = sel.split(':');
    return { kind, id: rest.join(':') } as MapSelection;
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);

  const dept = DEPARTMENTS.find((d) => d.name === department);
  const provinces = dept ? Array.from(new Set(dept.municipalities.map((m) => m.province))) : [];
  const municipalities = dept ? dept.municipalities.filter((m) => !province || m.province === province) : [];

  const filteredRecords = useMemo(
    () => filterMiningRecords(miningRecords, { department, province, municipality, miningType, adminStatus, verificationState: verification, dateFrom, dateTo }),
    [miningRecords, department, province, municipality, miningType, adminStatus, verification, dateFrom, dateTo]
  );
  const inArea = <T extends { department: string; municipality: string },>(x: T) => (!department || x.department === department) && (!municipality || x.municipality === municipality);
  const inDates = (d: string) => (!dateFrom || d.slice(0, 10) >= dateFrom) && (!dateTo || d.slice(0, 10) <= dateTo);
  const filteredReports = useMemo(() => reports.filter((r) => inArea(r) && inDates(r.createdAt)), [reports, department, municipality, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredSats = useMemo(() => satellites.filter((s) => inArea(s) && inDates(s.acquisitionDate)), [satellites, department, municipality, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredAlerts = useMemo(() => alerts.filter((a) => a.status !== 'cerrada' && inArea(a)), [alerts, department, municipality]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centrar en la selección inicial (enlace desde otras secciones).
  useEffect(() => {
    if (!selected) return;
    const p = locate(selected);
    if (p) setFocus({ ...p, zoom: 11, key: `${selected.kind}:${selected.id}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miningRecords.length, reports.length, satellites.length]);

// Sincronizar escenas automáticas del botón global Demo 60s
  const recordsRef = useRef(miningRecords);
  recordsRef.current = miningRecords;

  // Sincronizar escenas automáticas del botón global Demo 60s
  useEffect(() => {
    const allOff = () =>
      Object.fromEntries(
        (Object.keys(DEFAULT_LAYERS) as MapLayerKey[]).map((k) => [k, false])
      ) as LayerVisibility;

    const applyScene = (scene: DemoMapScene | null) => {
      if (!scene) return;

      if (scene === 'nacional-ficha') {
        setSwipeOpen(false);
        setDecisionOpen(false);
        setTourStep(null);
        setPin(null);
        setPanelOpen(false);
        setViewMode('2d');
        setLayers({
          ...allOff(),
          records: true,
          polygons: true,
          reports: true,
          satellites: true,
          alerts: true,
          protectedAreas: true,
          departments: true
        });
        setFocus({
          lat: BOLIVIA_CENTER[0],
          lng: BOLIVIA_CENTER[1],
          zoom: BOLIVIA_ZOOM,
          key: `demo-nac-ficha-${Date.now()}`
        });
        const first = recordsRef.current[0];
        setSelected(first ? { kind: 'record', id: first.id } : null);
      } else if (scene === 'nacional-oro42') {
        setSwipeOpen(false);
        setDecisionOpen(false);
        setTourStep(null);
        setSelected(null);
        setPin(null);
        setPanelOpen(false);
        setViewMode('2d');
        setLayers({
          ...allOff(),
          departments: true,
          protectedAreas: true,
          desafio4Persistente: true,
          desafio4Nuevo: true,
          desafio4Sar: true,
          desafio4Prioridad: true
        });
        setFocus({
          lat: BOLIVIA_CENTER[0],
          lng: BOLIVIA_CENTER[1],
          zoom: BOLIVIA_ZOOM,
          key: `demo-nac-oro42-${Date.now()}`
        });
      } else if (scene === 'piloto-3d') {
        setSwipeOpen(false);
        setDecisionOpen(false);
        setTourStep(null);
        setSelected(null);
        setPin(null);
        setPanelOpen(false);
        setViewMode('3d');
        setLayers({
          ...allOff(),
          departments: true,
          pilotoS2_2026: true,
          pilotoNdti: true,
          pilotoTop15: true
        });
        setFocus({ lat: -15.47, lng: -67.8, zoom: 12.2, key: `demo3d-${Date.now()}` });
      } else if (scene === 'swipe') {
        setDecisionOpen(false);
        setTourStep(null);
        setSwipeOpen(true);
      } else if (scene === 'decision') {
        setSwipeOpen(false);
        setTourStep(null);
        setDecisionOpen(true);
      } else if (scene === 'clear') {
        setSwipeOpen(false);
        setDecisionOpen(false);
        setTourStep(null);
        setSelected(null);
      }
    };

    applyScene(getDemoMapScene());
    const handler = (e: Event) => applyScene((e as CustomEvent<DemoMapScene | null>).detail);
    window.addEventListener(DEMO_MAP_EVENT, handler);
    return () => window.removeEventListener(DEMO_MAP_EVENT, handler);
  }, []);

  function locate(sel: MapSelection): { lat: number; lng: number } | undefined {
    const list = { record: miningRecords, report: reports, satellite: satellites, alert: alerts, sourceDoc: sourceDocuments }[sel.kind] as { id: string; lat: number; lng: number }[];
    return list.find((x) => x.id === sel.id);
  }

  const searchResults = useMemo(() => {
    const q = normalizeText(search);
    if (q.length < 2 || parseCoordinateQuery(search)) return [];
    const out: { sel: MapSelection; title: string; sub: string; lat: number; lng: number }[] = [];
    miningRecords.forEach((r) => {
      if (normalizeText(`${r.id} ${r.name} ${r.miningRightCode ?? ''} ${r.holder}`).includes(q)) out.push({ sel: { kind: 'record', id: r.id }, title: r.name, sub: `${r.id} · ${ADMIN_STATUS[r.adminStatus].short}`, lat: r.lat, lng: r.lng });
    });
    reports.forEach((r) => normalizeText(r.trackingCode).includes(q) && out.push({ sel: { kind: 'report', id: r.id }, title: `Denuncia ${r.trackingCode}`, sub: r.municipality, lat: r.lat, lng: r.lng }));
    satellites.forEach((s) => normalizeText(`${s.id} ${s.zoneName}`).includes(q) && out.push({ sel: { kind: 'satellite', id: s.id }, title: s.zoneName, sub: s.id, lat: s.lat, lng: s.lng }));
    DEPARTMENTS.forEach((d) => {
      if (normalizeText(d.name).includes(q)) out.push({ sel: { kind: 'record', id: '' }, title: d.name, sub: 'Departamento', lat: d.center[0], lng: d.center[1] });
      d.municipalities.forEach((m) => normalizeText(m.name).includes(q) && out.push({ sel: { kind: 'record', id: '' }, title: m.name, sub: `Municipio · ${m.province}, ${d.name}`, lat: m.lat, lng: m.lng }));
    });
    return out.slice(0, 8);
  }, [search, miningRecords, reports, satellites]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseCoordinateQuery(search);
    if (c) {
      if (!isInsideBolivia(c.lat, c.lng)) return alert('Las coordenadas indicadas están fuera de Bolivia.');
      setPin(c);
      setFocus({ ...c, zoom: 12, key: `pin:${search}` });
    } else if (searchResults[0]) pickResult(searchResults[0]);
  };
  const pickResult = (r: (typeof searchResults)[number]) => {
    setSearch('');
    setFocus({ lat: r.lat, lng: r.lng, zoom: r.sel.id ? 12 : r.sub === 'Departamento' ? 7 : 10, key: `${r.title}-${Date.now()}` });
    if (r.sel.id) setSelected(r.sel);
  };

  const applyTourStep = (idx: number) => {
    const step = TOUR_STEPS[idx];
    if (!step) return;
    setTourStep(idx);
    setSelected(null);
    setPin(null);
    setPanelOpen(false);
    setLayers(step.layers);
    setViewMode(step.viewMode);
    setFocus({ ...step.focus, key: `tour-${idx}-${Date.now()}` });
  };

  const goToPiloto = () => {
    setLayers((prev) => {
      const anyPilotoOn = PILOTO_KEYS.some((k) => prev[k]);
      return anyPilotoOn ? prev : { ...prev, pilotoS2_2026: true, pilotoNdti: true, pilotoTop15: true };
    });
    setFocus({ ...PILOTO_VIEW, key: `piloto-${Date.now()}` });
    setPanelOpen(false);
  };

  const flyToTop15Site = (lat: number, lng: number) => {
    setDecisionOpen(false);
    setTourStep(null);
    setPanelOpen(false);
    setLayers((prev) => ({ ...prev, pilotoS2_2026: true, pilotoTop15: true }));
    setPin({ lat, lng });
    setFocus({ lat, lng, zoom: 14, key: `top15-${lat}-${lng}-${Date.now()}` });
  };

  const resetAll = () => {
    setDepartment('');
    setProvince('');
    setMunicipality('');
    setMiningType('');
    setAdminStatus('');
    setVerification('');
    setDateFrom('');
    setDateTo('');
    setPin(null);
    setSelected(null);
    setTourStep(null);
    setLayers(DEFAULT_LAYERS);
    setFocus({ lat: BOLIVIA_CENTER[0], lng: BOLIVIA_CENTER[1], zoom: BOLIVIA_ZOOM, key: `reset-${Date.now()}` });
  };

  const layerCount = (k: MapLayerKey): number | string => {
    if (k === 'records') return filteredRecords.length;
    if (k === 'reports') return filteredReports.length;
    if (k === 'satellites') return filteredSats.length;
    if (k === 'alerts') return filteredAlerts.length;
    if (k === 'polygons') return filteredRecords.filter((r) => r.geometry).length;
    if (k === 'pilotoTop15') return 15;
    return '';
  };

  const nearPin = pin ? filteredRecords.filter((r) => Math.hypot(r.lat - pin.lat, r.lng - pin.lng) < 0.1).length : 0;

  return (
    <div className="-mx-3 sm:-mx-5 -my-5">
      <div className="grid lg:grid-cols-[320px_1fr] h-[calc(100vh-3.5rem)] min-h-[600px]">
        {/* Panel de control */}
        <aside className={cx('bg-white border-r border-ink-200 overflow-y-auto', panelOpen ? 'block absolute inset-x-0 top-14 bottom-0 z-[1100] lg:static' : 'hidden lg:block')}>
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between lg:hidden">
              <span className="font-bold text-navy-900 text-sm">Filtros y capas</span>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Cerrar panel">
                <X className="w-5 h-5" />
              </button>
            </div>
            <section className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filtros
              </h2>
              <Select aria-label="Departamento" value={department} onChange={(e) => {
                setDepartment(e.target.value);
                setProvince('');
                setMunicipality('');
                const d = DEPARTMENTS.find((x) => x.name === e.target.value);
                setFocus(d ? { lat: d.center[0], lng: d.center[1], zoom: d.zoom, key: d.name } : { lat: BOLIVIA_CENTER[0], lng: BOLIVIA_CENTER[1], zoom: BOLIVIA_ZOOM, key: 'bo' });
              }}>
                <option value="">Departamento: todos</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.code}>{d.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Select aria-label="Provincia" value={province} disabled={!dept} onChange={(e) => {
                  setProvince(e.target.value);
                  setMunicipality('');
                }}>
                  <option value="">Provincia</option>
                  {provinces.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Select aria-label="Municipio" value={municipality} disabled={!dept} onChange={(e) => {
                  setMunicipality(e.target.value);
                  const m = dept?.municipalities.find((x) => x.name === e.target.value);
                  if (m) setFocus({ lat: m.lat, lng: m.lng, zoom: 10, key: m.name });
                }}>
                  <option value="">Municipio</option>
                  {municipalities.map((m) => (
                    <option key={m.name}>{m.name}</option>
                  ))}
                </Select>
              </div>
              <Select aria-label="Tipo de minería" value={miningType} onChange={(e) => setMiningType(e.target.value as MiningType)}>
                <option value="">Tipo de minería: todos</option>
                {MINING_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {MINING_TYPE[t].label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Situación administrativa" value={adminStatus} onChange={(e) => setAdminStatus(e.target.value as AdminStatus)}>
                <option value="">Situación administrativa: todas</option>
                {ADMIN_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {ADMIN_STATUS[s].label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Estado de verificación" value={verification} onChange={(e) => setVerification(e.target.value as VerificationState)}>
                <option value="">Verificación: todas</option>
                {Object.entries(VERIFICATION_STATE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-ink-600">
                  Registro desde
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="text-[11px] text-ink-600">
                  hasta
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-ink-600">
                  <strong className="text-navy-900">{filteredRecords.length}</strong> de {miningRecords.length} registros
                </span>
                <button type="button" onClick={resetAll} className="text-teal-800 font-semibold hover:underline">
                  Restablecer
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Capas
              </h2>
              {LAYER_GROUPS.map((group) => (
                <div
                  key={group.id}
                  className={cx(
                    'space-y-1',
                    group.id !== 'base' && 'pt-2.5 border-t border-ink-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 pb-0.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-wide text-teal-800">{group.title}</h3>
                    {group.id === 'piloto' && (
                      <button
                        type="button"
                        onClick={goToPiloto}
                        className="text-[10px] font-semibold text-teal-800 hover:underline flex items-center gap-0.5"
                      >
                        <MapPin className="w-3 h-3" /> Acercar
                      </button>
                    )}
                  </div>
                  {group.keys.map((k) => (
                    <label key={k} className="flex items-center gap-2 text-xs text-ink-800 cursor-pointer py-0.5">
                      <input type="checkbox" className="accent-teal-700 w-4 h-4" checked={layers[k]} onChange={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} />
                      <span className="flex-1">{LAYER_LABELS[k]}</span>
                      <span className="tabular-nums text-ink-500">{layerCount(k)}</span>
                    </label>
                  ))}
                  {group.id === 'piloto' && (
                    <div className="pt-2 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionOpen(true);
                          setPanelOpen(false);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-navy-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Matriz y Simulador ORO-4.2
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSwipeOpen(true);
                          setPanelOpen(false);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-teal-700/30 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Comparar 2022 ⟷ 2026
                      </button>
                      <a
                        href="/brand/piloto/top15_sitios.csv"
                        download="top15_sitios_oro42.csv"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ink-200 bg-ivory-50 px-2.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-teal-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-800" />
                        Descargar Top 15 GPS (.csv)
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section className="space-y-1.5 pt-2 border-t border-ink-200">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Simbología</h2>
              <MapLegend />
              <p className="text-[10px] text-ink-500 leading-relaxed pt-1">
                Límites, áreas protegidas y ríos son referenciales aproximados, no cartografía oficial. Las denuncias son información no verificada.
              </p>
            </section>
          </div>
        </aside>

        {/* Mapa */}
        <div className="relative min-h-0">
          {viewMode === '2d' ? (
            <GeoMap
              className="h-full"
              records={filteredRecords}
              reports={filteredReports}
              satellites={filteredSats}
              alerts={filteredAlerts}
              sourceDocuments={sourceDocuments}
              layers={layers}
              selected={selected}
              onSelect={setSelected}
              focus={focus}
              pin={pin}
              highlightDepartment={department}
            />
          ) : (
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center bg-ivory-50 text-sm font-semibold text-navy-900">
                  Cargando relieve 3D de Bolivia...
                </div>
              }
            >
              <GeoMap3D
                className="h-full"
                records={filteredRecords}
                reports={filteredReports}
                satellites={filteredSats}
                alerts={filteredAlerts}
                sourceDocuments={sourceDocuments}
                layers={layers}
                selected={selected}
                onSelect={setSelected}
                focus={focus}
                pin={pin}
                highlightDepartment={department}
              />
            </Suspense>
          )}
          {/* Buscador flotante */}
          <div className="absolute top-3 left-14 right-3 sm:right-auto sm:w-[420px] z-[900]">
            <form onSubmit={submitSearch} className="relative">
              <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                aria-label="Buscar en el mapa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, ID, código, lugar o «lat, lng»"
                className="pl-9 pr-9 shadow-pop"
              />
              {search && (
                <button type="button" aria-label="Limpiar" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
            {searchResults.length > 0 && (
              <ul className="mt-1 bg-white rounded-md border border-ink-200 shadow-pop overflow-hidden">
                {searchResults.map((r, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => pickResult(r)} className="w-full text-left px-3 py-2 hover:bg-teal-50 border-b border-ink-100 last:border-0">
                      <div className="text-sm font-semibold text-navy-900">{r.title}</div>
                      <div className="text-[11px] text-ink-500">{r.sub}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {parseCoordinateQuery(search) && <p className="mt-1 text-[11px] bg-white/95 rounded px-2 py-1 shadow text-ink-700">Pulse Enter para ubicar las coordenadas.</p>}
            {pin && (
              <div className="mt-1 text-[11px] bg-white/95 rounded px-2 py-1 shadow text-ink-700 flex items-center gap-2">
                <Crosshair className="w-3.5 h-3.5 text-coral-600" /> {formatCoord(pin.lat, pin.lng)} · {nearPin} registro(s) a ~10 km
                <button type="button" className="ml-auto text-teal-800" onClick={() => setPin(null)}>
                  Quitar
                </button>
              </div>
            )}
          </div>

          <div className="absolute bottom-6 left-3 z-[900] flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="shadow-pop lg:hidden" icon={<Filter className="w-3.5 h-3.5" />} onClick={() => setPanelOpen(true)}>
              Filtros y capas
            </Button>
            <Button size="sm" variant="primary" className="shadow-pop" icon={<Compass className="w-3.5 h-3.5" />} onClick={() => setFocus({ lat: BOLIVIA_CENTER[0], lng: BOLIVIA_CENTER[1], zoom: BOLIVIA_ZOOM, key: `bo-${Date.now()}` })}>
              Vista de Bolivia
            </Button>
            <Button size="sm" variant="secondary" className="shadow-pop" icon={<MapPin className="w-3.5 h-3.5" />} onClick={goToPiloto}>
              Zona Piloto: Tipuani–Mapiri
            </Button>
            <Button
              size="sm"
              variant={viewMode === '3d' ? 'primary' : 'secondary'}
              className="shadow-pop"
              icon={<Box className="w-3.5 h-3.5" />}
              onClick={() => setViewMode((m) => (m === '2d' ? '3d' : '2d'))}
            >
              {viewMode === '2d' ? 'Vista 3D' : 'Volver a 2D'}
            </Button>
            <Button
              size="sm"
              variant={tourStep !== null ? 'primary' : 'secondary'}
              className="shadow-pop"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={() => (tourStep !== null ? setTourStep(null) : applyTourStep(0))}
            >
              {tourStep !== null ? 'Cerrar tour' : 'Tour ORO-4.2 (4 pasos)'}
            </Button>
            <Button
              size="sm"
              variant={swipeOpen ? 'primary' : 'secondary'}
              className="shadow-pop"
              icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
              onClick={() => setSwipeOpen(true)}
            >
              Comparar 2022 ⟷ 2026
            </Button>
            <Button
              size="sm"
              variant={decisionOpen ? 'primary' : 'secondary'}
              className="shadow-pop"
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              onClick={() => setDecisionOpen(true)}
            >
              Matriz y Simulador
            </Button>
          </div>

          {tourStep !== null && (
            <GuidedTourORO42
              stepIndex={tourStep}
              onStepChange={applyTourStep}
              onClose={() => setTourStep(null)}
            />
          )}

          {selected && <FeatureCard sel={selected} onClose={() => setSelected(null)} />}
        </div>
      </div>

      {swipeOpen && <PilotoSwipeModal onClose={() => setSwipeOpen(false)} />}
      {decisionOpen && (
        <Oro42DecisionModal
          onClose={() => setDecisionOpen(false)}
          onFlyToSite={flyToTop15Site}
        />
      )}
    </div>
  );
};

/** Ficha detallada del elemento seleccionado. */
const FeatureCard: React.FC<{ sel: MapSelection; onClose: () => void }> = ({ sel, onClose }) => {
  const { miningRecords, reports, satellites, alerts, sourceDocuments } = useData();
  let body: React.ReactNode = null;
  let title = '';
  let kindLabel = '';
  let link: { href: string; label: string } | null = null;

  if (sel.kind === 'record') {
    const r = miningRecords.find((x) => x.id === sel.id);
    if (!r) return null;
    kindLabel = 'Registro minero';
    title = r.name;
    link = { href: `#/registros/${r.id}`, label: 'Abrir ficha completa' };
    body = (
      <>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <StatusBadge status={r.adminStatus} />
          <VerificationBadge state={r.classification.verificationState} />
          <DemoBadge show={r.origin === 'demo'} />
        </div>
        <DL
          cols={1}
          items={[
            ['Identificador', <span key="i" className="font-mono text-xs">{r.id}</span>],
            ['Coordenadas', <span key="c" className="font-mono text-xs">{formatCoord(r.lat, r.lng)}</span>],
            ['Ubicación', `${r.locality ? `${r.locality}, ` : ''}${r.municipality} · ${r.province} · ${r.department}`],
            ['Tipo de actividad', MINING_TYPE[r.miningType].label],
            ['Titular u operador', r.holder],
            ['Código de derecho minero', r.miningRightCode],
            ['Respaldo de la clasificación', r.classification.sourceDocument ? `${r.classification.sourceDocument} (${r.classification.sourceInstitution}) · consultado ${formatDate(r.classification.consultedAt)}` : 'Sin respaldo documental'],
            ['Fecha de registro / actualización', `${formatDate(r.registeredAt)} / ${formatDate(r.updatedAt)}`],
            ['Fuente', r.source],
            ['Evidencias', `${r.evidences.length} documento(s)`],
            ['Observaciones', r.observations]
          ]}
        />
      </>
    );
  } else if (sel.kind === 'report') {
    const r = reports.find((x) => x.id === sel.id);
    if (!r) return null;
    kindLabel = 'Denuncia ciudadana · no verificada';
    title = REPORT_CATEGORY[r.category].label;
    link = { href: `#/denuncias/${r.id}`, label: 'Abrir denuncia' };
    body = (
      <DL
        cols={1}
        items={[
          ['Código', <span key="c" className="font-mono text-xs">{r.trackingCode}</span>],
          ['Estado', <Badge key="s" className={REPORT_STATUS[r.status].badge}>{REPORT_STATUS[r.status].label}</Badge>],
          ['Ubicación aproximada', `${r.community}, ${r.municipality} · ${r.department}`],
          ['Fecha de observación', formatDate(r.observedDate)],
          ['Descripción', r.description],
          ['Registro minero vinculado', r.relatedMiningRecordId]
        ]}
      />
    );
  } else if (sel.kind === 'satellite') {
    const o = satellites.find((x) => x.id === sel.id);
    if (!o) return null;
    kindLabel = 'Observación satelital';
    title = o.zoneName;
    link = { href: `#/satelital/${o.id}`, label: 'Abrir observación y comparador' };
    body = (
      <>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge className={OBSERVATION_ORIGIN[o.origin].badge}>{OBSERVATION_ORIGIN[o.origin].label}</Badge>
          <Badge className={REVIEW_STATE[o.reviewState].badge}>{REVIEW_STATE[o.reviewState].label}</Badge>
          <Badge className={CONFIDENCE[o.confidence].badge}>{CONFIDENCE[o.confidence].label}</Badge>
        </div>
        <DL
          cols={1}
          items={[
            ['ID', <span key="i" className="font-mono text-xs">{o.id}</span>],
            ['Tipo de cambio', OBSERVATION_TYPE[o.observationType]],
            ['Sensor / fecha', `${SENSOR[o.sensor]} · ${formatDate(o.acquisitionDate)}`],
            ['Superficie estimada', `${o.approxAreaHa} ha`],
            ['Descripción', o.changeDescription],
            ['Verificación documental', o.documentalVerification ? `${o.documentalVerification.document} (${o.documentalVerification.institution})` : 'Pendiente']
          ]}
        />
      </>
    );
  } else if (sel.kind === 'alert') {
    const a = alerts.find((x) => x.id === sel.id);
    if (!a) return null;
    kindLabel = 'Alerta territorial';
    title = a.title;
    link = { href: `#/alertas?id=${a.id}`, label: 'Gestionar alerta' };
    body = (
      <>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge className={ALERT_PRIORITY[a.priority].badge}>{ALERT_PRIORITY[a.priority].label}</Badge>
          <Badge className={ALERT_STATUS[a.status].badge}>{ALERT_STATUS[a.status].label}</Badge>
        </div>
        <DL cols={1} items={[['Tipo', ALERT_TYPE[a.type]], ['Ubicación', `${a.municipality} · ${a.department}`], ['Creada', formatDate(a.createdAt)], ['Descripción', a.description]]} />
      </>
    );
  } else {
    const d = sourceDocuments.find((x) => x.id === sel.id);
    if (!d) return null;
    kindLabel = 'Referencia institucional (demo)';
    title = d.title;
    link = { href: '#/institucional', label: 'Ver fuentes institucionales' };
    body = <DL cols={1} items={[['Institución', d.institution], ['Tipo', d.recordType], ['Código', d.codeReference], ['Resumen', d.summary]]} />;
  }

  return (
    <aside className="absolute z-[1000] bg-white shadow-pop border border-ink-200 rounded-lg overflow-hidden flex flex-col inset-x-2 bottom-2 max-h-[60%] sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[360px] sm:max-h-none" aria-label="Ficha del elemento">
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-ink-200 bg-ivory-50">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-teal-800">{kindLabel}</div>
          <h3 className="text-sm font-bold text-navy-900 leading-snug">{title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar ficha" className="p-1 rounded hover:bg-ink-100 text-ink-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 overflow-y-auto flex-1 text-sm">{body}</div>
      {link && (
        <div className="p-3 border-t border-ink-200">
          <Button variant="primary" className="w-full" icon={<ExternalLink className="w-4 h-4" />} onClick={() => navigate(link!.href.slice(1))}>
            {link.label}
          </Button>
        </div>
      )}
    </aside>
  );
};
