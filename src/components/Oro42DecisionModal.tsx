import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calculator, Download, ExternalLink, MapPin, Navigation, ShieldAlert, X } from 'lucide-react';

interface Top15Site {
  rank: number;
  lat: number;
  lon: number;
  categoria: string;
  prioridad_total: number;
  riesgo_indice: number;
  valor_indice: number;
  ha_total_2026: number;
  ha_persistente: number;
  ha_nuevo: number;
  ha_pasivo: number;
  vol_colas_m3: number;
  ndti_turbidez: number;
  pixeles_sar: number;
}

interface CategoryMeta {
  label: string;
  short: string;
  color: string;
  badgeClass: string;
  protocol: string[];
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  CRITICO_REPROCESABLE: {
    label: 'Crítico / Reprocesable',
    short: 'Crítico + Valor',
    color: '#dc2626',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    protocol: [
      'Muestreo urgente de agua, sedimentos y suelos para cuantificación de Hg total.',
      'Ensayo metalúrgico en colas acumuladas para validar reprocesamiento gravimétrico libre de mercurio.',
      'Contención física de relaves ribereños antes de época de lluvias.'
    ]
  },
  ALTO_RIESGO_CONTENCION: {
    label: 'Alto riesgo (Contención)',
    short: 'Alto riesgo',
    color: '#ea580c',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    protocol: [
      'Inspección prioritaria de vertimientos y pluma de turbidez aguas abajo.',
      'Monitoreo de bioacumulación de Hg en comunidades y peces del corredor fluvial.',
      'Fiscalización de frentes activos detectados por radar SAR.'
    ]
  },
  OPORTUNIDAD_REPROCESO: {
    label: 'Oportunidad de reproceso',
    short: 'Reproceso',
    color: '#0891b2',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    protocol: [
      'Inventario de pasivos/colas en reposo y cubaje en campo.',
      'Piloto de recuperación gravimétrica limpia (mesas vibratorias / concentradores centrífugos).',
      'Acuerdo con cooperativa local para remediación progresiva del sitio.'
    ]
  },
  MONITOREO: {
    label: 'Monitoreo preventivo',
    short: 'Monitoreo',
    color: '#64748b',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    protocol: [
      'Seguimiento satelital mensual con Sentinel-1 SAR (bajo nubes) y Sentinel-2.',
      'Verificación de límites de derechos mineros y alerta temprana de expansión.'
    ]
  }
};

function getCategoryMeta(cat: string): CategoryMeta {
  return CATEGORY_META[cat] ?? CATEGORY_META.MONITOREO;
}

function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function downloadGpx(sites: Top15Site[], filename: string) {
  const waypoints = sites
    .map((s) => {
      const meta = getCategoryMeta(s.categoria);
      const name = `ORO42-#${s.rank} (${meta.short})`;
      const desc = `Prioridad: ${s.prioridad_total}/100 | Riesgo: ${s.riesgo_indice} | Valor: ${s.valor_indice} | Colas: ${s.vol_colas_m3} m3 | Persistente: ${s.ha_persistente} ha | Pasivo: ${s.ha_pasivo} ha`;
      return `  <wpt lat="${s.lat.toFixed(6)}" lon="${s.lon.toFixed(6)}">\n    <name>${escapeXml(name)}</name>\n    <desc>${escapeXml(desc)}</desc>\n    <sym>Flag, Red</sym>\n  </wpt>`;
    })
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GeoAlerta Bolivia - ORO-4.2" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata>\n    <name>GeoAlerta Bolivia - Sitios Prioritarios ORO-4.2</name>\n    <desc>Puntos GPS priorizados por Riesgo Ambiental (Hg) y Valor Recuperable en Tipuani-Mapiri-Kaka</desc>\n  </metadata>\n${waypoints}\n</gpx>\n`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Oro42DecisionModalProps {
  onClose: () => void;
  onFlyToSite: (lat: number, lng: number) => void;
}

