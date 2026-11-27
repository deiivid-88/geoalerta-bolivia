import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_LAYERS, GeoMap, type MapSelection } from './GeoMap';
import { BOLIVIA_CENTER, BOLIVIA_ZOOM } from '../data/boliviaGeo';
import { ADMIN_STATUS, ALERT_PRIORITY } from '../domain/catalogs';

type GeoMap3DProps = React.ComponentProps<typeof GeoMap>;

const PILOTO_COORDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [-67.98, -15.32], // Noroeste [lng, lat]
  [-67.62, -15.32], // Noreste
  [-67.62, -15.62], // Sureste
  [-67.98, -15.62]  // Suroeste
];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function desafio4Html(p: Record<string, any>): string {
  const tipoLabels: Record<string, string> = {
    foco_persistente: 'Foco persistente (2022–2026)',
    expansion_nueva: 'Expansión nueva (2022–2026)',
    sar_anomalia: 'Anomalía Radar SAR'
  };
  const tipo = tipoLabels[String(p.tipo_capa)] ?? String(p.tipo_capa ?? 'Zona evaluada');
  return `
    <div style="font-size:12px; line-height:1.4; color:#0f172a;">
      <strong>Desafío 04 (ORO-4.2)</strong><br/>
      <b>Tipo:</b> ${esc(tipo)}<br/>
      <b>Prioridad Total:</b> ${esc(String(p.prioridad_total ?? 0))} / 100<br/>
      <b>Riesgo:</b> ${esc(String(p.riesgo_indice ?? 0))} · <b>Valor:</b> ${esc(String(p.valor_indice ?? 0))}<br/>
      <b>Persistente:</b> ${esc(String(p.ha_persistente ?? 0))} ha · <b>Nuevo:</b> ${esc(String(p.ha_nuevo ?? 0))} ha<br/>
      <b>Pasivo:</b> ${esc(String(p.ha_pasivo ?? 0))} ha · <b>NDTI:</b> ${esc(String(p.ndti_turbidez ?? 0))}<br/>
      <b>Píxeles SAR:</b> ${esc(String(p.pixeles_sar ?? 0))}
    </div>
  `;
}

function top15Html(p: Record<string, any>): string {
  const catLabels: Record<string, string> = {
    CRITICO_REPROCESABLE: 'Crítico / Reprocesable',
    ALTO_RIESGO_CONTENCION: 'Alto riesgo (Contención)',
    OPORTUNIDAD_REPROCESO: 'Oportunidad de reproceso',
    MONITOREO: 'Monitoreo'
  };
  const cat = catLabels[String(p.categoria)] ?? String(p.categoria ?? 'Sitio prioritario');
  const vol = Number(p.vol_colas_m3 ?? 0).toLocaleString('es-BO');
  const lat = Number(p.lat ?? 0).toFixed(5);
  const lon = Number(p.lon ?? 0).toFixed(5);
  return `
    <div style="font-size:12px; line-height:1.4; color:#0f172a;">
      <strong>Top 15 ORO-4.2 · ${esc(cat)}</strong><br/>
      <b>Prioridad:</b> ${esc(String(p.prioridad_total ?? 0))}/100 (Riesgo ${esc(String(p.riesgo_indice ?? 0))} · Valor ${esc(String(p.valor_indice ?? 0))})<br/>
      <b>Vol. estimado de colas:</b> ${esc(vol)} m&sup3;<br/>
      <b>Persistente:</b> ${esc(String(p.ha_persistente ?? 0))} ha · <b>Nuevo:</b> ${esc(String(p.ha_nuevo ?? 0))} ha · <b>Pasivo:</b> ${esc(String(p.ha_pasivo ?? 0))} ha<br/>
      <b>GPS:</b> ${esc(lat)}, ${esc(lon)}
    </div>
  `;
}

