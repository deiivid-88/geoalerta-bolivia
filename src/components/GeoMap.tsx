import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AreaGeometry, CitizenReport, MiningRecord, SatelliteObservation, SourceDocument, TerritorialAlert } from '../types/domain';
import { BOLIVIA_CENTER, BOLIVIA_ZOOM, DEPARTMENTS, PROTECTED_AREAS_DEMO, RIVERS_DEMO } from '../data/boliviaGeo';
import { ADMIN_STATUS, ALERT_PRIORITY, DATA_COLORS, MINING_TYPE, OBSERVATION_TYPE, REPORT_CATEGORY } from '../domain/catalogs';

export type MapLayerKey =
  | 'records'
  | 'polygons'
  | 'reports'
  | 'satellites'
  | 'alerts'
  | 'sourceDocs'
  | 'protectedAreas'
  | 'departments'
  | 'rivers'
  | 'desafio4Persistente'
  | 'desafio4Nuevo'
  | 'desafio4Sar'
  | 'desafio4Prioridad'
  | 'pilotoS2_2022'
  | 'pilotoS2_2026'
  | 'pilotoNdti'
  | 'pilotoSar'
  | 'pilotoRiesgoHg'
  | 'pilotoPasivos'
  | 'pilotoTop15';

export type LayerVisibility = Record<MapLayerKey, boolean>;

export const DEFAULT_LAYERS: LayerVisibility = {
  records: true,
  polygons: true,
  reports: true,
  satellites: true,
  alerts: true,
  sourceDocs: false,
  protectedAreas: true,
  departments: true,
  rivers: false,
  desafio4Persistente: true,
  desafio4Nuevo: true,
  desafio4Sar: false,
  desafio4Prioridad: false,
  pilotoS2_2022: false,
  pilotoS2_2026: true,
  pilotoNdti: true,
  pilotoSar: false,
  pilotoRiesgoHg: false,
  pilotoPasivos: false,
  pilotoTop15: true
};

export type MapSelection =
  | { kind: 'record'; id: string }
  | { kind: 'report'; id: string }
  | { kind: 'satellite'; id: string }
  | { kind: 'alert'; id: string }
  | { kind: 'sourceDoc'; id: string };

export interface GeoMapProps {
  records?: MiningRecord[];
  reports?: CitizenReport[];
  satellites?: SatelliteObservation[];
  alerts?: TerritorialAlert[];
  sourceDocuments?: SourceDocument[];
  layers?: Partial<LayerVisibility>;
  selected?: MapSelection | null;
  onSelect?: (sel: MapSelection) => void;
  onMapClick?: (lat: number, lng: number) => void;
  focus?: { lat: number; lng: number; zoom: number; key: string | number } | null;
  highlightDepartment?: string;
  className?: string;
  /** Marca temporal de un punto buscado por coordenadas. */
  pin?: { lat: number; lng: number } | null;
  fitToData?: boolean;
  ariaLabel?: string;
}

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = import.meta.env.VITE_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors';
const SAT_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_TILE_ATTR = 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics';

const BOLIVIA_BOUNDS = L.latLngBounds([-22.9, -69.65], [-9.68, -57.45]);
const PILOTO_BOUNDS: L.LatLngBoundsExpression = [
  [-15.62, -67.98], // [sur, oeste]
  [-15.32, -67.62]  // [norte, este]
];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function getColorPrioridad(valor: number): string {
  if (valor >= 75) return '#7f1d1d';
  if (valor >= 55) return '#dc2626';
  if (valor >= 35) return '#f97316';
  return '#fef08a';
}

