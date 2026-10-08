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


class DatabaseUnavailableError(AppError):
    """The database is not reachable."""

    status_code = 503
    code = "database_unavailable"


class InvalidLocationError(AppError):
    """Requested coordinates fall outside the watershed grid."""

    status_code = 422
    code = "invalid_location"


class UnauthorizedError(AppError):
    """Missing or invalid credentials."""

    status_code = 401
    code = "unauthorized"


class InvalidCredentialsError(UnauthorizedError):
    """The email/phone or password is incorrect."""

    code = "invalid_credentials"


class AccountLockedError(UnauthorizedError):
    """Too many failed sign-in attempts. Try again later."""

    code = "account_locked"


class ForbiddenError(AppError):
    """Your role does not allow this action."""

    status_code = 403
    code = "forbidden"


class NotFoundError(AppError):
    """The requested resource does not exist."""

    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    """The resource already exists."""

    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    """The request is not valid."""

    status_code = 422
    code = "validation_error"


def _payload(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        level = logging.WARNING if exc.status_code < 500 else logging.ERROR
        log.log(level, "%s: %s", exc.code, exc.message)
        headers = {"WWW-Authenticate": "Bearer"} if isinstance(exc, UnauthorizedError) else None
        return JSONResponse(status_code=exc.status_code, content=_payload(exc.code, exc.message), headers=headers)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content=_payload("internal_error", "An internal error occurred."))
