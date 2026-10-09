"""Runtime settings. Every value can be overridden with an ``AGRIMINDS_``-prefixed environment variable."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from ai_drews.config import DEFAULT_CONFIG
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Obvious placeholder: refused in production so a real deployment cannot run on a shared secret.
DEV_JWT_SECRET = "dev-only-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AGRIMINDS_", env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

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

    # ---- database -------------------------------------------------------------------------
    database_url: str = "postgresql+asyncpg://agriminds:agriminds@localhost:5432/agriminds"
    db_echo: bool = False
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle_seconds: int = 1800

    # ---- cache ----------------------------------------------------------------------------
    redis_url: str | None = None  # e.g. redis://redis:6379/0 ; None -> in-process memory cache
    cache_ttl_seconds: int = 6 * 60 * 60

    # ---- security -------------------------------------------------------------------------
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    # Machine credentials for service-to-service calls (the Next.js proxy, the mobile app).
    api_keys: Annotated[list[str], NoDecode] = Field(default_factory=list)
    jwt_secret: SecretStr = SecretStr(DEV_JWT_SECRET)
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    jwt_issuer: str = "agriminds-api"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 14
    password_min_length: int = 10
    # Failed logins per account before it is temporarily locked.
    login_max_attempts: int = 8
    login_lockout_minutes: int = 15

    # ---- Metabase (optional analytics layer) ------------------------------------------------
    # Self-hosted and open source, so a ministry needs no per-seat BI licence. The server signs
    # a short-lived JWT for one dashboard; only that signed URL reaches the browser, and the
    # embedding secret never leaves the server. Farmers are never sent here at all.
    metabase_site_url: str | None = None  # how the API reaches Metabase, e.g. http://metabase:3000
    #: How a browser reaches Metabase, when that differs from the server's own view of it.
    #: Inside Compose the API knows it as `metabase:3000`, which no laptop can resolve.
    metabase_public_url: str | None = None
    metabase_secret_key: SecretStr | None = None  # Metabase admin > Embedding > secret key
    metabase_dashboard_id: int | None = None
    metabase_token_minutes: int = 10  # the signed URL is re-minted per view; keep it brief
    #: Name of a *locked* dashboard parameter that filters by woreda code. When set, a
    #: development agent's signed URL carries their own woreda and nothing else.
    metabase_woreda_param: str | None = None

    #: Host:port an analyst's own machine should use to reach the database, for the connection
    #: details handed to any BI tool. Inside Compose the server knows itself as `postgres:5432`,
    #: which resolves only on that network, so this must be set for a desktop tool to connect.
    analytics_public_host: str | None = None

    allow_precomputed_fallback: bool = True  # serve outputs/latest_risk.npz when weights are missing

    @field_validator(
        "metabase_site_url",
        "metabase_public_url",
        "metabase_secret_key",
        "metabase_dashboard_id",
        "metabase_woreda_param",
        "analytics_public_host",
        "redis_url",
        mode="before",
    )
    @classmethod
    def _blank_means_unset(cls, v: object) -> object:
        """An empty environment variable means "not configured", not "configured as empty".

        Compose substitutes `${VAR:-}` to an empty string for anything the operator has not set,
        and `.env.example` ships these keys blank. Without this the API refuses to start at all
        on a perfectly ordinary deployment: an optional integer cannot parse `""`.
        """
        if isinstance(v, str) and not v.strip():
            return None
        return v

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

    @model_validator(mode="after")
    def _production_requires_real_secret(self) -> Settings:
        if self.env == "production" and self.jwt_secret.get_secret_value() == DEV_JWT_SECRET:
            raise ValueError(
                "AGRIMINDS_JWT_SECRET must be set to a unique value in production "
                "(generate one with: openssl rand -hex 32)"
            )
        return self

    @property
    def metabase_configured(self) -> bool:
        """True only when every value needed to sign an embed URL is present."""
        return all((self.metabase_site_url, self.metabase_secret_key, self.metabase_dashboard_id))

    @property
    def metabase_browser_url(self) -> str | None:
        """The address to put in an iframe, which is not always the one the API uses."""
        return self.metabase_public_url or self.metabase_site_url

    @property
    def service_auth_enabled(self) -> bool:
        """True when machine clients must present X-API-Key."""
        return bool(self.api_keys)

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def sync_database_url(self) -> str:
        """psycopg/asyncpg-free URL for Alembic's synchronous engine."""
        return self.database_url.replace("+asyncpg", "").replace("+aiosqlite", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
