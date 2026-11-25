import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { SatelliteObservation, SatelliteScenePreset } from '../types/domain';

interface SatelliteComparatorProps {
  observation: SatelliteObservation;
}

const SceneVisual: React.FC<{
  preset: SatelliteScenePreset;
  variant: 'before' | 'after';
  isRadar: boolean;
}> = ({ preset, variant, isRadar }) => {
  const bgBase = isRadar
    ? '#1E293B'
    : preset === 'highland_tailings'
    ? '#8D7B68'
    : '#1B4332';

  const canopyColor = isRadar
    ? '#334155'
    : preset === 'highland_tailings'
    ? '#A4907C'
    : '#2D6A4F';

  const riverBefore = isRadar ? '#0F172A' : '#1D6A89';
  const riverAfter = isRadar
    ? '#475569'
    : preset === 'highland_tailings'
    ? '#B48450'
    : '#A8763E';

  const disturbanceColor = isRadar ? '#E2E8F0' : '#C98A4B';

  return (
    <svg
      viewBox="0 0 600 340"
      className="w-full h-full object-cover select-none"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={`noise-${variant}-${isRadar ? 'r' : 'o'}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="1.2" fill={isRadar ? '#64748B' : '#40916C'} fillOpacity="0.25" />
          <circle cx="11" cy="12" r="1" fill={isRadar ? '#94A3B8' : '#081C15'} fillOpacity="0.2" />
        </pattern>
      </defs>

      {/* Fondo de cobertura base */}
      <rect width="600" height="340" fill={bgBase} />
      <rect width="600" height="340" fill={`url(#noise-${variant}-${isRadar ? 'r' : 'o'})`} />

      {/* Parches de vegetación / topografía */}
      <path
        d="M0,40 Q140,10 260,70 T520,50 L600,80 L600,0 L0,0 Z"
        fill={canopyColor}
        fillOpacity="0.65"
      />
      <path
        d="M0,290 Q180,230 340,280 T600,250 L600,340 L0,340 Z"
        fill={canopyColor}
        fillOpacity="0.7"
      />

      {/* Cauce fluvial / quebrada */}
      <path
        d="M-10,190 C110,140 190,230 310,165 C430,100 500,195 610,145"
        fill="none"
        stroke={variant === 'before' ? riverBefore : riverAfter}
        strokeWidth={variant === 'before' ? '26' : '32'}
        strokeLinecap="round"
      />

      {/* Cambios observados en escena "Después" */}
      {variant === 'after' && (
        <g>
          {/* Zona de remoción o cambio espectral */}
          <path
            d="M210,142 C240,112 315,108 355,138 C382,158 345,196 290,192 C238,188 195,165 210,142 Z"
            fill={disturbanceColor}
            fillOpacity="0.88"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          {preset === 'forest_clearing' && (
            <path
              d="M360,92 L455,105 L440,145 L350,130 Z"
              fill={disturbanceColor}
              fillOpacity="0.82"
              stroke="#F59E0B"
              strokeWidth="1.5"
            />
          )}
          {/* Puntos reflectores / pozas demostrativas */}
          <circle cx="275" cy="150" r="9" fill={isRadar ? '#FFFFFF' : '#78350F'} fillOpacity="0.85" />
          <circle cx="315" cy="158" r="7" fill={isRadar ? '#F8FAFC' : '#92400E'} fillOpacity="0.85" />
        </g>
      )}

      {/* Retícula de referencia cartográfica */}
      <line x1="200" y1="0" x2="200" y2="340" stroke="#FFFFFF" strokeOpacity="0.12" />
      <line x1="400" y1="0" x2="400" y2="340" stroke="#FFFFFF" strokeOpacity="0.12" />
      <line x1="0" y1="170" x2="600" y2="170" stroke="#FFFFFF" strokeOpacity="0.12" />
    </svg>
  );
};

export const SatelliteComparator: React.FC<SatelliteComparatorProps> = ({
  observation
}) => {
  const [splitPos, setSplitPos] = useState(50);
  const [viewMode, setViewMode] = useState<'optical' | 'radar'>(
    observation.sensor === 'sentinel1' ? 'radar' : 'optical'
  );

  return (
    <div className="bg-white rounded-2xl border border-earth-200 shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
            Visor comparativo Antes / Después (Simulación demostrativa)
          </span>
          <h3 className="text-lg font-bold text-forest-950">
            {observation.id} · {observation.zoneName}
          </h3>
        </div>

        <div className="inline-flex rounded-xl bg-earth-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewMode('optical')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'optical'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-earth-600'
            }`}
          >
            Sentinel-2 Óptico
          </button>
          <button
            type="button"
            onClick={() => setViewMode('radar')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'radar'
                ? 'bg-forest-900 text-white shadow-sm'
                : 'text-earth-600'
            }`}
          >
            Sentinel-1 Radar SAR
          </button>
        </div>
      </div>

      {/* Contenedor comparativo superpuesto */}
      <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden border border-earth-300 bg-forest-950">
        {/* Capa Después (fondo completo) */}
        <div className="absolute inset-0">
          <SceneVisual
            preset={observation.beforeScene}
            variant="after"
            isRadar={viewMode === 'radar'}
          />
        </div>

        {/* Capa Antes (recortada según slider) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
        >
          <SceneVisual
            preset={observation.beforeScene}
            variant="before"
            isRadar={viewMode === 'radar'}
          />
        </div>

        {/* Línea divisoria */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${splitPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-forest-900 shadow-md flex items-center justify-center border border-forest-800">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
        </div>

        {/* Etiquetas Antes / Después */}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-forest-950/80 text-white text-xs font-bold">
          Antes (referencia previa)
        </span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-ochre-600/90 text-white text-xs font-bold">
          Después ({observation.acquisitionDate})
        </span>

        {/* Escala gráfica */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-black/60 text-white text-[10px] font-mono flex items-center gap-2">
          <span className="inline-block w-10 h-1 bg-white" />
          <span>500 m (escala ilustrativa)</span>
        </div>
      </div>

      {/* Control deslizante accesible */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-semibold text-earth-600">
          <span>Desliza para comparar fechas</span>
          <span>Ventana: {observation.comparisonDate ?? 'periodo previo'} – {observation.acquisitionDate} · Ilustración esquemática, no imagen satelital real</span>
        </div>
        <input
          type="range"
          min={5}
          max={95}
          value={splitPos}
          onChange={(e) => setSplitPos(Number(e.target.value))}
          aria-label="Comparador temporal antes y después"
          className="w-full accent-forest-800 cursor-pointer"
        />
      </div>
    </div>
  );
};