function desafio4Tooltip(p: Record<string, any>): string {
  const tipoLabels: Record<string, string> = {
    foco_persistente: 'Foco persistente (2022–2026)',
    expansion_nueva: 'Expansión nueva (2022→2026)',
    sar_anomalia: 'Anomalía Radar SAR'
  };
  const tipo = tipoLabels[String(p.tipo_capa)] ?? String(p.tipo_capa ?? 'Zona evaluada');
  return `
    <div style="font-size:12px; line-height:1.4;">
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



function top15Tooltip(p: Record<string, any>): string {
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
    <div style="font-size:12px; line-height:1.4;">
      <strong>Top 15 ORO-4.2 · ${esc(cat)}</strong><br/>
      <b>Prioridad:</b> ${esc(String(p.prioridad_total ?? 0))}/100 (Riesgo ${esc(String(p.riesgo_indice ?? 0))} · Valor ${esc(String(p.valor_indice ?? 0))})<br/>
      <b>Vol. estimado de colas:</b> ${esc(vol)} m&sup3;<br/>
      <b>Persistente:</b> ${esc(String(p.ha_persistente ?? 0))} ha · <b>Nuevo:</b> ${esc(String(p.ha_nuevo ?? 0))} ha · <b>Pasivo:</b> ${esc(String(p.ha_pasivo ?? 0))} ha<br/>
      <b>NDTI:</b> ${esc(String(p.ndti_turbidez ?? 0))} · <b>Píxeles SAR:</b> ${esc(String(p.pixeles_sar ?? 0))}<br/>
      <b>GPS:</b> ${esc(lat)}, ${esc(lon)}
    </div>
  `;
}


/** Formas distintas por tipo de entidad, para que la identidad no dependa solo del color. */
function recordIcon(r: MiningRecord, selected: boolean) {
  const c = ADMIN_STATUS[r.adminStatus].color;
  const size = selected ? 22 : 16;
  const dashed = r.adminStatus === 'sin_determinar';
  return L.divIcon({
    className: 'ga-marker',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${c};border:2px ${dashed ? 'dashed' : 'solid'} #fff;box-shadow:0 0 0 ${selected ? 3 : 1}px ${selected ? '#17364D' : 'rgba(23,54,77,.45)'},0 1px 3px rgba(0,0,0,.3)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}
function reportIcon(selected: boolean) {
  const s = selected ? 20 : 15;
  return L.divIcon({
    className: 'ga-marker',
    html: `<span style="display:block;width:${s}px;height:${s}px;border-radius:3px;background:#fff;border:3px solid ${DATA_COLORS.navyDeep};box-shadow:0 1px 3px rgba(0,0,0,.35)${selected ? ',0 0 0 3px #D5A329' : ''}"></span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2]
  });
}
function satIcon(o: SatelliteObservation, selected: boolean) {
  const s = selected ? 18 : 13;
  const auto = o.origin === 'automatizada';
  return L.divIcon({
    className: 'ga-marker',
    html: `<span style="display:block;width:${s}px;height:${s}px;transform:rotate(45deg);background:${auto ? '#fff' : '#087F8C'};border:2px ${auto ? 'dashed #087F8C' : 'solid #fff'};box-shadow:0 1px 3px rgba(0,0,0,.35)${selected ? ',0 0 0 3px #17364D' : ''}"></span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2]
  });
}
function alertIcon(a: TerritorialAlert, selected: boolean) {
  const c = ALERT_PRIORITY[a.priority].color;
  const s = selected ? 24 : 19;
  return L.divIcon({
    className: 'ga-marker',
    html: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))"><path d="M12 2 L23 21 H1 Z" fill="${c}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><rect x="11" y="9" width="2" height="6" fill="#fff"/><rect x="11" y="16.5" width="2" height="2" fill="#fff"/></svg>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2]
  });
}

function geometryLatLngs(g: AreaGeometry): L.LatLngExpression[][] | L.LatLngExpression[][][] {
  const ring = (r: [number, number][]) => r.map(([lng, lat]) => [lat, lng] as [number, number]);
  return g.type === 'Polygon' ? g.coordinates.map(ring) : g.coordinates.map((p) => p.map(ring));
}