export const Oro42DecisionModal: React.FC<Oro42DecisionModalProps> = ({ onClose, onFlyToSite }) => {
  const [sites, setSites] = useState<Top15Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const [simScope, setSimScope] = useState<'all' | 'critical' | 'selected'>('all');

  // Parámetros del simulador limpio (valores conservadores por defecto)
  const [gradeGPerM3, setGradeGPerM3] = useState<number>(0.18); // g Au / m3 en colas
  const [recoveryPct, setRecoveryPct] = useState<number>(65);   // % recuperación gravimétrica sin Hg
  const [goldUsdPerG, setGoldUsdPerG] = useState<number>(85);   // USD por gramo de Au
  const [hgRatio, setHgRatio] = useState<number>(2.0);          // g Hg evitados por g Au

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    fetch('/brand/piloto/top15_cuadrantes.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!Array.isArray(data?.features)) return;
        const parsed: Top15Site[] = data.features
          .map((f: any) => {
            const p = f?.properties || {};
            return {
              rank: 0,
              lat: Number(p.lat ?? 0),
              lon: Number(p.lon ?? 0),
              categoria: String(p.categoria ?? 'MONITOREO'),
              prioridad_total: Number(p.prioridad_total ?? 0),
              riesgo_indice: Number(p.riesgo_indice ?? 0),
              valor_indice: Number(p.valor_indice ?? 0),
              ha_total_2026: Number(p.ha_total_2026 ?? 0),
              ha_persistente: Number(p.ha_persistente ?? 0),
              ha_nuevo: Number(p.ha_nuevo ?? 0),
              ha_pasivo: Number(p.ha_pasivo ?? 0),
              vol_colas_m3: Number(p.vol_colas_m3 ?? 0),
              ndti_turbidez: Number(p.ndti_turbidez ?? 0),
              pixeles_sar: Number(p.pixeles_sar ?? 0)
            };
          })
          .sort((a: Top15Site, b: Top15Site) => b.prioridad_total - a.prioridad_total)
          .map((s: Top15Site, idx: number) => ({ ...s, rank: idx + 1 }));
        setSites(parsed);
        if (parsed.length > 0) setSelectedRank(parsed[0].rank);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedSite = useMemo(
    () => sites.find((s) => s.rank === selectedRank) ?? sites[0] ?? null,
    [sites, selectedRank]
  );

  const scopedSites = useMemo(() => {
    if (simScope === 'selected' && selectedSite) return [selectedSite];
    if (simScope === 'critical') {
      const crit = sites.filter((s) => s.categoria === 'CRITICO_REPROCESABLE');
      return crit.length > 0 ? crit : sites;
    }
    return sites;
  }, [simScope, sites, selectedSite]);

  const simulation = useMemo(() => {
    const totalVolM3 = scopedSites.reduce((acc, s) => acc + s.vol_colas_m3, 0);
    const goldGrams = totalVolM3 * gradeGPerM3 * (recoveryPct / 100);
    const goldKg = goldGrams / 1000;
    const grossUsd = goldGrams * goldUsdPerG;
    const hgAvoidedKg = (goldGrams * hgRatio) / 1000;
    return { totalVolM3, goldGrams, goldKg, grossUsd, hgAvoidedKg, count: scopedSites.length };
  }, [scopedSites, gradeGPerM3, recoveryPct, goldUsdPerG, hgRatio]);

  // Dimensiones del gráfico SVG de 4 cuadrantes
  const W = 380;
  const H = 260;
  const PAD_L = 38;
  const PAD_R = 16;
  const PAD_T = 18;
  const PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const toX = (val: number) => PAD_L + (Math.min(100, Math.max(0, val)) / 100) * plotW;
  const toY = (risk: number) => PAD_T + (1 - Math.min(100, Math.max(0, risk)) / 100) * plotH;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-navy-900/75 backdrop-blur-xs p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Matriz Riesgo vs Valor y Simulador ORO-4.2"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[94vh] rounded-xl border border-ink-200 bg-white shadow-pop overflow-hidden flex flex-col">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 bg-navy-900 px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-teal-200 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Motor de Decisión ORO-4.2 · Tipuani–Mapiri–Kaka
            </div>
            <h2 className="text-sm sm:text-base font-bold leading-snug">
              Matriz Riesgo Ambiental vs. Valor Recuperable + Simulador de Reprocesamiento Limpio
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de decisión"
            className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-ivory-50/40">
          {loading ? (
            <div className="py-16 text-center text-sm text-ink-600">Cargando métricas de los Top 15 cuadrantes...</div>
          ) : sites.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-600">
              No se encontraron datos en <code className="font-mono">/brand/piloto/top15_cuadrantes.geojson</code>.
            </div>
          ) : (
            <>
              {/* Fila 1: Matriz 4 cuadrantes + Ficha accionable del sitio */}
              <div className="grid lg:grid-cols-[1.15fr_1fr] gap-4">
                {/* Matriz SVG */}
                <div className="rounded-lg border border-ink-200 bg-white p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-navy-900">
                        Matriz estratégica de priorización (Top {sites.length})
                      </h3>
                      <p className="text-[11px] text-ink-500">
                        Haz clic en cualquier punto para inspeccionar protocolo de campo y volar al sitio.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadGpx(sites, 'top15_oro42_brigada.gpx')}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-teal-700/30 bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-100"
                      title="Descargar los 15 waypoints para GPS Garmin, OsmAnd o Gaia GPS"
                    >
                      <Download className="w-3.5 h-3.5" /> Top 15 (.gpx)
                    </button>
                  </div>

                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full h-auto rounded-md border border-ink-200 bg-white"
                    role="img"
                    aria-label="Gráfico de dispersión Riesgo Ambiental versus Valor Recuperable"
                  >
                    {/* Fondos suaves por cuadrante */}
                    <rect x={PAD_L} y={PAD_T} width={plotW / 2} height={plotH / 2} fill="#fff7ed" />
                    <rect x={PAD_L + plotW / 2} y={PAD_T} width={plotW / 2} height={plotH / 2} fill="#fef2f2" />
                    <rect x={PAD_L} y={PAD_T + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#f8fafc" />
                    <rect x={PAD_L + plotW / 2} y={PAD_T + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#ecfeff" />

                    {/* Líneas divisorias en 50/50 */}
                    <line
                      x1={toX(50)}
                      y1={PAD_T}
                      x2={toX(50)}
                      y2={PAD_T + plotH}
                      stroke="#94a3b8"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                    <line
                      x1={PAD_L}
                      y1={toY(50)}
                      x2={PAD_L + plotW}
                      y2={toY(50)}
                      stroke="#94a3b8"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />

                    {/* Etiquetas de cuadrantes */}
                    <text x={PAD_L + 6} y={PAD_T + 13} fontSize="9" fontWeight="700" fill="#c2410c">
                      ALTO RIESGO (CONTENCIÓN)
                    </text>
                    <text x={PAD_L + plotW - 6} y={PAD_T + 13} fontSize="9" fontWeight="700" fill="#b91c1c" textAnchor="end">
                      CRÍTICO REPROCESABLE
                    </text>
                    <text x={PAD_L + 6} y={PAD_T + plotH - 6} fontSize="9" fontWeight="700" fill="#64748b">
                      MONITOREO
                    </text>
                    <text x={PAD_L + plotW - 6} y={PAD_T + plotH - 6} fontSize="9" fontWeight="700" fill="#0e7490" textAnchor="end">
                      OPORTUNIDAD REPROCESO
                    </text>

                    {/* Ejes y marcas */}
                    <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" strokeWidth={1} />
                    {[0, 50, 100].map((tick) => (
                      <g key={tick}>
                        <text x={toX(tick)} y={H - 18} fontSize="9" fill="#64748b" textAnchor="middle">
                          {tick}
                        </text>
                        <text x={PAD_L - 6} y={toY(tick) + 3} fontSize="9" fill="#64748b" textAnchor="end">
                          {tick}
                        </text>
                      </g>
                    ))}
                    <text x={PAD_L + plotW / 2} y={H - 4} fontSize="10" fontWeight="700" fill="#17364d" textAnchor="middle">
                      Valor / Potencial de Reprocesamiento (0–100) →
                    </text>
                    <text
                      x={12}
                      y={PAD_T + plotH / 2}
                      fontSize="10"
                      fontWeight="700"
                      fill="#17364d"
                      textAnchor="middle"
                      transform={`rotate(-90 12 ${PAD_T + plotH / 2})`}
                    >
                      Riesgo Ambiental Hg (0–100) →
                    </text>

                    {/* Puntos de los Top 15 sitios */}
                    {sites.map((s) => {
                      const meta = getCategoryMeta(s.categoria);
                      const isSel = selectedSite?.rank === s.rank;
                      const cxPos = toX(s.valor_indice);
                      const cyPos = toY(s.riesgo_indice);
                      return (
                        <g
                          key={s.rank}
                          onClick={() => setSelectedRank(s.rank)}
                          className="cursor-pointer"
                        >
                          <title>{`#${s.rank} · ${meta.label} | Prioridad ${s.prioridad_total}/100 | Riesgo ${s.riesgo_indice} · Valor ${s.valor_indice}`}</title>
                          {isSel && (
                            <circle
                              cx={cxPos}
                              cy={cyPos}
                              r={12}
                              fill={meta.color}
                              fillOpacity={0.18}
                              stroke={meta.color}
                              strokeWidth={1.5}
                            />
                          )}
                          <circle
                            cx={cxPos}
                            cy={cyPos}
                            r={isSel ? 7.5 : 6}
                            fill={meta.color}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                          <text
                            x={cxPos}
                            y={cyPos + 2.8}
                            fontSize="7.5"
                            fontWeight="700"
                            fill="#ffffff"
                            textAnchor="middle"
                            className="pointer-events-none select-none"
                          >
                            {s.rank}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Selector rápido por ranking #1..#15 */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {sites.map((s) => {
                      const isSel = selectedSite?.rank === s.rank;
                      return (
                        <button
                          key={s.rank}
                          type="button"
                          onClick={() => setSelectedRank(s.rank)}
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors ${
                            isSel
                              ? 'bg-navy-900 text-white'
                              : 'border border-ink-200 bg-ivory-50 text-ink-700 hover:bg-teal-50'
                          }`}
                        >
                          #{s.rank}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ficha y protocolo de brigada del sitio seleccionado */}
                {selectedSite && (
                  <div className="rounded-lg border border-ink-200 bg-white p-3.5 flex flex-col justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-ink-500">
                            Cuadrante prioritario #{selectedSite.rank} de {sites.length}
                          </div>
                          <h3 className="text-base font-bold text-navy-900">
                            Prioridad {selectedSite.prioridad_total.toFixed(1)} / 100
                          </h3>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${getCategoryMeta(selectedSite.categoria).badgeClass}`}
                        >
                          {getCategoryMeta(selectedSite.categoria).label}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md border border-ink-200 bg-ivory-50 p-2">
                          <div className="text-[10px] text-ink-500 font-semibold">Riesgo Hg</div>
                          <div className="text-sm font-bold text-coral-600 tabular-nums">{selectedSite.riesgo_indice}/100</div>
                        </div>
                        <div className="rounded-md border border-ink-200 bg-ivory-50 p-2">
                          <div className="text-[10px] text-ink-500 font-semibold">Valor Recup.</div>
                          <div className="text-sm font-bold text-teal-800 tabular-nums">{selectedSite.valor_indice}/100</div>
                        </div>
                        <div className="rounded-md border border-ink-200 bg-ivory-50 p-2">
                          <div className="text-[10px] text-ink-500 font-semibold">Vol. Colas</div>
                          <div className="text-sm font-bold text-navy-900 tabular-nums">
                            {Math.round(selectedSite.vol_colas_m3).toLocaleString('es-BO')} m&sup3;
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-700 bg-ivory-50/70 rounded-md p-2.5 border border-ink-200/70">
                        <div><strong>Persistente:</strong> {selectedSite.ha_persistente} ha</div>
                        <div><strong>Expansión nueva:</strong> {selectedSite.ha_nuevo} ha</div>
                        <div><strong>Pasivo en reposo:</strong> {selectedSite.ha_pasivo} ha</div>
                        <div><strong>Turbidez NDTI:</strong> {selectedSite.ndti_turbidez}</div>
                        <div><strong>Anomalías SAR:</strong> {selectedSite.pixeles_sar} px</div>
                        <div className="font-mono text-[11px]">
                          {selectedSite.lat.toFixed(4)}, {selectedSite.lon.toFixed(4)}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-navy-900 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-teal-800" /> Protocolo recomendado para brigada
                        </div>
                        <ul className="space-y-1 text-xs text-ink-700 list-disc pl-4 leading-relaxed">
                          {getCategoryMeta(selectedSite.categoria).protocol.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Acciones directas de campo */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-ink-200">
                      <button
                        type="button"
                        onClick={() => onFlyToSite(selectedSite.lat, selectedSite.lon)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-navy-900 px-2.5 py-2 text-xs font-semibold text-white hover:bg-navy-800"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Ir al mapa
                      </button>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedSite.lat},${selectedSite.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-2 text-xs font-semibold text-navy-900 hover:bg-teal-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-teal-800" /> Google Maps
                      </a>
                      <button
                        type="button"
                        onClick={() => downloadGpx([selectedSite], `sitio_oro42_rank${selectedSite.rank}.gpx`)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-teal-700/30 bg-teal-50 px-2.5 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Punto .gpx
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fila 2: Simulador paramétrico de reprocesamiento limpio */}
              <div className="rounded-lg border border-ink-200 bg-white p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-navy-900 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-teal-800" /> Simulador de Reprocesamiento Limpio (Libre de Mercurio)
                    </h3>
                    <p className="text-[11px] text-ink-500">
                      Estima el valor económico recuperable de colas aluviales mediante concentración gravimétrica y el mercurio evitado.
                    </p>
                  </div>

                  {/* Alcance del cálculo */}
                  <div className="inline-flex rounded-md border border-ink-200 bg-ivory-50 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSimScope('all')}
                      className={`rounded px-2.5 py-1 transition-colors ${
                        simScope === 'all' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-white'
                      }`}
                    >
                      Todos (Top {sites.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimScope('critical')}
                      className={`rounded px-2.5 py-1 transition-colors ${
                        simScope === 'critical' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-white'
                      }`}
                    >
                      Solo Críticos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimScope('selected')}
                      className={`rounded px-2.5 py-1 transition-colors ${
                        simScope === 'selected' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-white'
                      }`}
                    >
                      Sitio #{selectedSite?.rank ?? 1}
                    </button>
                  </div>
                </div>

                {/* Deslizadores */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-ivory-50 rounded-md p-3 border border-ink-200/80">
                  <label className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-navy-900">
                      <span>Ley residual en colas</span>
                      <span className="tabular-nums text-teal-800">{gradeGPerM3.toFixed(2)} g Au/m&sup3;</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={0.6}
                      step={0.01}
                      value={gradeGPerM3}
                      onChange={(e) => setGradeGPerM3(Number(e.target.value))}
                      className="w-full accent-teal-700 cursor-pointer"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-navy-900">
                      <span>Recup. gravimétrica</span>
                      <span className="tabular-nums text-teal-800">{recoveryPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={45}
                      max={85}
                      step={1}
                      value={recoveryPct}
                      onChange={(e) => setRecoveryPct(Number(e.target.value))}
                      className="w-full accent-teal-700 cursor-pointer"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-navy-900">
                      <span>Precio referencial Au</span>
                      <span className="tabular-nums text-teal-800">${goldUsdPerG} USD/g</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={110}
                      step={1}
                      value={goldUsdPerG}
                      onChange={(e) => setGoldUsdPerG(Number(e.target.value))}
                      className="w-full accent-teal-700 cursor-pointer"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-navy-900">
                      <span>Ratio Hg evitado</span>
                      <span className="tabular-nums text-teal-800">{hgRatio.toFixed(1)} g Hg/g Au</span>
                    </div>
                    <input
                      type="range"
                      min={1.0}
                      max={3.5}
                      step={0.1}
                      value={hgRatio}
                      onChange={(e) => setHgRatio(Number(e.target.value))}
                      className="w-full accent-teal-700 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Resultados KPI */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="rounded-lg border border-ink-200 bg-white p-3">
                    <div className="text-[10px] font-bold uppercase text-ink-500">
                      Colas evaluadas ({simulation.count} sitio{simulation.count === 1 ? '' : 's'})
                    </div>
                    <div className="text-base sm:text-lg font-bold text-navy-900 tabular-nums mt-0.5">
                      {Math.round(simulation.totalVolM3).toLocaleString('es-BO')} m&sup3;
                    </div>
                  </div>

                  <div className="rounded-lg border border-ink-200 bg-white p-3">
                    <div className="text-[10px] font-bold uppercase text-ink-500">Oro recuperable limpio</div>
                    <div className="text-base sm:text-lg font-bold text-amber-700 tabular-nums mt-0.5">
                      {simulation.goldKg >= 1
                        ? `${simulation.goldKg.toFixed(2)} kg`
                        : `${Math.round(simulation.goldGrams).toLocaleString('es-BO')} g`}
                    </div>
                  </div>

                  <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3">
                    <div className="text-[10px] font-bold uppercase text-teal-800">Valor bruto potencial</div>
                    <div className="text-base sm:text-lg font-bold text-teal-900 tabular-nums mt-0.5">
                      ${Math.round(simulation.grossUsd).toLocaleString('es-BO')} USD
                    </div>
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                    <div className="text-[10px] font-bold uppercase text-red-800">Mercurio evitado</div>
                    <div className="text-base sm:text-lg font-bold text-red-900 tabular-nums mt-0.5">
                      {simulation.hgAvoidedKg.toFixed(1)} kg Hg
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-ink-500 leading-relaxed">
                  * Pre-estimación paramétrica basada en volumen satelital conservador de colas (20 % del área intervenida × 1.5 m de espesor) para orientar la priorización de muestreo; los valores económicos definitivos requieren ensayos de ley y batimetría en campo.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
