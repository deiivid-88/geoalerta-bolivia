import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, MoveHorizontal, X } from 'lucide-react';

interface SwipePreset {
  id: string;
  tabLabel: string;
  leftLabel: string;
  rightLabel: string;
  leftBase: string;
  rightBase: string;
  rightOverlays?: string[];
  caption: string;
}

const SWIPE_PRESETS: SwipePreset[] = [
  {
    id: 'cambio-22-26',
    tabLabel: 'Óptico 2022 vs. 2026',
    leftLabel: 'Sentinel-2 · 2022',
    rightLabel: 'Sentinel-2 · 2026',
    leftBase: '/brand/piloto/s2_2022.png',
    rightBase: '/brand/piloto/s2_2026.png',
    caption: 'Desliza la cortina para comparar el ensanchamiento del cauce y la pérdida de cobertura vegetal ribereña en 4 años.'
  },
  {
    id: 'turbidez-ndti',
    tabLabel: '2026 vs. Turbidez NDTI',
    leftLabel: 'Sentinel-2 · 2026',
    rightLabel: 'Turbidez fluvial NDTI (2026)',
    leftBase: '/brand/piloto/s2_2026.png',
    rightBase: '/brand/piloto/s2_2026.png',
    rightOverlays: ['/brand/piloto/ndti_2026.png'],
    caption: 'La escala azul a rojo identifica la carga de sedimentos en suspensión sobre los ríos Tipuani, Mapiri y Kaka.'
  },
  {
    id: 'riesgo-hg',
    tabLabel: '2026 vs. Riesgo Hg + Pasivos',
    leftLabel: 'Sentinel-2 · 2026',
    rightLabel: 'Riesgo Hg (0–100) + Pasivos',
    leftBase: '/brand/piloto/s2_2026.png',
    rightBase: '/brand/piloto/s2_2026.png',
    rightOverlays: ['/brand/piloto/riesgo_hg_2026.png', '/brand/piloto/pasivos_2026.png'],
    caption: 'Combina el mapa de calor de riesgo ambiental de mercurio (amarillo–rojo oscuro) con colas y pasivos en reposo (morado).'
  },
  {
    id: 'optico-sar',
    tabLabel: 'Óptico vs. Radar SAR',
    leftLabel: 'Sentinel-2 Óptico (2026)',
    rightLabel: 'Radar Sentinel-1 VV (sin nubes)',
    leftBase: '/brand/piloto/s2_2026.png',
    rightBase: '/brand/piloto/s1_vv_2026.png',
    caption: 'Contraste entre imagen óptica y retrodispersión de radar SAR capaz de monitorear el cauce incluso bajo cobertura nubosa.'
  }
];

interface PilotoStats {
  persistente: number;
  nuevo: number;
  pasivo: number;
  volColas: number;
}

interface PilotoSwipeModalProps {
  onClose: () => void;
}

