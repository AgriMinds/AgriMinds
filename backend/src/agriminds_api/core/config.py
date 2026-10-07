"""Runtime settings. Every value can be overridden with an ``AGRIMINDS_``-prefixed environment variable."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from ai_drews.config import DEFAULT_CONFIG
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGRIMINDS_", env_file=".env", env_file_encoding="utf-8", extra="ignore")

    project_name: str = "AgriMinds AI-DREWS API"
    env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"

    # Paths: data root shared with the ai-drews package (raw/, processed/, models/, outputs/)
    data_dir: Path = Path("data")

    # Choke Mountain Watershed grid (defaults come from the ML pipeline config so both stay in sync)
    grid_rows: int = DEFAULT_CONFIG.rows
    grid_cols: int = DEFAULT_CONFIG.cols
    bbox: tuple[float, float, float, float] = DEFAULT_CONFIG.bbox  # lon_min, lat_min, lon_max, lat_max
    drought_leads: int = DEFAULT_CONFIG.drought_leads
    enso_leads: int = DEFAULT_CONFIG.enso_leads
    enso_history_months: int = 36

    # Cache
    redis_url: str | None = None  # e.g. redis://redis:6379/0 ; None -> in-process memory cache
    cache_ttl_seconds: int = 6 * 60 * 60

    # Security
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"])
    api_keys: list[str] = Field(default_factory=list)  # empty -> auth disabled (local development only)
    allow_precomputed_fallback: bool = True  # serve outputs/latest_risk.npz when weights are missing

    @field_validator("cors_origins", "api_keys", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard_with_credentials(cls, v: list[str]) -> list[str]:
        if "*" in v:
            raise ValueError("CORS wildcard '*' is not allowed; list explicit origins")
        return v

    @property
    def auth_enabled(self) -> bool:
        return bool(self.api_keys)

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
