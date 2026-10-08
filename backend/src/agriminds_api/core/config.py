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

    # ---- Power BI (optional analytics layer) ------------------------------------------------
    # Embedding uses the "app owns data" model: one service principal holds the workspace
    # licence and the server mints a short-lived token per viewer. Ministry staff therefore need
    # no Power BI licence of their own, and farmers are never sent to it at all.
    powerbi_tenant_id: str | None = None
    powerbi_client_id: str | None = None
    powerbi_client_secret: SecretStr | None = None
    powerbi_workspace_id: str | None = None  # Power BI group id
    powerbi_report_id: str | None = None
    powerbi_dataset_id: str | None = None  # needed only when row-level security is in use
    #: Name of the role defined inside the report's dataset, if it enforces row-level security.
    powerbi_rls_role: str | None = None
    powerbi_token_minutes: int = 50  # Power BI caps embed tokens at 60 minutes
    powerbi_api_base: str = "https://api.powerbi.com/v1.0/myorg"
    powerbi_authority: str = "https://login.microsoftonline.com"
    powerbi_scope: str = "https://analysis.windows.net/powerbi/api/.default"

    #: Host:port an analyst's own machine should use to reach the database, for the connection
    #: details and the .pbids file. Inside Compose the server knows itself as `postgres:5432`,
    #: which resolves only on that network, so this must be set for Power BI Desktop to connect.
    analytics_public_host: str | None = None

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

    @model_validator(mode="after")
    def _production_requires_real_secret(self) -> Settings:
        if self.env == "production" and self.jwt_secret.get_secret_value() == DEV_JWT_SECRET:
            raise ValueError(
                "AGRIMINDS_JWT_SECRET must be set to a unique value in production "
                "(generate one with: openssl rand -hex 32)"
            )
        return self

    @property
    def powerbi_configured(self) -> bool:
        """True only when every value needed to mint an embed token is present."""
        return all(
            (
                self.powerbi_tenant_id,
                self.powerbi_client_id,
                self.powerbi_client_secret,
                self.powerbi_workspace_id,
                self.powerbi_report_id,
            )
        )

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