export const PilotoSwipeModal: React.FC<PilotoSwipeModalProps> = ({ onClose }) => {
  const [presetId, setPresetId] = useState<string>(SWIPE_PRESETS[0].id);
  const [position, setPosition] = useState<number>(50);
  const [dragging, setDragging] = useState<boolean>(false);
  const [stats, setStats] = useState<PilotoStats | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const preset = SWIPE_PRESETS.find((p) => p.id === presetId) ?? SWIPE_PRESETS[0];

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
        const acc = data.features.reduce(
          (sum: PilotoStats, f: any) => {
            const p = f?.properties || {};
            return {
              persistente: sum.persistente + Number(p.ha_persistente ?? 0),
              nuevo: sum.nuevo + Number(p.ha_nuevo ?? 0),
              pasivo: sum.pasivo + Number(p.ha_pasivo ?? 0),
              volColas: sum.volColas + Number(p.vol_colas_m3 ?? 0)
            };
          },
          { persistente: 0, nuevo: 0, pasivo: 0, volColas: 0 }
        );
        setStats(acc);
      })
      .catch(() => {});
  }, []);

  const updateFromClientX = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-navy-900/75 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Comparador satelital multitemporal Zona Piloto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] rounded-xl border border-ink-200 bg-white shadow-pop overflow-hidden flex flex-col">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 bg-navy-900 px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-teal-200 flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Comparador Satelital · Zona Piloto Tipuani–Mapiri–Kaka
            </div>
            <h2 className="text-sm sm:text-base font-bold leading-snug">
              Evidencia multitemporal y multimodal (2022 ⟷ 2026)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar comparador"
            className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de modos */}
        <div className="flex flex-wrap gap-1.5 border-b border-ink-200 bg-ivory-50 px-4 py-2.5">
          {SWIPE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPresetId(item.id);
                setPosition(50);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                item.id === preset.id
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'border border-ink-200 bg-white text-ink-700 hover:bg-teal-50'
              }`}
            >
              {item.tabLabel}
            </button>
          ))}
        </div>

        {/* Área interactiva de cortina */}
        <div className="flex-1 overflow-y-auto bg-ink-900/95 p-3 sm:p-4 flex flex-col items-center justify-center">
          <div
            ref={stageRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative inline-block max-w-full cursor-ew-resize select-none touch-none overflow-hidden rounded-lg border border-white/15 shadow-lg bg-black"
          >
            {/* Lado derecho (base + posibles overlays transparentes) */}
            <img
              src={preset.rightBase}
              alt={preset.rightLabel}
              draggable={false}
              className="block max-h-[54vh] w-auto max-w-full pointer-events-none select-none"
            />
            {preset.rightOverlays?.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none select-none opacity-90"
              />
            ))}

            {/* Lado izquierdo recortado con clip-path (alineación exacta al píxel) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - position}\% 0 0)` }} > <img src={preset.leftBase} alt={preset.leftLabel} draggable={false} className="w-full h-full pointer-events-none select-none" /> </div>  {/* Etiquetas flotantes izquierda / derecha */} <span className="pointer-events-none absolute top-2.5 left-2.5 rounded bg-navy-900/85 px-2 py-1 text-[11px] font-semibold text-white border border-white/15"> {preset.leftLabel} </span> <span className="pointer-events-none absolute top-2.5 right-2.5 rounded bg-teal-800/90 px-2 py-1 text-[11px] font-semibold text-white border border-white/15"> {preset.rightLabel} </span>  {/* Línea divisoria y tirador */} <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.85)]" style={{ left: `${position}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-navy-900 text-white shadow-lg">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Control deslizante accesible para teclado o ajuste fino */}
          <div className="mt-3 w-full max-w-md flex items-center gap-3 text-[11px] text-white/85">
            <span className="shrink-0 font-semibold">{preset.leftLabel}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(position)}
              onChange={(e) => setPosition(Number(e.target.value))}
              aria-label="Posición de la cortina comparadora"
              className="w-full accent-teal-400 cursor-pointer"
            />
            <span className="shrink-0 font-semibold">{preset.rightLabel}</span>
          </div>
        </div>

        {/* Pie explicativo + métricas reales del Top 15 */}
        <div className="border-t border-ink-200 bg-white px-4 py-3 space-y-2.5">
          <p className="text-xs text-ink-700 leading-relaxed">{preset.caption}</p>

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border border-ink-200 bg-ivory-50 px-2.5 py-1.5">
                <div className="text-[10px] font-semibold uppercase text-ink-500">Persistente (Top 15)</div>
                <div className="text-sm font-bold text-navy-900 tabular-nums">{stats.persistente.toFixed(1)} ha</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-ivory-50 px-2.5 py-1.5">
                <div className="text-[10px] font-semibold uppercase text-ink-500">Expansión nueva</div>
                <div className="text-sm font-bold text-coral-600 tabular-nums">+{stats.nuevo.toFixed(1)} ha</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-ivory-50 px-2.5 py-1.5">
                <div className="text-[10px] font-semibold uppercase text-ink-500">Pasivos en reposo</div>
                <div className="text-sm font-bold text-navy-900 tabular-nums">{stats.pasivo.toFixed(1)} ha</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-ivory-50 px-2.5 py-1.5">
                <div className="text-[10px] font-semibold uppercase text-ink-500">Vol. colas estimado</div>
                <div className="text-sm font-bold text-teal-800 tabular-nums">
                  {Math.round(stats.volColas).toLocaleString('es-BO')} m&sup3;
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
