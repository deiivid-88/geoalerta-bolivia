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
                  <div className="flex items-center justify-between gap-
