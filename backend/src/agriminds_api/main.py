"""Application factory. Run with: uvicorn agriminds_api.main:app"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from agriminds_api import __version__
from agriminds_api.api.v1.router import api_router
from agriminds_api.core.cache import build_cache
from agriminds_api.core.config import Settings, get_settings
from agriminds_api.core.exceptions import register_exception_handlers
from agriminds_api.core.logging import RequestContextMiddleware, configure_logging
from agriminds_api.db.session import create_engine, create_session_factory
from agriminds_api.domain.geo import GridSpec
from agriminds_api.services.advisory import AdvisoryService
from agriminds_api.services.drought import DroughtService
from agriminds_api.services.enso import EnsoService
from agriminds_api.services.inference import InferenceService

log = logging.getLogger("agriminds")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, json_logs=settings.is_production)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        cache = build_cache(settings.redis_url)
        inference = InferenceService(settings, cache)
        await run_in_threadpool(inference.load)  # torch load off the event loop
        grid = GridSpec.from_bbox(settings.grid_rows, settings.grid_cols, settings.bbox)
        drought = DroughtService(inference, grid)

        engine = create_engine(settings)
        app.state.engine = engine
        app.state.session_factory = create_session_factory(engine)
        app.state.db_ready = False
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            app.state.db_ready = True
            log.info("database connection established")
        except Exception as exc:  # noqa: BLE001 - the API still serves forecasts without a database
            log.error("database unreachable at startup: %s", exc.__class__.__name__)

        app.state.settings = settings
        app.state.cache = cache
        app.state.inference = inference
        app.state.grid = grid
        app.state.drought = drought
        app.state.advisory = AdvisoryService(inference, drought)
        app.state.enso = EnsoService(inference, settings)

        if settings.is_production and not settings.service_auth_enabled:
            log.warning("AGRIMINDS_API_KEYS is empty in production: machine clients are unauthenticated")
        log.info("%s %s ready (env=%s, model=%s)", settings.project_name, __version__, settings.env, inference.source)
        try:
            yield
        finally:
            await engine.dispose()

    app = FastAPI(
        title=settings.project_name,
        version=__version__,
        description=(
            "AI-Enabled Drought Early Warning and Climate-Resilient Decision Support "
            "(AI-DREWS, Choke Mountain Watershed).\n\n"
            "Sign in at `POST /api/v1/auth/login` and send the access token as "
            "`Authorization: Bearer <token>`. Every forecast response carries a `provenance` block "
            "describing the model version, training data source and issue month."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["System"], include_in_schema=False)
    def root() -> dict:
        return {
            "project": settings.project_name,
            "version": __version__,
            "docs": "/docs",
            "api_v1": settings.api_v1_prefix,
        }

    return app


app = create_app()