export const GeoMap: React.FC<GeoMapProps> = ({
  records = [],
  reports = [],
  satellites = [],
  alerts = [],
  sourceDocuments = [],
  layers: layersProp,
  selected,
  onSelect,
  onMapClick,
  focus,
  highlightDepartment,
  className = 'h-[480px]',
  pin,
  fitToData,
  ariaLabel = 'Mapa territorial de Bolivia'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groups = useRef<Record<string, L.LayerGroup>>({});
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const [basemap, setBasemap] = useState<'mapa' | 'satelite'>('mapa');
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  onSelectRef.current = onSelect;
  onMapClickRef.current = onMapClick;
  const layers = { ...DEFAULT_LAYERS, ...layersProp };

  const [adm3GeoJson, setAdm3GeoJson] = useState<any>(null);
  const [desafio4GeoJson, setDesafio4GeoJson] = useState<any>(null);
  const [top15GeoJson, setTop15GeoJson] = useState<any>(null);

  useEffect(() => {
    fetch('/brand/bolivia_adm3_ligero.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAdm3GeoJson(data);
      })
      .catch(() => {});

    fetch('/brand/desafio4_bolivia_zonas.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDesafio4GeoJson(data);
      })
      .catch(() => {});

    fetch('/brand/piloto/top15_cuadrantes.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTop15GeoJson(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: BOLIVIA_CENTER, zoom: BOLIVIA_ZOOM, minZoom: 4, maxZoom: 18, zoomControl: true, attributionControl: true });
    baseLayerRef.current = null;
    // Encuadre inicial: territorio boliviano completo.
    map.fitBounds(BOLIVIA_BOUNDS, { padding: [8, 8] });
   L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    [
      'departments',
      'rivers',
      'protectedAreas',
      'pilotoS2_2022',
      'pilotoS2_2026',
      'pilotoNdti',
      'pilotoSar',
      'pilotoS2_2022',
      'pilotoS2_2026',
      'pilotoNdti',
      'pilotoSar',
      'pilotoRiesgoHg',
      'pilotoPasivos',
      'pilotoBorde',
      'pilotoTop15',
      'desafio4Prioridad',
      'desafio4Persistente',
      'desafio4Nuevo',
      'desafio4Sar',
      'polygons',
      'sourceDocs',
      'reports',
      'satellites',
      'records',
      'alerts',
      'pin'
    ].forEach((k) => {
      groups.current[k] = L.layerGroup().addTo(map);
    });
    map.on('click', (e: L.LeafletMouseEvent) => onMapClickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // Leaflet necesita recalcular el tamaño cuando el contenedor cambia (paneles, responsive).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      groups.current = {};
    };
  }, []);

  // Alternar mapa base (Callejero / Satélite) manteniendo siempre las capas encima
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    const nextLayer =
      basemap === 'satelite'
        ? L.tileLayer(SAT_TILE_URL, { attribution: SAT_TILE_ATTR, maxNativeZoom: 17, maxZoom: 19 })
        : L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 });
    nextLayer.addTo(map);
    nextLayer.bringToBack();
    baseLayerRef.current = nextLayer;
  }, [basemap]);

  // Capas de referencia
  useEffect(() => {
    const g = groups.current;
    if (!mapRef.current) return;
    g.departments.clearLayers();
    g.protectedAreas.clearLayers();
    g.rivers.clearLayers();
    if (layers.departments) {
      if (adm3GeoJson) {
        L.geoJSON(adm3GeoJson, {
          style: {
            color: '#17364D',
            weight: 0.9,
            opacity: 0.55,
            fillColor: '#17364D',
            fillOpacity: 0.02
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const name = feature?.properties?.shapeName;
            if (name) {
              layer.bindTooltip(`Municipio: ${esc(String(name))}`, { sticky: true });
            }
          }
        }).addTo(g.departments);
      }

      if (highlightDepartment) {
        const dept = DEPARTMENTS.find((d) => d.name === highlightDepartment);
        if (dept) {
          L.polygon(dept.polygon, {
            color: '#17364D',
            weight: 2.5,
            fillColor: '#17364D',
            fillOpacity: 0.08,
            interactive: false
          }).addTo(g.departments);
        }
      }
    }
    if (layers.protectedAreas) {
      PROTECTED_AREAS_DEMO.forEach((a) =>
        L.polygon(a.polygon, { color: '#087F8C', weight: 1.5, dashArray: '2 4', fillColor: '#087F8C', fillOpacity: 0.07 })
          .bindTooltip(`${esc(a.name)} · ${esc(a.category)}`, { sticky: true })
          .addTo(g.protectedAreas)
      );
    }
    if (layers.rivers) {
      RIVERS_DEMO.forEach((r) => L.polyline(r.coords, { color: '#23A9B6', weight: 2.5, opacity: 0.7 }).bindTooltip(esc(r.name), { sticky: true }).addTo(g.rivers));
    }
  }, [layers.departments, layers.protectedAreas, layers.rivers, highlightDepartment, adm3GeoJson]);


  // Capas ráster Zona Piloto: Confluencia Tipuani - Mapiri - Kaka
