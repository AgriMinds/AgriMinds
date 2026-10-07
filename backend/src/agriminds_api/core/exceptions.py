"""Typed application errors mapped to clean HTTP responses. Internals are never leaked to clients."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("agriminds.errors")


class AppError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.__class__.__doc__ or self.code)
        self.message = message or self.__class__.__doc__ or self.code


class ModelUnavailableError(AppError):
    """Drought model artifacts are not available; forecasts cannot be served."""

    status_code = 503
    code = "model_unavailable"


class InvalidLocationError(AppError):
    """Requested coordinates fall outside the watershed grid."""

    status_code = 422
    code = "invalid_location"


class UnauthorizedError(AppError):
    """Missing or invalid API key."""

    status_code = 401
    code = "unauthorized"


def _payload(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        level = logging.WARNING if exc.status_code < 500 else logging.ERROR
        log.log(level, "%s: %s", exc.code, exc.message)
        headers = {"WWW-Authenticate": "ApiKey"} if isinstance(exc, UnauthorizedError) else None
        return JSONResponse(
            status_code=exc.status_code, content=_payload(exc.code, exc.message), headers=headers
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500, content=_payload("internal_error", "An internal error occurred.")
        )
