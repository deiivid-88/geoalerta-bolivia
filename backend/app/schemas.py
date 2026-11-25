"""Esquemas de entrada/salida. La API usa snake_case; el frontend convierte a camelCase."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .validation import BBOX, validate_geometry

AdminStatus = Literal["legal", "ilegal_verificada", "presuntamente_irregular", "en_proceso", "sin_determinar"]
MiningType = Literal["aurifera", "aluvial", "subterranea", "cielo_abierto", "aridos", "otro", "sin_clasificacion"]
VerificationState = Literal["no_verificado", "en_verificacion", "verificado_documental", "verificado_campo"]
Role = Literal["administrador", "analista_sig", "revisor_institucional", "consulta_institucional"]
ReportStatus = Literal["recibido", "pendiente_revision", "en_analisis", "info_requerida", "derivado_institucion", "en_seguimiento", "cerrado"]
ReviewState = Literal["pendiente_revision", "en_interpretacion", "coincidencia_territorial", "descartada", "variacion_estacional", "confirmada_tecnicamente"]
AlertStatus = Literal["activa", "en_atencion", "derivada", "cerrada"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Coords(Strict):
    lat: float = Field(ge=BBOX["min_lat"], le=BBOX["max_lat"], description="Latitud WGS84 dentro de Bolivia")
    lng: float = Field(ge=BBOX["min_lng"], le=BBOX["max_lng"], description="Longitud WGS84 dentro de Bolivia")


# ───────────── Autenticación ─────────────
class LoginIn(Strict):
    email: str = Field(max_length=254)
    password: str = Field(max_length=256)


# ───────────── Registros mineros ─────────────
class ClassificationIn(Strict):
    status: AdminStatus
    source_institution: str = Field(default="", max_length=300)
    source_document: str = Field(default="", max_length=500)
    consulted_at: date | None = None
    verification_state: VerificationState = "no_verificado"
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("consulted_at", mode="before")
    @classmethod
    def _empty_date(cls, v: Any) -> Any:
        return None if v == "" else v

    @model_validator(mode="after")
    def _support(self) -> "ClassificationIn":
        if self.status != "sin_determinar":
            missing = [n for n, v in (("source_document", self.source_document), ("source_institution", self.source_institution)) if not v]
            if missing or not self.consulted_at:
                raise ValueError("Toda clasificación distinta de «sin determinar» requiere institución, documento de respaldo y fecha de consulta.")
            if self.status == "ilegal_verificada" and self.verification_state == "no_verificado":
                raise ValueError("«Ilegal verificada» exige una determinación oficial verificada.")
        return self


class MiningRecordBase(Coords):
    name: str = Field(min_length=3, max_length=300)
    department: str = Field(min_length=2, max_length=60)
    province: str = Field(default="", max_length=120)
    municipality: str = Field(min_length=2, max_length=120)
    locality: str = Field(default="", max_length=200)
    mining_type: MiningType
    mineral: str | None = Field(default=None, max_length=200)
    holder: str = Field(default="No identificado", max_length=300)
    mining_right_code: str | None = Field(default=None, max_length=80)
    registered_at: date
    source: str = Field(max_length=500)
    observations: str = Field(default="", max_length=5000)
    geometry: dict | None = None
    origin: Literal["demo", "importado", "manual", "institucional"] = "manual"
    related_report_ids: list[str] = Field(default_factory=list)
    related_satellite_ids: list[str] = Field(default_factory=list)

    @field_validator("geometry")
    @classmethod
    def _geom(cls, v: dict | None) -> dict | None:
        err = validate_geometry(v)
        if err:
            raise ValueError(err)
        return v


class MiningRecordCreate(MiningRecordBase):
    classification: ClassificationIn


class MiningRecordPatch(Strict):
    expected_version: int
    name: str | None = Field(default=None, min_length=3, max_length=300)
    lat: float | None = Field(default=None, ge=BBOX["min_lat"], le=BBOX["max_lat"])
    lng: float | None = Field(default=None, ge=BBOX["min_lng"], le=BBOX["max_lng"])
    department: str | None = None
    province: str | None = None
    municipality: str | None = None
    locality: str | None = None
    mining_type: MiningType | None = None
    mineral: str | None = None
    holder: str | None = None
    mining_right_code: str | None = None
    registered_at: date | None = None
    source: str | None = None
    observations: str | None = None
    geometry: dict | None = None
    origin: str | None = None
    related_report_ids: list[str] | None = None
    related_satellite_ids: list[str] | None = None

    @field_validator("geometry")
    @classmethod
    def _geom(cls, v: dict | None) -> dict | None:
        err = validate_geometry(v)
        if err:
            raise ValueError(err)
        return v


class ClassifyIn(ClassificationIn):
    expected_version: int


# ───────────── Denuncias ─────────────
class PhotoIn(Strict):
    file_name: str = Field(max_length=200)
    data_url: str | None = Field(default=None, max_length=2_000_000)  # ~1.5 MB por foto ya comprimida
    url: str | None = None


class PublicReportIn(Coords):
    category: Literal["actividad_minera", "contaminacion_agua", "cambios_territorio", "afectacion_comunidades", "otra_ambiental"]
    observed_mining_type: MiningType | None = None
    department: str = Field(max_length=60)
    municipality: str = Field(max_length=120)
    community: str = Field(default="", max_length=200)
    location_description: str = Field(default="", max_length=1000)
    observed_when_preset: Literal["hoy", "esta_semana", "hace_mas_tiempo", "no_seguro"]
    observed_date: date
    description: str = Field(min_length=10, max_length=5000)
    photos: list[PhotoIn] = Field(default_factory=list, max_length=3)
    confidentiality: Literal["anonimo", "confidencial"]
    contact_info: str | None = Field(default=None, max_length=300)


class ReportStatusIn(Strict):
    status: ReportStatus
    public_note: str = Field(max_length=2000)
    assigned_institution: str | None = Field(default=None, max_length=300)
    internal_note: str = Field(min_length=3, max_length=2000)


class ReportLinksIn(Strict):
    related_satellite_id: str | None = None
    related_mining_record_id: str | None = None


# ───────────── Observaciones satelitales ─────────────
class SatelliteCreate(Coords):
    sensor: Literal["sentinel1", "sentinel2", "landsat", "planet", "otro"]
    origin: Literal["automatizada", "interpretacion_manual"]
    observation_type: Literal["remocion_vegetacion", "alteracion_cauce", "sedimentos", "posible_asentamiento", "apertura_camino", "acopio_relaves", "otro"]
    acquisition_date: date
    comparison_date: date | None = None
    department: str
    municipality: str
    zone_name: str = Field(max_length=200)
    approx_area_ha: float = Field(ge=0, le=1_000_000)
    confidence: Literal["alta", "media", "baja"]
    review_state: ReviewState = "pendiente_revision"
    change_description: str = Field(min_length=3, max_length=5000)
    related_report_ids: list[str] = Field(default_factory=list)
    related_mining_record_ids: list[str] = Field(default_factory=list)
    before_scene: str = "forest_clearing"


class ReviewIn(Strict):
    review_state: ReviewState
    note: str = Field(min_length=3, max_length=2000)


class DocVerificationIn(Strict):
    result: Literal["coincide_con_registro", "sin_respaldo_documental", "no_concluyente"]
    document: str = Field(min_length=2, max_length=500)
    institution: str = Field(min_length=2, max_length=300)
    notes: str | None = Field(default=None, max_length=2000)


class SatLinksIn(Strict):
    related_mining_record_ids: list[str] | None = None
    related_report_ids: list[str] | None = None


# ───────────── Alertas, fuentes, usuarios, auditoría ─────────────
class EntityRefIn(Strict):
    type: Literal["registro_minero", "denuncia", "observacion"]
    id: str


class AlertCreate(Coords):
    title: str = Field(min_length=3, max_length=300)
    type: Literal["observacion_satelital", "denuncia_ciudadana", "area_protegida", "inconsistencia_documental", "cuerpo_de_agua", "otro"]
    priority: Literal["alta", "media", "baja"]
    status: AlertStatus = "activa"
    department: str
    municipality: str = ""
    description: str = Field(min_length=3, max_length=5000)
    related: list[EntityRefIn] = Field(default_factory=list)


class AlertStatusIn(Strict):
    status: AlertStatus
    note: str = Field(default="", max_length=2000)
    derived_to: str | None = Field(default=None, max_length=300)


class SourcePatch(Strict):
    availability: Literal["integracion_pendiente", "carga_manual", "api_disponible", "no_disponible"] | None = None
    updated_at: date | None = None
    reference: str | None = None
    reference_url: str | None = None
    usage_conditions: str | None = None
    notes: str | None = None

    @field_validator("updated_at", mode="before")
    @classmethod
    def _empty(cls, v: Any) -> Any:
        return None if v == "" else v


class UserCreate(Strict):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    role: Role
    institution: str = Field(default="", max_length=300)
    active: bool = True
    password: str = Field(min_length=12, max_length=256)


class UserPatch(Strict):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    role: Role | None = None
    institution: str | None = None
    active: bool | None = None
    password: str | None = Field(default=None, min_length=12, max_length=256)


class ClientEventIn(Strict):
    action: Literal["exportar"]
    entity_type: str = Field(max_length=40)
    entity_id: str = Field(max_length=300)
    summary: str = Field(max_length=2000)