// Capas ráster Zona Piloto: Confluencia Tipuani - Mapiri - Kaka
  useEffect(() => {
    const g = groups.current;
    if (!mapRef.current || !g.pilotoS2_2022) return;
    [
      'pilotoS2_2022',
      'pilotoS2_2026',
      'pilotoNdti',
      'pilotoSar',
      'pilotoRiesgoHg',
      'pilotoPasivos',
      'pilotoBorde'
    ].forEach((k) => g[k]?.clearLayers());

    if (layers.pilotoS2_2022) {
      L.imageOverlay('/brand/piloto/s2_2022.png', PILOTO_BOUNDS, { opacity: 0.95 }).addTo(g.pilotoS2_2022);
    }
    if (layers.pilotoS2_2026) {
      L.imageOverlay('/brand/piloto/s2_2026.png', PILOTO_BOUNDS, { opacity: 0.95 }).addTo(g.pilotoS2_2026);
    }
    if (layers.pilotoNdti) {
      L.imageOverlay('/brand/piloto/ndti_2026.png', PILOTO_BOUNDS, { opacity: 0.95 }).addTo(g.pilotoNdti);
    }
    if (layers.pilotoSar) {
      L.imageOverlay('/brand/piloto/s1_vv_2026.png', PILOTO_BOUNDS, { opacity: 0.95 }).addTo(g.pilotoSar);
    }
    if (layers.pilotoRiesgoHg) {
      L.imageOverlay('/brand/piloto/riesgo_hg_2026.png', PILOTO_BOUNDS, { opacity: 0.85 }).addTo(g.pilotoRiesgoHg);
    }
    if (layers.pilotoPasivos) {
      L.imageOverlay('/brand/piloto/pasivos_2026.png', PILOTO_BOUNDS, { opacity: 0.9 }).addTo(g.pilotoPasivos);
    }

    if (
      layers.pilotoS2_2022 ||
      layers.pilotoS2_2026 ||
      layers.pilotoNdti ||
      layers.pilotoSar ||
      layers.pilotoRiesgoHg ||
      layers.pilotoPasivos
    ) {
      L.rectangle(PILOTO_BOUNDS, {
        color: '#facc15',
        weight: 2,
        fill: false,
        interactive: false
      })
        .bindTooltip('Zona Piloto: Confluencia Tipuani – Mapiri – Kaka')
        .addTo(g.pilotoBorde);
    }
  }, [
    layers.pilotoS2_2022,
    layers.pilotoS2_2026,
    layers.pilotoNdti,
    layers.pilotoSar,
    layers.pilotoRiesgoHg,
    layers.pilotoPasivos
  ]);

  // Top 15 cuadrantes prioritarios ORO-4.2 y puntos GPS (Zona Piloto)
  useEffect(() => {
    const g = groups.current;
    if (!mapRef.current || !g.pilotoTop15) return;
    g.pilotoTop15.clearLayers();
    if (!layers.pilotoTop15 || !top15GeoJson?.features) return;

    L.geoJSON(top15GeoJson as any, {
      style: { color: '#00ffff', fillColor: '#00ffff', weight: 2, fillOpacity: 0.14 },
      onEachFeature: (feature: any, layer: L.Layer) => {
        const props = feature?.properties || {};
        const tip = top15Tooltip(props);
        layer.bindTooltip(tip, { sticky: true });

        const lat = Number(props.lat);
        const lon = Number(props.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0) {
          L.circleMarker([lat, lon], {
            radius: 4.5,
            color: '#0f172a',
            weight: 1.5,
            fillColor: '#ffffff',
            fillOpacity: 1
          })
            .bindTooltip(tip, { sticky: true })
            .addTo(g.pilotoTop15);
        }
      }
    }).addTo(g.pilotoTop15);
  }, [top15GeoJson, layers.pilotoTop15]);

  // Capas Desafío 04 (GEE precalculado a escala nacional)

  
  // Capas Desafío 04 (GEE precalculado a escala nacional)
  useEffect(() => {
    const g = groups.current;
    if (!mapRef.current || !g.desafio4Persistente) return;
    g.desafio4Persistente.clearLayers();
    g.desafio4Nuevo.clearLayers();
    g.desafio4Sar.clearLayers();
    g.desafio4Prioridad.clearLayers();

    if (!desafio4GeoJson?.features) return;
    const features = desafio4GeoJson.features as any[];

    if (layers.desafio4Persistente) {
      L.geoJSON(
        { ...desafio4GeoJson, features: features.filter((f) => f.properties?.tipo_capa === 'foco_persistente') } as any,
        {
          style: { color: '#d97706', fillColor: '#f59e0b', weight: 1.5, fillOpacity: 0.45 },
          onEachFeature: (feature: any, layer: L.Layer) => {
            layer.bindTooltip(desafio4Tooltip(feature?.properties || {}), { sticky: true });
          }
        }
      ).addTo(g.desafio4Persistente);
    }

    if (layers.desafio4Nuevo) {
      L.geoJSON(
        { ...desafio4GeoJson, features: features.filter((f) => f.properties?.tipo_capa === 'expansion_nueva') } as any,
        {
          style: { color: '#b91c1c', fillColor: '#ef4444', weight: 1.5, fillOpacity: 0.45 },
          onEachFeature: (feature: any, layer: L.Layer) => {
            layer.bindTooltip(desafio4Tooltip(feature?.properties || {}), { sticky: true });
          }
        }
      ).addTo(g.desafio4Nuevo);
    }

    if (layers.desafio4Sar) {
      L.geoJSON(
        { ...desafio4GeoJson, features: features.filter((f) => f.properties?.tipo_capa === 'sar_anomalia') } as any,
        {
          style: { color: '#0284c7', fillColor: '#38bdf8', weight: 1.5, fillOpacity: 0.45 },
          onEachFeature: (feature: any, layer: L.Layer) => {
            layer.bindTooltip(desafio4Tooltip(feature?.properties || {}), { sticky: true });
          }
        }
      ).addTo(g.desafio4Sar);
    }

    if (layers.desafio4Prioridad) {
      L.geoJSON(desafio4GeoJson as any, {
        style: (feature: any) => {
          const col = getColorPrioridad(Number(feature?.properties?.prioridad_total ?? 0));
          return { color: col, fillColor: col, weight: 1, fillOpacity: 0.5 };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          layer.bindTooltip(desafio4Tooltip(feature?.properties || {}), { sticky: true });
        }
      }).addTo(g.desafio4Prioridad);
    }
  }, [
    desafio4GeoJson,
    layers.desafio4Persistente,
    layers.desafio4Nuevo,
    layers.desafio4Sar,
    layers.desafio4Prioridad
  ]);

  // Capas de datos
  useEffect(() => {
    const g = groups.current;
    if (!mapRef.current) return;
    ['polygons', 'records', 'reports', 'satellites', 'alerts', 'sourceDocs'].forEach((k) => g[k].clearLayers());
    const isSel = (kind: MapSelection['kind'], id: string) => selected?.kind === kind && selected.id === id;
    const fire = (sel: MapSelection) => () => onSelectRef.current?.(sel);

    if (layers.polygons) {
      records.forEach((r) => {
        if (!r.geometry) return;
        const c = ADMIN_STATUS[r.adminStatus].color;
        L.polygon(geometryLatLngs(r.geometry) as L.LatLngExpression[][], { color: c, weight: isSel('record', r.id) ? 3 : 1.5, fillColor: c, fillOpacity: 0.18 })
          .bindTooltip(`${esc(r.id)} · área de operación`, { sticky: true })
          .on('click', fire({ kind: 'record', id: r.id }))
          .addTo(g.polygons);
      });
    }
    if (layers.records) {
      records.forEach((r) =>
        L.marker([r.lat, r.lng], { icon: recordIcon(r, isSel('record', r.id)), zIndexOffset: isSel('record', r.id) ? 1000 : 0, keyboard: true, title: `${r.id} ${r.name}` })
          .bindTooltip(`<strong>${esc(r.name)}</strong><br/>${esc(ADMIN_STATUS[r.adminStatus].label)} · ${esc(MINING_TYPE[r.miningType].short)}`)
          .on('click', fire({ kind: 'record', id: r.id }))
          .addTo(g.records)
      );
    }
    if (layers.reports) {
      reports.forEach((r) =>
        L.marker([r.lat, r.lng], { icon: reportIcon(isSel('report', r.id)), keyboard: true, title: r.trackingCode })
          .bindTooltip(`<strong>Denuncia ${esc(r.trackingCode)}</strong><br/>${esc(REPORT_CATEGORY[r.category].short)} · no verificada`)
          .on('click', fire({ kind: 'report', id: r.id }))
          .addTo(g.reports)
      );
    }
    if (layers.satellites) {
      satellites.forEach((o) =>
        L.marker([o.lat, o.lng], { icon: satIcon(o, isSel('satellite', o.id)), keyboard: true, title: o.id })
          .bindTooltip(`<strong>${esc(o.id)}</strong><br/>${esc(OBSERVATION_TYPE[o.observationType])} · ${o.origin === 'automatizada' ? 'automatizada' : 'analista'}`)
          .on('click', fire({ kind: 'satellite', id: o.id }))
          .addTo(g.satellites)
      );
    }
    if (layers.alerts) {
      alerts.forEach((a) =>
        L.marker([a.lat, a.lng], { icon: alertIcon(a, isSel('alert', a.id)), zIndexOffset: 500, keyboard: true, title: a.title })
          .bindTooltip(`<strong>${esc(a.title)}</strong><br/>${esc(ALERT_PRIORITY[a.priority].label)}`)
          .on('click', fire({ kind: 'alert', id: a.id }))
          .addTo(g.alerts)
      );
    }
    if (layers.sourceDocs) {
      sourceDocuments.forEach((d) =>
        L.circleMarker([d.lat, d.lng], { radius: 6, color: '#17364D', weight: 2, fillColor: '#F5F1E8', fillOpacity: 1 })
          .bindTooltip(`${esc(d.institution)}: ${esc(d.title)}`)
          .on('click', fire({ kind: 'sourceDoc', id: d.id }))
          .addTo(g.sourceDocs)
      );
    }
  }, [records, reports, satellites, alerts, sourceDocuments, selected, layers.records, layers.polygons, layers.reports, layers.satellites, layers.alerts, layers.sourceDocs]);

  useEffect(() => {
    const g = groups.current.pin;
    if (!g) return;
    g.clearLayers();
    if (pin) L.circleMarker([pin.lat, pin.lng], { radius: 9, color: '#C94C4C', weight: 3, fillOpacity: 0, dashArray: '3 3' }).bindTooltip('Punto consultado').addTo(g);
  }, [pin]);

  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.6 });
  }, [focus]);

  useEffect(() => {
    if (!fitToData || !mapRef.current) return;
    const pts: [number, number][] = [...records.map((r) => [r.lat, r.lng] as [number, number])];
    if (pts.length > 1) mapRef.current.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 11 });
    else if (pts.length === 1) mapRef.current.setView(pts[0], 12);
    // Solo al montar / cambiar el conjunto: no se re-encuadra al seleccionar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToData, records.length]);

  return (
    <div className={`relative w-full ${className}`}>
      <div ref={containerRef} className="w-full h-full z-0" role="region" aria-label={ariaLabel} />
      <div
        className="absolute top-16 right-3 sm:top-3 z-[850] inline-flex rounded-md border border-ink-200 bg-white/95 p-0.5 shadow-pop text-xs font-semibold"
        role="group"
        aria-label="Tipo de mapa base"
      >
        <button
          type="button"
          onClick={() => setBasemap('mapa')}
          className={`px-2.5 py-1 rounded transition-colors ${
            basemap === 'mapa' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-ink-100'
          }`}
        >
          Mapa
        </button>
        <button
          type="button"
          onClick={() => setBasemap('satelite')}
          className={`px-2.5 py-1 rounded transition-colors ${
            basemap === 'satelite' ? 'bg-navy-900 text-white' : 'text-ink-700 hover:bg-ink-100'
          }`}
        >
          Satélite
        </button>
      </div>
    </div>
  );
};

