"""Lectura de archivos de importación → filas normalizadas (dict) + geometría opcional.

Formatos: CSV (UTF-8, `,` o `;`), Excel .xlsx (primera hoja), GeoJSON FeatureCollection,
Shapefile en .zip (.shp + .shx + .dbf; se exige .prj en WGS84 o se asume EPSG:4326 con advertencia).
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from typing import Any

from .validation import normalize

STATUS_ALIASES = {
    "legal": "legal", "legal_autorizada": "legal", "autorizada": "legal",
    "ilegal_verificada": "ilegal_verificada", "ilegal_verif.": "ilegal_verificada",
    "presuntamente_irregular": "presuntamente_irregular", "presunta_irreg.": "presuntamente_irregular",
    "en_proceso": "en_proceso", "sin_determinar": "sin_determinar", "": "sin_determinar",
}
TYPE_ALIASES = {
    "aurifera": "aurifera", "mineria_aurifera": "aurifera", "aluvial": "aluvial", "mineria_aluvial": "aluvial",
    "subterranea": "subterranea", "mineria_subterranea": "subterranea", "cielo_abierto": "cielo_abierto",
    "mineria_a_cielo_abierto": "cielo_abierto", "aridos": "aridos", "extraccion_de_aridos": "aridos",
    "otro": "otro", "sin_clasificacion": "sin_clasificacion", "": "sin_clasificacion",
}
VERIF_ALIASES = {
    "no_verificado": "no_verificado", "en_verificacion": "en_verificacion",
    "verificado_documental": "verificado_documental", "verificado_documentalmente": "verificado_documental",
    "verificado_campo": "verificado_campo", "verificado_en_campo": "verificado_campo", "": "no_verificado",
}


def _key(k: str) -> str:
    return normalize(str(k)).replace(" ", "_").replace("/", "_")


def map_enum(value: Any, aliases: dict[str, str], default: str) -> str:
    return aliases.get(_key(value or ""), default)


def to_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def normalize_row(raw: dict[str, Any]) -> dict[str, Any]:
    row = {_key(k): (v.strip() if isinstance(v, str) else v) for k, v in raw.items() if k is not None}
    return row


def read_csv(data: bytes) -> list[tuple[dict, dict | None]]:
    text = data.decode("utf-8-sig")
    first = text.splitlines()[0] if text else ""
    delimiter = ";" if first.count(";") > first.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [(normalize_row(r), None) for r in reader]


def read_xlsx(data: bytes) -> list[tuple[dict, dict | None]]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h) if h is not None else "" for h in next(rows, [])]
    out = []
    for values in rows:
        if values is None or all(v in (None, "") for v in values):
            continue
        out.append((normalize_row(dict(zip(header, values))), None))
    return out


def _centroid(geom: dict) -> tuple[float, float]:
    ring = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
    pts = ring[:-1] or ring
    return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)


def _feature_to_row(props: dict, geom: dict | None) -> tuple[dict, dict | None]:
    row = normalize_row(props or {})
    area = None
    if geom and geom.get("type") == "Point":
        row.setdefault("longitud", geom["coordinates"][0])
        row.setdefault("latitud", geom["coordinates"][1])
    elif geom and geom.get("type") in ("Polygon", "MultiPolygon"):
        area = geom
        lat, lng = _centroid(geom)
        row.setdefault("latitud", lat)
        row.setdefault("longitud", lng)
    return row, area


def read_geojson(data: bytes) -> list[tuple[dict, dict | None]]:
    fc = json.loads(data.decode("utf-8-sig"))
    if fc.get("type") != "FeatureCollection":
        raise ValueError("El archivo no es un GeoJSON FeatureCollection.")
    return [_feature_to_row(f.get("properties") or {}, f.get("geometry")) for f in fc.get("features", [])]


def read_shapefile_zip(data: bytes) -> tuple[list[tuple[dict, dict | None]], list[str]]:
    import shapefile  # pyshp

    warnings: list[str] = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        shp = next((n for n in names if n.lower().endswith(".shp")), None)
        if not shp:
            raise ValueError("El .zip no contiene un archivo .shp.")
        base = shp[:-4]
        need = {ext: next((n for n in names if n.lower() == (base + ext).lower()), None) for ext in (".shx", ".dbf", ".prj")}
        if not need[".shx"] or not need[".dbf"]:
            raise ValueError("El Shapefile debe incluir .shp, .shx y .dbf con el mismo nombre.")
        if need[".prj"]:
            prj = z.read(need[".prj"]).decode("latin-1")
            if "WGS_1984" not in prj and "WGS 84" not in prj and "4326" not in prj:
                raise ValueError("El Shapefile no está en WGS84 (EPSG:4326). Reproyéctelo antes de importar (p. ej. con QGIS u ogr2ogr).")
        else:
            warnings.append("Sin archivo .prj: se asume EPSG:4326 (WGS84).")
        reader = shapefile.Reader(shp=io.BytesIO(z.read(shp)), shx=io.BytesIO(z.read(need[".shx"])), dbf=io.BytesIO(z.read(need[".dbf"])), encoding="utf-8", encodingErrors="replace")
        out = []
        for sr in reader.iterShapeRecords():
            geom = sr.shape.__geo_interface__ if sr.shape.shapeType != shapefile.NULL else None
            out.append(_feature_to_row(sr.record.as_dict(), geom))
    return out, warnings


def parse_file(fmt: str, data: bytes) -> tuple[list[tuple[dict, dict | None]], list[str]]:
    if fmt == "csv":
        return read_csv(data), []
    if fmt == "xlsx":
        return read_xlsx(data), []
    if fmt == "geojson":
        return read_geojson(data), []
    if fmt == "shapefile":
        return read_shapefile_zip(data)
    raise ValueError(f"Formato no soportado: {fmt}")


def to_multipolygon(geom: dict | None) -> dict | None:
    if geom is None:
        return None
    if geom["type"] == "Polygon":
        return {"type": "MultiPolygon", "coordinates": [geom["coordinates"]]}
    return geom
