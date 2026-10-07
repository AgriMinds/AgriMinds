"""Dependency providers. Services are built once in the lifespan and stored on app.state."""

from __future__ import annotations

from fastapi import Request

from agriminds_api.core.config import Settings
from agriminds_api.services.advisory import AdvisoryService
from agriminds_api.services.drought import DroughtService
from agriminds_api.services.enso import EnsoService
from agriminds_api.services.inference import InferenceService


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_inference(request: Request) -> InferenceService:
    return request.app.state.inference


def get_drought(request: Request) -> DroughtService:
    return request.app.state.drought


def get_advisory(request: Request) -> AdvisoryService:
    return request.app.state.advisory


def get_enso(request: Request) -> EnsoService:
    return request.app.state.enso