/** Leyenda del mapa: cada símbolo con su forma y etiqueta. */
export const MapLegend: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={`text-[11px] text-ink-700 ${compact ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-1.5'}`}>
    {Object.entries(ADMIN_STATUS).map(([k, s]) => (
      <div key={k} className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full border-2 border-white shrink-0" style={{ background: s.color, boxShadow: '0 0 0 1px rgba(23,54,77,.45)', borderStyle: k === 'sin_determinar' ? 'dashed' : 'solid' }} />
        {s.label}
      </div>
    ))}
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm bg-white border-[3px] border-navy-900 shrink-0" /> Denuncia ciudadana (no verificada)
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rotate-45 bg-teal-700 border border-white shrink-0" /> Observación (analista)
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rotate-45 bg-white border-2 border-dashed border-teal-700 shrink-0" /> Observación automatizada
    </div>
    <div className="flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0">
        <path d="M12 2 L23 21 H1 Z" fill="#C94C4C" />
      </svg>
      Alerta territorial
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-xs shrink-0 border" style={{ background: 'rgba(245,158,11,0.45)', borderColor: '#d97706' }} /> Foco persistente (2022–2026)
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-xs shrink-0 border" style={{ background: 'rgba(239,68,68,0.45)', borderColor: '#b91c1c' }} /> Expansión nueva (2022→2026)
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-xs shrink-0 border" style={{ background: 'rgba(56,189,248,0.45)', borderColor: '#0284c7' }} /> Anomalía Radar SAR
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-xs shrink-0" style={{ background: 'linear-gradient(90deg, #fef08a, #f97316, #7f1d1d)' }} /> Riesgo ambiental Hg (piloto)
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-xs shrink-0 border" style={{ background: 'rgba(168,85,247,0.65)', borderColor: '#7e22ce' }} /> Pasivos / colas en reposo
    </div>
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-xs shrink-0 border-2" style={{ background: 'rgba(0,255,255,0.18)', borderColor: '#00ffff' }} /> Top 15 cuadrantes ORO-4.2
    </div>
  </div>
);
