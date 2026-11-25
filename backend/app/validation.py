"""Reglas de validación compartidas (sin dependencia de base de datos)."""
from __future__ import annotations

import unicodedata

BBOX = {"min_lat": -23.0, "max_lat": -9.6, "min_lng": -69.75, "max_lng": -57.35}


def inside_bolivia(lat: float, lng: float) -> bool:
    return BBOX["min_lat"] <= lat <= BBOX["max_lat"] and BBOX["min_lng"] <= lng <= BBOX["max_lng"]


def normalize(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn").lower().strip()


def validate_geometry(geom: dict | None) -> str | None:
    """Comprobación estructural de Polygon/MultiPolygon. La validez topológica la verifica PostGIS (ST_IsValid)."""
    if geom is None:
        return None
    gtype = geom.get("type")
    coords = geom.get("coordinates")
    if gtype not in ("Polygon", "MultiPolygon") or not isinstance(coords, list) or not coords:
        return "La geometría debe ser GeoJSON Polygon o MultiPolygon."
    polygons = [coords] if gtype == "Polygon" else coords
    for poly in polygons:
        if not poly or not isinstance(poly[0], list):
            return "Polígono vacío."
        ring = poly[0]
        if len(ring) < 4:
            return "Cada polígono necesita al menos 4 vértices (anillo cerrado)."
        if list(ring[0]) != list(ring[-1]):
            return "El anillo del polígono debe estar cerrado (primer vértice = último)."
        for pt in ring:
            if not (isinstance(pt, (list, tuple)) and len(pt) >= 2):
                return "Vértice inválido."
            lng, lat = float(pt[0]), float(pt[1])
            if not inside_bolivia(lat, lng):
                return "La geometría contiene vértices fuera del territorio boliviano (¿orden lng, lat?)."
    return None


def degrade_unsupported(row_status: str, document: str, institution: str, consulted_at: str | None) -> str:
    """En importaciones: una clasificación sin respaldo completo se registra como «sin_determinar»."""
    if row_status != "sin_determinar" and not (document and institution and consulted_at):
        return "sin_determinar"
    return row_status
