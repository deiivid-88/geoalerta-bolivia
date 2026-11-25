import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BOLIVIA_CENTER, DEPARTMENTS } from '../data/boliviaGeo';

interface LocationPickerMapProps {
  lat: number;
  lng: number;
  hasPin: boolean;
  onPickLocation: (lat: number, lng: number) => void;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  lat,
  lng,
  hasPin,
  onPickLocation
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: hasPin ? [lat, lng] : BOLIVIA_CENTER,
      zoom: hasPin ? 9 : 5,
      minZoom: 4,
      maxZoom: 15
    });

    // Capa base ligera (OSM) + polígonos departamentales vectoriales por si la conexión es lenta
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18
    }).addTo(map);

    DEPARTMENTS.forEach((dept) => {
      L.polygon(dept.polygon, {
        color: '#1A563F',
        weight: 1.5,
        fillColor: '#CBE3D6',
        fillOpacity: 0.2
      }).addTo(map);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const pickedLat = Math.round(e.latlng.lat * 10000) / 10000;
      const pickedLng = Math.round(e.latlng.lng * 10000) / 10000;
      onPickLocation(pickedLat, pickedLng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (hasPin) {
      const pinIcon = L.divIcon({
        className: 'terramina-marker-icon',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#D97706;border:3px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:#113D2D;"></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom(), 8), { animate: true });
    }
  }, [lat, lng, hasPin]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full h-64 sm:h-72 rounded-xl border-2 border-earth-300 overflow-hidden z-10"
        aria-label="Mapa para señalar el lugar aproximado del reporte"
      />
      <p className="text-xs text-earth-600">
        Toca o haz clic en el mapa para marcar el punto aproximado. Si tienes conexión lenta, los
        límites de Bolivia siguen visibles aunque tarde la imagen de fondo.
      </p>
    </div>
  );
};
