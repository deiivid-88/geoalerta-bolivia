import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AreaGeometry, CitizenReport, MiningRecord, SatelliteObservation, SourceDocument, TerritorialAlert } from '../types/domain';
import { BOLIVIA_CENTER, BOLIVIA_ZOOM, DEPARTMENTS, PROTECTED_AREAS_DEMO, RIVERS_DEMO } from '../data/boliviaGeo';
import { ADMIN_STATUS, ALERT_PRIORITY, DATA_COLORS, MINING_TYPE, OBSERVATION_TYPE, REPORT_CATEGORY } from '../domain/catalogs';

export type MapLayerKey = 'records' | 'polygons' | 'reports' | 'satellites' | 'alerts' | 'sourceDocs' | 'protectedAreas' | 'departments' | 'rivers';
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
  rivers: false
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

const BOLIVIA_BOUNDS = L.latLngBounds([-22.9, -69.65], [-9.68, -57.45]);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  onSelectRef.current = onSelect;
  onMapClickRef.current = onMapClick;
  const layers = { ...DEFAULT_LAYERS, ...layersProp };

  const [adm3GeoJson, setAdm3GeoJson] = useState<any>(null);

  useEffect(() => {
    fetch('/brand/bolivia_adm3_ligero.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAdm3GeoJson(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: BOLIVIA_CENTER, zoom: BOLIVIA_ZOOM, minZoom: 4, maxZoom: 18, zoomControl: true, attributionControl: true });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    // Encuadre inicial: territorio boliviano completo.
    map.fitBounds(BOLIVIA_BOUNDS, { padding: [8, 8] });
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    ['departments', 'rivers', 'protectedAreas', 'polygons', 'sourceDocs', 'reports', 'satellites', 'records', 'alerts', 'pin'].forEach((k) => {
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

  return <div ref={containerRef} className={`w-full z-0 ${className}`} role="region" aria-label={ariaLabel} />;
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
  </div>
);
