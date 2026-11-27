import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Mail, Pause, Play, RotateCcw, ShieldCheck, SkipBack, SkipForward, Timer, X } from 'lucide-react';
import { navigate } from '../app/router';
import { useSession } from '../app/session';
import { BrandLogo } from './BrandLogo';

export type DemoMapScene = 'nacional-ficha' | 'nacional-oro42' | 'piloto-3d' | 'swipe' | 'decision' | 'clear';
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
  showLoginPreview?: boolean;
  cue: string;
}

const DEMO_SCENES: DemoScene[] = [
  {
    id: 1,
    label: 'Acceso por correos y roles',
    path: '/',
    durationSec: 4,
    showLoginPreview: true,
    cue: 'Ingreso institucional con cuentas por correo y permisos por rol, además de acceso público para denuncias ciudadanas.'
  },
  {
    id: 2,
    label: 'Inicio / Dashboard',
    path: '/',
    durationSec: 4,
    cue: 'Resumen nacional de registros mineros, denuncias pendientes, observaciones satelitales y alertas activas.'
  },
  {
    id: 3,
    label: 'Mapa Nacional · Capas y Ficha',
    path: '/mapa',
    durationSec: 7,
    mapScene: 'nacional-ficha',
    cue: 'Vista de toda Bolivia con capas de gestión territorial activas: al hacer clic en cualquier punto se abre su ficha técnica.'
  },
  {
    id: 4,
    label: 'Mapa Nacional · Capas ORO-4.2',
    path: '/mapa',
    durationSec: 5,
    mapScene: 'nacional-oro42',
    cue: 'Alternamos capas para aislar el motor satelital nacional ORO-4.2: prioridad, persistencia, expansión y radar SAR.'
  },
  {
    id: 5,
    label: 'Zona Piloto AOI en 3D',
    path: '/mapa',
    durationSec: 7,
    mapScene: 'piloto-3d',
    cue: 'Acercamiento directo al AOI Tipuani–Mapiri en relieve 3D con Sentinel-2 (2026), turbidez NDTI y columnas del Top 15.'
  },
  {
    id: 6,
    label: 'Comparador 2022 ⟷ 2026',
    path: '/mapa',
    durationSec: 5,
    mapScene: 'swipe',
    cue: 'Cortina multitemporal para evidenciar el avance minero en 4 años, plumas de turbidez y cobertura radar bajo nubes.'
  },
  {
    id: 7,
    label: 'Matriz y Simulador ORO-4.2',
    path: '/mapa',
    durationSec: 7,
    mapScene: 'decision',
    cue: 'Matriz Riesgo vs. Valor del Top 15, simulador de oro limpio, mercurio evitado y descarga de rutas .gpx para campo.'
  },
  {
    id: 8,
    label: 'Registros mineros',
    path: '/registros',
    durationSec: 3,
    cue: 'Catálogo filtrable de operaciones, derechos mineros, situación administrativa y estado de verificación.'
  },
  {
    id: 9,
    label: 'Denuncias ciudadanas',
    path: '/denuncias',
    durationSec: 3,
    cue: 'Reportes ciudadanos georreferenciados con código de seguimiento y flujo de validación.'
  },
  {
    id: 10,
    label: 'Observaciones satelitales',
    path: '/satelital',
    durationSec: 3,
    cue: 'Registro técnico de cambios detectados por sensores ópticos y radar con nivel de confianza.'
  },
  {
    id: 11,
    label: 'Información institucional',
    path: '/institucional',
    durationSec: 3,
    cue: 'Documentos y fuentes oficiales de respaldo para contrastar hallazgos satelitales.'
  },
  {
    id: 12,
    label: 'Análisis territorial',
    path: '/analisis',
    durationSec: 3,
    cue: 'Indicadores y comparativas por departamento, municipio y modalidad de minería.'
  },
  {
    id: 13,
    label: 'Alertas territoriales',
    path: '/alertas',
    durationSec: 2,
    cue: 'Seguimiento priorizado de las alertas territoriales activas para respuesta oportuna.'
  },
  {
    id: 14,
    label: 'Informes',
    path: '/informes',
    durationSec: 2,
    cue: 'Generación de reportes consolidados listos para municipios y autoridades.'
  },
  {
    id: 15,
    label: 'Administración',
    path: '/admin',
    durationSec: 2,
    cue: 'Control de usuarios, perfiles institucionales y trazabilidad completa de auditoría.'
  }
];

const TOTAL_SECONDS = DEMO_SCENES.reduce((acc, s) => acc + s.durationSec, 0);

interface Demo60sControllerProps {
  onClose: () => void;
}

export const Demo60sController: React.FC<Demo60sControllerProps> = ({ onClose }) => {
  const { session } = useSession();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  const scene = DEMO_SCENES[sceneIdx] ?? DEMO_SCENES[0];
  const userEmail = (session?.user as any)?.email || 'administrador@geoalerta.bo';

  useEffect(() => {
    setElapsedMs(0);
    setDemoMapScene(scene.mapScene ?? null);
    navigate(scene.path);
  }, [sceneIdx, scene.path, scene.mapScene]);

  useEffect(() => {
    return () => {
      activeDemoMapScene = null;
    };
  }, []);

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
    <>
      {/* Paso 1: Cortina fiel de acceso institucional (sin cerrar la sesión real) */}
      {scene.showLoginPreview && (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-teal-950 p-4"
          aria-label="Vista previa de acceso institucional"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex flex-col items-center text-center space-y-2">
              <BrandLogo className="h-11" showSlogan />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-0.5 text-[11px] font-bold text-teal-900">
                <ShieldCheck className="w-3.5 h-3.5" /> Acceso institucional verificado
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  Correo institucional
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-teal-600/40 bg-teal-50/40 px-3 py-2 text-sm font-semibold text-navy-900">
                  <Mail className="w-4 h-4 text-teal-800 shrink-0" />
                  <span className="truncate">{userEmail}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  Contraseña
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ivory-50 px-3 py-2 text-sm text-ink-600">
                  <Lock className="w-4 h-4 text-ink-400 shrink-0" />
                  <span>••••••••••••</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center">
              {['Administrador', 'Analista Satelital', 'Fiscalizador', 'Portal Ciudadano'].map((role, i) => (
                <span
                  key={role}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                    i === 0
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'bg-ivory-50 text-ink-600 border-ink-200'
                  }`}
                >
                  {role}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-xs font-bold text-white">
              <CheckCircle2 className="w-4 h-4 text-gold-400" />
              Sesión verificada · Ingresando a GeoAlerta Bolivia...
            </div>
          </div>
        </div>
      )}

      {/* Barra flotante de control 60s */}
      <aside
        aria-label="Controlador de Demo en 60 segundos"
        className="fixed bottom-3 right-3 z-[1500] w-[calc(100%-1.5rem)] sm:w-[420px] rounded-xl border border-white/15 bg-navy-900/95 text-white shadow-2xl backdrop-blur-md overflow-hidden"
      >
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

          <p className="text-[11px] text-navy-100 leading-snug">{scene.cue}</p>

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
    </>
  );
};
