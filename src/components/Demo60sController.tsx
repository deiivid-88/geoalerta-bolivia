import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Timer, X } from 'lucide-react';
import { navigate } from '../app/router';

export type DemoMapScene = 'piloto-3d' | 'swipe' | 'decision' | 'clear';
export const DEMO_MAP_EVENT = 'geoalerta:demo-map-scene';

let activeDemoMapScene: DemoMapScene | null = null;

export function getDemoMapScene(): DemoMapScene | null {
  return activeDemoMapScene;
}

export function setDemoMapScene(scene: DemoMapScene | null): void {
  activeDemoMapScene = scene;
  window.dispatchEvent(new CustomEvent<DemoMapScene | null>(DEMO_MAP_EVENT, { detail: scene }));
}

interface DemoScene {
  id: number;
  label: string;
  path: string;
  durationSec: number;
  mapScene?: DemoMapScene;
  cue: string;
}

const DEMO_SCENES: DemoScene[] = [
  {
    id: 1,
    label: 'Inicio · Panorama Nacional',
    path: '/',
    durationSec: 8,
    cue: 'GeoAlerta centraliza monitoreo satelital, registros mineros, denuncias y alertas en una sola plataforma nacional.'
  },
  {
    id: 2,
    label: 'Mapa 3D · Tipuani–Mapiri',
    path: '/mapa',
    durationSec: 12,
    mapScene: 'piloto-3d',
    cue: 'Con Sentinel-2 y radar SAR bajo nubes priorizamos 89 zonas y bajamos en relieve 3D al corredor fluvial con turbidez NDTI.'
  },
  {
    id: 3,
    label: 'Comparador 2022 ⟷ 2026',
    path: '/mapa',
    durationSec: 10,
    mapScene: 'swipe',
    cue: 'La cortina multitemporal evidencia la expansión aluvial en 4 años, sedimentos en el cauce y operación sin nubes.'
  },
  {
    id: 4,
    label: 'Matriz y Simulador ORO-4.2',
    path: '/mapa',
    durationSec: 14,
    mapScene: 'decision',
    cue: 'Priorizamos los Top 15 sitios por riesgo de Hg y valor recuperable: oro limpio, mercurio evitado y rutas .gpx para campo.'
  },
  {
    id: 5,
    label: 'Denuncias ciudadanas',
    path: '/denuncias',
    durationSec: 8,
    cue: 'La detección satelital se cruza con denuncias ciudadanas con código de seguimiento para dar trazabilidad e inspección.'
  },
  {
    id: 6,
    label: 'Análisis territorial',
    path: '/analisis',
    durationSec: 8,
    cue: 'Todo se consolida en análisis departamental e informes listos para decisiones de municipios y autoridades.'
  }
];

const TOTAL_SECONDS = DEMO_SCENES.reduce((acc, s) => acc + s.durationSec, 0);

interface Demo60sControllerProps {
  onClose: () => void;
}

export const Demo60sController: React.FC<Demo60sControllerProps> = ({ onClose }) => {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  const scene = DEMO_SCENES[sceneIdx] ?? DEMO_SCENES[0];

  // Aplicar navegación y escena interna del mapa cada vez que cambia el paso
  useEffect(() => {
    setElapsedMs(0);
    setDemoMapScene(scene.mapScene ?? null);
    navigate(scene.path);
  }, [sceneIdx, scene.path, scene.mapScene]);

  // Limpiar estado de escena al cerrar el controlador
  useEffect(() => {
    return () => {
      activeDemoMapScene = null;
    };
  }, []);

  // Temporizador automático (60s exactos)
  useEffect(() => {
    if (paused || finished) return;
    const durationMs = scene.durationSec * 1000;
    const timer = window.setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 100;
        if (next >= durationMs) {
          if (sceneIdx < DEMO_SCENES.length - 1) {
            setSceneIdx((i) => i + 1);
          } else {
            setFinished(true);
          }
          return durationMs;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [paused, finished, sceneIdx, scene.durationSec]);

  // Control rápido con teclado durante el pitch (Espacio / Flechas / P)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (sceneIdx < DEMO_SCENES.length - 1) {
          setFinished(false);
          setSceneIdx((i) => i + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (sceneIdx > 0) {
          setFinished(false);
          setSceneIdx((i) => i - 1);
        }
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sceneIdx]);

  const completedBeforeSec = DEMO_SCENES.slice(0, sceneIdx).reduce((acc, s) => acc + s.durationSec, 0);
  const totalElapsedSec = Math.min(TOTAL_SECONDS, completedBeforeSec + elapsedMs / 1000);
  const remainingSec = Math.max(0, Math.ceil(TOTAL_SECONDS - totalElapsedSec));
  const globalPct = Math.min(100, (totalElapsedSec / TOTAL_SECONDS) * 100);

  const restart = () => {
    setFinished(false);
    setPaused(false);
    setElapsedMs(0);
    setSceneIdx(0);
  };

  return (
    <aside
      aria-label="Controlador de Demo en 60 segundos"
      className="fixed bottom-3 right-3 z-[1500] w-[calc(100%-1.5rem)] sm:w-[415px] rounded-xl border border-white/15 bg-navy-900/95 text-white shadow-2xl backdrop-blur-md overflow-hidden"
    >
      {/* Barra superior de progreso global */}
      <div className="h-1 w-full bg-white/15">
        <div
          className="h-full bg-gold-500 transition-[width] duration-100 ease-linear"
          style={{ width: `${globalPct}%` }}
        />
      </div>

      <div className="px-3.5 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Timer className="w-3.5 h-3.5 text-gold-400 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-gold-400 shrink-0">
              {sceneIdx + 1}/{DEMO_SCENES.length}
            </span>
            <span className="text-xs font-bold truncate">{scene.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[11px] font-bold text-teal-200 tabular-nums">
              {finished ? '00s' : `${String(remainingSec).padStart(2, '0')}s`}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Demo 60s"
              className="rounded p-0.5 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guion breve para hablar mientras cambia la pantalla */}
        <p className="text-[11px] text-navy-100 leading-snug">{scene.cue}</p>

        {/* Controles */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={sceneIdx === 0}
              onClick={() => {
                setFinished(false);
                setSceneIdx((i) => Math.max(0, i - 1));
              }}
              aria-label="Escena anterior"
              className="rounded p-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:pointer-events-none"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {finished ? (
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-bold bg-gold-500 text-navy-950 hover:bg-gold-400"
              >
                <RotateCcw className="w-3 h-3" /> Repetir 60s
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-bold bg-teal-600 text-white hover:bg-teal-500"
              >
                {paused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
                {paused ? 'Reanudar' : 'Pausar'}
              </button>
            )}

            <button
              type="button"
              disabled={sceneIdx === DEMO_SCENES.length - 1}
              onClick={() => {
                setFinished(false);
                setSceneIdx((i) => Math.min(DEMO_SCENES.length - 1, i + 1));
              }}
              aria-label="Siguiente escena"
              className="rounded p-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:pointer-events-none"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="hidden sm:inline text-[10px] text-navy-200">
            Espacio / → siguiente · P pausa
          </span>
        </div>
      </div>
    </aside>
  );
};
