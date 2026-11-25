from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración leída de variables de entorno / backend/.env. Sin valores secretos por defecto."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(default="", description="postgresql+psycopg://usuario:clave@host:5432/base")
    db_schema: str = "geoalerta"
    db_pool_size: int = 10

    jwt_secret: str = ""
    jwt_expire_hours: int = 8
    contact_encryption_key: str = ""

    storage_dir: str = "./storage"
    max_upload_mb: int = 15
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    max_failed_logins: int = 5
    lockout_minutes: int = 15

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def missing(self) -> list[str]:
        """Variables obligatorias que faltan o conservan el valor de ejemplo."""
        out = []
        if not self.database_url or "CAMBIAR" in self.database_url:
            out.append("DATABASE_URL")
        if len(self.jwt_secret) < 32 or "CAMBIAR" in self.jwt_secret:
            out.append("JWT_SECRET")
        if not self.contact_encryption_key or "CAMBIAR" in self.contact_encryption_key:
            out.append("CONTACT_ENCRYPTION_KEY")
        return out


@lru_cache
def get_settings() -> Settings:
    return Settings()
