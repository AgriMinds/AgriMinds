from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ModelStatus(BaseModel):
    loaded: bool
    source: Literal["model", "precomputed", "unavailable"]
    model_version: str | None = None
    data_source: str | None = None
    issued_date: str | None = None
    enso_forecast_available: bool = False


class CacheStatus(BaseModel):
    backend: str
    reachable: bool


class DatabaseStatus(BaseModel):
    configured: bool
    reachable: bool


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unavailable"]
    service: str
    version: str
    environment: str
    auth_enabled: bool
    model: ModelStatus
    cache: CacheStatus
    database: DatabaseStatus
