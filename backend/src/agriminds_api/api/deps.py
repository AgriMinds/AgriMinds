"""Dependency providers.

Stateless services are built once in the lifespan and stored on ``app.state``; anything that
touches the database is built per request around a single session and transaction.
"""

from __future__ import annotations

import hmac
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core import security
from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import DatabaseUnavailableError, ForbiddenError, UnauthorizedError
from agriminds_api.db.models import User, UserRole
from agriminds_api.domain.geo import GridSpec
from agriminds_api.services.advisory import AdvisoryService
from agriminds_api.services.auth import AuthService
from agriminds_api.services.dashboard import DashboardService
from agriminds_api.services.drought import DroughtService
from agriminds_api.services.enso import EnsoService
from agriminds_api.services.farm import FarmService
from agriminds_api.services.inference import InferenceService
from agriminds_api.services.powerbi import PowerBiService

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token from POST /auth/login")


# ------------------------------------------------------------------ app-scoped singletons
def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_grid(request: Request) -> GridSpec:
    return request.app.state.grid


def get_inference(request: Request) -> InferenceService:
    return request.app.state.inference


def get_drought(request: Request) -> DroughtService:
    return request.app.state.drought


def get_advisory(request: Request) -> AdvisoryService:
    return request.app.state.advisory


def get_enso(request: Request) -> EnsoService:
    return request.app.state.enso


def get_powerbi(request: Request) -> PowerBiService:
    return request.app.state.powerbi


# ------------------------------------------------------------------ database session
async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One session and one transaction per request: commit on success, roll back on failure."""
    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise DatabaseUnavailableError("The database is not configured on this instance.")
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_app_settings)]


# ------------------------------------------------------------------ authentication
@dataclass(frozen=True)
class ServicePrincipal:
    """A trusted machine client (the web proxy, the mobile app) presenting an API key."""

    name: str = "service"


@dataclass(frozen=True)
class UserPrincipal:
    claims: security.AccessClaims

    @property
    def role(self) -> str:
        return self.claims.role


Principal = ServicePrincipal | UserPrincipal


def _valid_api_key(settings: Settings, presented: str | None) -> bool:
    return bool(presented) and any(hmac.compare_digest(presented, k) for k in settings.api_keys)


def require_principal(
    settings: SettingsDep,
    api_key: Annotated[str | None, Depends(api_key_header)] = None,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> Principal:
    """Forecast data is available to a signed-in person or to a trusted service.

    No database round trip: the JWT is self-contained and short lived.
    """
    if credentials is not None:
        try:
            return UserPrincipal(security.decode_access_token(settings, credentials.credentials))
        except security.TokenError as exc:
            raise UnauthorizedError("Your session has expired. Please sign in again.") from exc
    if _valid_api_key(settings, api_key):
        return ServicePrincipal()
    if not settings.service_auth_enabled:
        # Local development with no credentials configured at all.
        return ServicePrincipal(name="anonymous")
    raise UnauthorizedError("Authentication is required.")


async def get_current_user(
    session: SessionDep,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> User:
    if credentials is None:
        raise UnauthorizedError("Sign in to continue.")
    try:
        claims = security.decode_access_token(settings, credentials.credentials)
    except security.TokenError as exc:
        raise UnauthorizedError("Your session has expired. Please sign in again.") from exc
    user = await AuthService(session, settings).get_by_id(claims.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("This account is no longer available.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Guard an endpoint with a role allow-list."""
    allowed = set(roles)

    async def _guard(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise ForbiddenError("Your account does not have access to this area.")
        return user

    return _guard


require_farmer = require_roles(UserRole.FARMER)
require_staff = require_roles(UserRole.AGENT, UserRole.MINISTER, UserRole.ADMIN)
require_admin = require_roles(UserRole.ADMIN)

FarmerUser = Annotated[User, Depends(require_farmer)]
StaffUser = Annotated[User, Depends(require_staff)]


# ------------------------------------------------------------------ request-scoped services
def get_auth_service(session: SessionDep, settings: SettingsDep) -> AuthService:
    return AuthService(session, settings)


def get_farm_service(
    session: SessionDep,
    grid: Annotated[GridSpec, Depends(get_grid)],
    inference: Annotated[InferenceService, Depends(get_inference)],
) -> FarmService:
    return FarmService(session, grid, inference)


def get_dashboard_service(
    session: SessionDep,
    grid: Annotated[GridSpec, Depends(get_grid)],
    inference: Annotated[InferenceService, Depends(get_inference)],
    farms: Annotated[FarmService, Depends(get_farm_service)],
    advisory: Annotated[AdvisoryService, Depends(get_advisory)],
    enso: Annotated[EnsoService, Depends(get_enso)],
) -> DashboardService:
    return DashboardService(session, grid, inference, farms, advisory, enso)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
FarmServiceDep = Annotated[FarmService, Depends(get_farm_service)]
DashboardServiceDep = Annotated[DashboardService, Depends(get_dashboard_service)]
