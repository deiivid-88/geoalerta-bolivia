import React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Layers, X } from 'lucide-react';
import { DEFAULT_LAYERS, type LayerVisibility } from './GeoMap';
import { BOLIVIA_CENTER, BOLIVIA_ZOOM } from '../data/boliviaGeo';

export interface TourStep {
  id: number;
  badge: string;
  title: string;
  description: string;
  highlight: string;
  chips: string[];
  viewMode: '2d' | '3d';
  focus: { lat: number; lng: number; zoom: number };
  layers: LayerVisibility;
  showCsvDownload?: boolean;
}

function onlyLayers(active: Partial<LayerVisibility>): LayerVisibility {
  const base = Object.fromEntries(
    (Object.keys(DEFAULT_LAYERS) as Array<keyof LayerVisibility>).map((k) => [k, false])
  ) as LayerVisibility;
  return { ...base, ...active };
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    badge: 'Paso 1 de 4 · Escala Nacional',
    title: 'Priorización nacional de riesgo (89 zonas críticas)',
    description:
      'El motor ORO-4.2 precalculado en Google Earth Engine evalúa el territorio boliviano en celdas de 5 km cruzando persistencia minera, expansión 2022–2026, turbidez fluvial y radar SAR.',
    highlight: 'Pasa el cursor sobre cualquier celda en el mapa para inspeccionar su puntaje de prioridad (0–100), hectáreas y riesgo.',
    chips: ['Vista 2D', 'Índice Prioridad ORO-4.2', '89 celdas'],
    viewMode: '2d',
    focus: { lat: BOLIVIA_CENTER[0], lng: BOLIVIA_CENTER[1], zoom: BOLIVIA_ZOOM },
    layers: onlyLayers({
      departments: true,
      protectedAreas: true,
      desafio4Prioridad: true
    })
  },
  {
    id: 2,
    badge: 'Paso 2 de 4 · Zona Piloto 3D',
    title: 'Corredor fluvial Tipuani–Mapiri y turbidez (NDTI)',
    description:
      'Al descender en relieve 3D se observa cómo la minería aluvial se concentra en el fondo de los cañones (HAND < 35 m). La capa NDTI resalta el arrastre de sedimentos en el cauce.',
    highlight: 'Usa clic derecho + arrastrar (o Ctrl + arrastrar) para rotar el cañón y comprobar el confinamiento topográfico.',
    chips: ['Relieve 3D', 'Sentinel-2 (2026)', 'Turbidez NDTI'],
    viewMode: '3d',
    focus: { lat: -15.47, lng: -67.8, zoom: 12.2 },
    layers: onlyLayers({
      departments: true,
      pilotoS2_2026: true,
      pilotoNdti: true
    })
  },
  {
    id: 3,
    badge: 'Paso 3 de 4 · Operación sin nubes',
    title: 'Radar Sentinel-1 SAR y mapa de riesgo de mercurio',
    description:
      'En época de lluvias las nubes bloquean los sensores ópticos. El radar SAR (banda VV) atraviesa la nubosidad para detectar frentes activos sobre el río y alimentar el mapa continuo de riesgo de Hg.',
    highlight: 'El gradiente amarillo a rojo oscuro marca los focos prioritarios de muestreo ambiental (0–100).',
    chips: ['Sentinel-1 SAR VV', 'Riesgo ambiental Hg', 'Sin nubes'],
    viewMode: '3d',
    focus: { lat: -15.45, lng: -67.81, zoom: 12.5 },
    layers: onlyLayers({
      departments: true,
      pilotoSar: true,
      pilotoRiesgoHg: true
    })
  },
  {
    id: 4,
    badge: 'Paso 4 de 4 · Decisión y Acción en Campo',
    title: 'Pasivos en reposo y Top 15 cuadrantes (Riesgo vs. Valor)',
    description:
      'Combinamos 60 % Riesgo Ambiental y 40 % Valor Recuperable para priorizar 15 cuadrantes de 1.5 km y colas en reposo (morado) con volumen estimado en m³ listo para intervención.',
    highlight: 'Haz clic en cualquier columna 3D para ver su categoría estratégica, volumen de colas y coordenadas GPS.',
    chips: ['Top 15 3D', 'Pasivos 2022–2026', 'Volumen m³'],
    viewMode: '3d',
    focus: { lat: -15.48, lng: -67.79, zoom: 12.3 },
    layers: onlyLayers({
      departments: true,
      pilotoS2_2026: true,
      pilotoPasivos: true,
      pilotoTop15: true
    }),
    showCsvDownload: true
  }
];

interface GuidedTourORO42Props {
  stepIndex: number;
  onStepChange: (nextIndex: number) => void;
  onClose: () => void;
}

export const GuidedTourORO42: React.FC<GuidedTourORO42Props> = ({ stepIndex, onStepChange, onClose }) => {
  const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <section
      aria-label="Recorrido guiado ORO-4.2"
      className="absolute bottom-24 sm:bottom-16 left-3 z-[950] w-[calc(100%-1.5rem)] sm:w-[390px] rounded-lg border border-ink-200 bg-white/95 backdrop-blur-sm shadow-pop overflow-hidden"
    >
      {/* Barra superior de progreso */}
      <div className="flex items-center justify-between gap-2 bg-navy-900 px-3.5 py-2 text-white">
        <span className="text-[11px] font-bold uppercase tracking-wide text-teal-200">{step.badge}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar recorrido guiado"
          className="rounded p-0.5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Indicador visual de pasos */}
      <div className="grid grid-cols-4 gap-1 bg-ivory-50 px-3.5 pt-2.5">
        {TOUR_STEPS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStepChange(idx)}
            aria-label={`Ir al paso ${idx + 1}`}
            className={`h-1.5 rounded-full transition-colors ${
              idx <= stepIndex ? 'bg-teal-700' : 'bg-ink-200 hover:bg-ink-300'
            }`}
          />
        ))}
      </div>

      {/* Contenido del paso */}
      <div className="p-3.5 space-y-2.5">
        <h3 className="text-sm font-bold text-navy-900 leading-snug">{step.title}</h3>
        <p className="text-xs text-ink-700 leading-relaxed">{step.description}</p>

        <div className="rounded-md bg-ivory-50 border border-ink-200/80 px-2.5 py-2 text-[11px] text-ink-700">
          <strong className="text-teal-800">Tip para explorar:</strong> {step.highlight}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Layers className="w-3.5 h-3.5 text-teal-800 shrink-0" />
          {step.chips.map((chip) => (
            <span
              key={chip}
              className="rounded bg-teal-50 border border-teal-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-teal-900"
            >
              {chip}
            </span>
          ))}
        </div>

        {step.showCsvDownload && (
          <a
            href="/brand/piloto/top15_sitios.csv"
            download="top15_sitios_oro42.csv"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-teal-700/30 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar Top 15 puntos GPS (.csv)
          </a>
        )}
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between gap-2 border-t border-ink-200 bg-ivory-50 px-3.5 py-2">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onStepChange(stepIndex - 1)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
        </button>

        {!isLast ? (
          <button
            type="button"
            onClick={() => onStepChange(stepIndex + 1)}
            className="inline-flex items-center gap-1 rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800"
          >
            Siguiente <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Explorar libremente
          </button>
        )}
      </div>
    </section>
  );
};