export const GeoMap3D: React.FC<GeoMap3DProps> = ({
  records = [],
  reports = [],
  satellites = [],
  alerts = [],
  layers: layersProp,
  onSelect,
  focus,
  className = 'h-[480px]',
  ariaLabel = 'Mapa territorial 3D de Bolivia'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const layers = { ...DEFAULT_LAYERS, ...layersProp };
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<'satelite' | 'mapa'>('satelite');
  const [exaggeration, setExaggeration] = useState<number>(2);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const fz = focus?.zoom ?? BOLIVIA_ZOOM;
    const initialCenter: [number, number] = focus
      ? [focus.lng, focus.lat]
      : [BOLIVIA_CENTER[1], BOLIVIA_CENTER[0]];
    const initialZoom = focus ? Math.max(fz - 0.7, 4) : Math.max(BOLIVIA_ZOOM - 0.5, 4.5);
    const initialPitch = focus && fz >= 10 ? 60 : 42;
    const initialBearing = focus && fz >= 10 ? -25 : 0;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: initialCenter,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      maxPitch: 80,
      style: {
        version: 8,
        sources: {
          'esri-sat': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 17,
            attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics'
          },
          'osm-base': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          },
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14
          }
        },
        layers: [
          { id: 'base-sat', type: 'raster', source: 'esri-sat', layout: { visibility: 'visible' } },
          { id: 'base-osm', type: 'raster', source: 'osm-base', layout: { visibility: 'none' } }
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      try {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 2 });
      } catch {
        // Fallback silencioso si WebGL no soporta terreno
      }

      // 1. Límites municipales
      map.addSource('adm3-src', { type: 'geojson', data: '/brand/bolivia_adm3_ligero.geojson' });
      map.addLayer({
        id: 'layer-departments',
        type: 'line',
        source: 'adm3-src',
        paint: { 'line-color': '#e2e8f0', 'line-width': 0.8, 'line-opacity': 0.45 }
      });

      // 2. Overlays ráster Zona Piloto sobre el relieve 3D
      const pilotoOverlays: { id: string; url: string }[] = [
        { id: 'piloto-s2-2022', url: '/brand/piloto/s2_2022.png' },
        { id: 'piloto-s2-2026', url: '/brand/piloto/s2_2026.png' },
        { id: 'piloto-ndti', url: '/brand/piloto/ndti_2026.png' },
        { id: 'piloto-sar', url: '/brand/piloto/s1_vv_2026.png' },
        { id: 'piloto-riesgo-hg', url: '/brand/piloto/riesgo_hg_2026.png' },
        { id: 'piloto-pasivos', url: '/brand/piloto/pasivos_2026.png' }
      ];
      pilotoOverlays.forEach(({ id, url }) => {
        map.addSource(id, { type: 'image', url, coordinates: PILOTO_COORDS });
        map.addLayer({
          id: `layer-${id}`,
          type: 'raster',
          source: id,
          paint: { 'raster-opacity': id === 'piloto-riesgo-hg' ? 0.85 : 0.92 },
          layout: { visibility: 'none' }
        });
      });

      // Borde amarillo de la Zona Piloto
      map.addSource('piloto-borde-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[...PILOTO_COORDS, PILOTO_COORDS[0]]] }
        }
      });
      map.addLayer({
        id: 'layer-piloto-borde',
        type: 'line',
        source: 'piloto-borde-src',
        paint: { 'line-color': '#facc15', 'line-width': 2.5 },
        layout: { visibility: 'none' }
      });

      // 3. Motor Nacional ORO-4.2 (extrusión 3D por prioridad)
      map.addSource('d4-src', { type: 'geojson', data: '/brand/desafio4_bolivia_zonas.geojson' });

      map.addLayer({
        id: 'layer-d4-prioridad',
        type: 'fill-extrusion',
        source: 'd4-src',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': [
            'step',
            ['coalesce', ['to-number', ['get', 'prioridad_total']], 0],
            '#fef08a',
            35, '#f97316',
            55, '#dc2626',
            75, '#7f1d1d'
          ],
          'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'prioridad_total']], 10], 220],
          'fill-extrusion-opacity': 0.78
        }
      });

      map.addLayer({
        id: 'layer-d4-persistente',
        type: 'fill-extrusion',
        source: 'd4-src',
        filter: ['==', ['get', 'tipo_capa'], 'foco_persistente'],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#f59e0b',
          'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'prioridad_total']], 10], 180],
          'fill-extrusion-opacity': 0.75
        }
      });

      map.addLayer({
        id: 'layer-d4-nuevo',
        type: 'fill-extrusion',
        source: 'd4-src',
        filter: ['==', ['get', 'tipo_capa'], 'expansion_nueva'],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#ef4444',
          'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'prioridad_total']], 10], 180],
          'fill-extrusion-opacity': 0.75
        }
      });

      map.addLayer({
        id: 'layer-d4-sar',
        type: 'fill-extrusion',
        source: 'd4-src',
        filter: ['==', ['get', 'tipo_capa'], 'sar_anomalia'],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#38bdf8',
          'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'prioridad_total']], 10], 180],
          'fill-extrusion-opacity': 0.75
        }
      });

      // 4. Top 15 Cuadrantes ORO-4.2 (extrusión 3D en Zona Piloto)
      map.addSource('top15-src', { type: 'geojson', data: '/brand/piloto/top15_cuadrantes.geojson' });
      map.addLayer({
        id: 'layer-top15-extrusion',
        type: 'fill-extrusion',
        source: 'top15-src',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': [
            'match',
            ['get', 'categoria'],
            'CRITICO_REPROCESABLE', '#ef4444',
            'ALTO_RIESGO_CONTENCION', '#f97316',
            'OPORTUNIDAD_REPROCESO', '#06b6d4',
            '#22d3ee'
          ],
          'fill-extrusion-height': ['*', ['coalesce', ['to-number', ['get', 'prioridad_total']], 15], 8],
          'fill-extrusion-opacity': 0.55
        }
      });
      map.addLayer({
        id: 'layer-top15-outline',
        type: 'line',
        source: 'top15-src',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#00ffff', 'line-width': 2 }
      });

      // 5. Puntos de gestión territorial
      const emptyFC = { type: 'FeatureCollection' as const, features: [] };
      ['records', 'reports', 'satellites', 'alerts'].forEach((k) => {
        map.addSource(`pts-${k}`, { type: 'geojson', data: emptyFC });
      });

      map.addLayer({
        id: 'layer-reports',
        type: 'circle',
        source: 'pts-reports',
        paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#17364D', 'circle-stroke-width': 2.5 }
      });
      map.addLayer({
        id: 'layer-satellites',
        type: 'circle',
        source: 'pts-satellites',
        paint: { 'circle-radius': 6, 'circle-color': '#087F8C', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }
      });
      map.addLayer({
        id: 'layer-records',
        type: 'circle',
        source: 'pts-records',
        paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }
      });
      map.addLayer({
        id: 'layer-alerts',
        type: 'circle',
        source: 'pts-alerts',
        paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 }
      });

      // Interacción unificada
      const interactiveLayers = [
        'layer-alerts',
        'layer-records',
        'layer-reports',
        'layer-satellites',
        'layer-top15-extrusion',
        'layer-d4-prioridad',
        'layer-d4-nuevo',
        'layer-d4-persistente',
        'layer-d4-sar'
      ];

      map.on('mousemove', (e) => {
        const active = interactiveLayers.filter((id) => map.getLayer(id));
        const hits = map.queryRenderedFeatures(e.point, { layers: active });
        map.getCanvas().style.cursor = hits.length ? 'pointer' : '';
      });

      map.on('click', (e) => {
        const active = interactiveLayers.filter((id) => map.getLayer(id));
        const hits = map.queryRenderedFeatures(e.point, { layers: active });
        if (!hits.length) return;

        const top = hits[0];
        const lid = top.layer.id;
        const props = (top.properties || {}) as Record<string, any>;

        if (lid === 'layer-records' || lid === 'layer-reports' || lid === 'layer-satellites' || lid === 'layer-alerts') {
          const kindMap: Record<string, MapSelection['kind']> = {
            'layer-records': 'record',
            'layer-reports': 'report',
            'layer-satellites': 'satellite',
            'layer-alerts': 'alert'
          };
          if (props.id) onSelectRef.current?.({ kind: kindMap[lid], id: String(props.id) });
          return;
        }

        popupRef.current?.remove();
        const html = lid === 'layer-top15-extrusion' ? top15Html(props) : desafio4Html(props);
        popupRef.current = new maplibregl.Popup({ maxWidth: '300px' })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      setMapReady(true);
    });

    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alternar mapa base
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty('base-sat', 'visibility', basemap === 'satelite' ? 'visible' : 'none');
    map.setLayoutProperty('base-osm', 'visibility', basemap === 'mapa' ? 'visible' : 'none');
  }, [basemap, mapReady]);

  // Ajustar exageración del relieve 3D
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      map.setTerrain(exaggeration > 0 ? { source: 'terrain-dem', exaggeration } : (null as any));
    } catch {
      // noop
    }
  }, [exaggeration, mapReady]);

  // Sincronizar visibilidad de capas
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const setVis = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    };

    setVis('layer-departments', layers.departments);
    setVis('layer-records', layers.records);
    setVis('layer-reports', layers.reports);
    setVis('layer-satellites', layers.satellites);
    setVis('layer-alerts', layers.alerts);

    setVis('layer-d4-prioridad', layers.desafio4Prioridad);
    setVis('layer-d4-persistente', layers.desafio4Persistente);
    setVis('layer-d4-nuevo', layers.desafio4Nuevo);
    setVis('layer-d4-sar', layers.desafio4Sar);

    setVis('layer-piloto-s2-2022', layers.pilotoS2_2022);
    setVis('layer-piloto-s2-2026', layers.pilotoS2_2026);
    setVis('layer-piloto-ndti', layers.pilotoNdti);
    setVis('layer-piloto-sar', layers.pilotoSar);
    setVis('layer-piloto-riesgo-hg', layers.pilotoRiesgoHg);
    setVis('layer-piloto-pasivos', layers.pilotoPasivos);
    setVis(
      'layer-piloto-borde',
      layers.pilotoS2_2022 ||
        layers.pilotoS2_2026 ||
        layers.pilotoNdti ||
        layers.pilotoSar ||
        layers.pilotoRiesgoHg ||
        layers.pilotoPasivos
    );

    setVis('layer-top15-extrusion', layers.pilotoTop15);
    setVis('layer-top15-outline', layers.pilotoTop15);
  }, [
    mapReady,
    layers.departments,
    layers.records,
    layers.reports,
    layers.satellites,
    layers.alerts,
    layers.desafio4Prioridad,
    layers.desafio4Persistente,
    layers.desafio4Nuevo,
    layers.desafio4Sar,
    layers.pilotoS2_2022,
    layers.pilotoS2_2026,
    layers.pilotoNdti,
    layers.pilotoSar,
    layers.pilotoRiesgoHg,
    layers.pilotoPasivos,
    layers.pilotoTop15
  ]);

  // Actualizar puntos filtrados
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const setPts = (sourceId: string, features: any[]) => {
      const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features } as any);
    };

    setPts(
      'pts-records',
      records.map((r) => ({
        type: 'Feature',
        properties: { id: r.id, color: (ADMIN_STATUS[r.adminStatus] as any)?.color ?? '#0f766e' },
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] }
      }))
    );
    setPts(
      'pts-reports',
      reports.map((r) => ({
        type: 'Feature',
        properties: { id: r.id },
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] }
      }))
    );
    setPts(
      'pts-satellites',
      satellites.map((s) => ({
        type: 'Feature',
        properties: { id: s.id },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] }
      }))
    );
    setPts(
      'pts-alerts',
      alerts.map((a) => ({
        type: 'Feature',
        properties: { id: a.id, color: (ALERT_PRIORITY[a.priority] as any)?.color ?? '#dc2626' },
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] }
      }))
    );
  }, [mapReady, records, reports, satellites, alerts]);

  // Vuelo suave en 3D
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focus) return;
    const fz = focus.zoom ?? 12;
    const isDetail = fz >= 10;
    map.flyTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(fz - 0.7, 4),
      pitch: isDetail ? 60 : 38,
      bearing: isDetail ? -25 : 0,
      duration: 1200
    });
  }, [focus, mapReady]);

  const togglePitch = () => {
    const map = mapRef.current;
    if (!map) return;
    const isTilted = map.getPitch() > 20;
    map.easeTo({ pitch: isTilted ? 0 : 60, bearing: isTilted ? 0 : -25, duration: 700 });
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div ref={containerRef} className="w-full h-full z-0" role="region" aria-label={ariaLabel} />

      {/* Controles 3D flotantes */}
      <div className="absolute top-16 right-14 sm:top-3 sm:right-14 z-[850] flex flex-wrap items-center gap-1.5">
        <div
          className="inline-flex rounded-md border border-ink-200 bg-white/95 p-0.5 shadow-pop text-xs font-semibold"
          role="group"
          aria-label="Mapa base 3D"
        >
          <button
            type="button"
            onClick={() => setBasemap('mapa')}
            className={`px-2 py-1 rounded transition-colors ${
              basemap === 'mapa' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-ink-100'
            }`}
          >
            Mapa
          </button>
          <button
            type="button"
            onClick={() => setBasemap('satelite')}
            className={`px-2 py-1 rounded transition-colors ${
              basemap === 'satelite' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-ink-100'
            }`}
          >
            Satélite
          </button>
        </div>

        <button
          type="button"
          onClick={togglePitch}
          className="rounded-md border border-ink-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-navy-900 shadow-pop hover:bg-teal-50"
          title="Alternar inclinación 3D / vista superior"
        >
          Inclinar / Cenital
        </button>

        <button
          type="button"
          onClick={() => setExaggeration((v) => (v === 2 ? 3 : v === 3 ? 0 : 2))}
          className="rounded-md border border-ink-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-navy-900 shadow-pop hover:bg-teal-50"
          title="Cambiar exageración vertical del terreno"
        >
          Relieve: {exaggeration === 0 ? 'Plano' : `${exaggeration}×`}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-2 right-3 z-[800] hidden sm:block rounded bg-navy-900/80 px-2 py-1 text-[10px] text-white">
        Clic derecho o Ctrl + arrastrar para rotar e inclinar · Clic en columnas para ver métricas
      </div>
    </div>
  );
};
