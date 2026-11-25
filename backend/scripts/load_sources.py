"""Carga el catálogo de fuentes institucionales con estado «integración pendiente».

No crea conexiones ni datos institucionales: solo describe las fuentes previstas.
Uso:  .venv\\Scripts\\python -m scripts.load_sources
"""
from __future__ import annotations

from sqlalchemy import create_engine, text

from app.config import get_settings

PENDING = "Por definir mediante convenio interinstitucional. No se ha establecido conexión."
SOURCES = [
    ("SRC-SERGEOMIN", "Servicio Geológico Minero", "SERGEOMIN", "Cartografía geológica, catastro de recursos minerales e inventarios técnicos", "Portal institucional SERGEOMIN", "https://www.sergeomin.gob.bo"),
    ("SRC-MMM", "Ministerio de Minería y Metalurgia", "MMM", "Políticas sectoriales, registros de operadores y pasivos ambientales mineros", "Portal institucional del Ministerio", "https://www.mineria.gob.bo"),
    ("SRC-AJAM", "Autoridad Jurisdiccional Administrativa Minera", "AJAM", "Derechos mineros, contratos administrativos, cuadrículas y resoluciones", "Portal institucional AJAM", "https://www.autoridadminera.gob.bo"),
    ("SRC-MMAYA", "Ministerio de Medio Ambiente y Agua", "MMAyA", "Licencias ambientales, monitoreo hídrico y cuencas", "Portal institucional MMAyA", "https://www.mmaya.gob.bo"),
    ("SRC-INE", "Instituto Nacional de Estadística", "INE", "Estadísticas oficiales de producción minera y división político-administrativa", "Portal institucional INE", "https://www.ine.gob.bo"),
    ("SRC-SERNAP", "Servicio Nacional de Áreas Protegidas", "SERNAP", "Límites y zonificación de áreas protegidas nacionales", "Portal institucional SERNAP", "https://sernap.gob.bo"),
    ("SRC-GOB", "Gobiernos autónomos departamentales y municipales", "GAD / GAM", "Autorizaciones locales de áridos, ordenamiento territorial", "Por definir con cada gobierno autónomo", None),
]


def main() -> None:
    s = get_settings()
    engine = create_engine(s.database_url, connect_args={"options": f"-csearch_path={s.db_schema},public"})
    with engine.begin() as c:
        for sid, inst, acr, info, ref, url in SOURCES:
            c.execute(
                text("""INSERT INTO institutional_sources (id, institution, acronym, info_type, reference, reference_url, usage_conditions)
                        VALUES (:id, :inst, :acr, :info, :ref, :url, :uc) ON CONFLICT (id) DO NOTHING"""),
                {"id": sid, "inst": inst, "acr": acr, "info": info, "ref": ref, "url": url, "uc": PENDING},
            )
    print(f"✓ {len(SOURCES)} fuentes institucionales registradas (integración pendiente).")


if __name__ == "__main__":
    main()
