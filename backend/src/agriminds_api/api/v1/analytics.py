"""The analytics layer: an embedded Metabase dashboard for staff, and a direct SQL connection
for analysts who build their own views.

Metabase is self-hosted and open source, so neither the ministry nor any individual viewer needs
a BI licence. The same read-only `analytics` schema serves both routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text

from agriminds_api.api.deps import SessionDep, SettingsDep, StaffUser, get_metabase, require_admin
from agriminds_api.db.models import User
from agriminds_api.schemas.analytics import AnalyticsConnection, EmbedConfig, MetabaseStatus
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.services.metabase import MetabaseService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

BI_ROLE = "agriminds_bi"

#: Names that only resolve inside the deployment's own network.
_INTERNAL_HOSTS = ("postgres", "localhost", "127.0.0.1", "db", "database")


def _connection_target(settings) -> tuple[str, str, bool]:
    """(server, database, reachable_from_outside).

    Inside Compose the API knows the database as `postgres:5432`, which a BI tool running on an
    analyst's own laptop cannot resolve. When an operator has set a public address we hand that
    out instead, and otherwise we say plainly that the name is internal rather than handing over
    details that silently fail.
    """
    url = settings.database_url.rsplit("@", 1)[-1]  # drop any embedded credentials
    internal_server, _, database = url.partition("/")
    database = database.split("?")[0]
    if settings.analytics_public_host:
        return settings.analytics_public_host, database, True
    hostname = internal_server.split(":")[0]
    return internal_server, database, hostname not in _INTERNAL_HOSTS


@router.get(
    "/metabase/status",
    response_model=MetabaseStatus,
    summary="Whether the Metabase dashboard is configured on this deployment",
    description=(
        "Lets the client show the analytics tab only when it will work, instead of rendering a "
        "broken frame. Never returns the embedding secret."
    ),
)
def metabase_status(user: StaffUser, service: MetabaseService = Depends(get_metabase)) -> MetabaseStatus:
    return service.status()


@router.get(
    "/metabase/embed",
    response_model=EmbedConfig,
    responses={503: {"model": ErrorResponse, "description": "Embedding is not configured"}},
    summary="Signed, short-lived URL for rendering the dashboard in the browser",
    description=(
        "Signed per viewer. Where a locked woreda parameter is configured, a development agent's "
        "URL carries their own woreda inside the signature, so the scope cannot be edited "
        "client-side."
    ),
)
def metabase_embed(user: StaffUser, service: MetabaseService = Depends(get_metabase)) -> EmbedConfig:
    return service.embed_config(user)


@router.get(
    "/connection",
    response_model=AnalyticsConnection,
    dependencies=[Depends(require_admin)],
    summary="Direct SQL connection details for building your own reports (administrators)",
    description=(
        "Returns where the read-only `analytics` schema lives and which views it offers. "
        "Credentials are issued separately: this endpoint never returns a password."
    ),
)
async def analytics_connection(
    settings: SettingsDep, session: SessionDep, _: User = Depends(require_admin)
) -> AnalyticsConnection:
    server, database, reachable = _connection_target(settings)
    views = [
        row[0]
        for row in (
            await session.execute(
                text(
                    "SELECT table_name FROM information_schema.views "
                    "WHERE table_schema = 'analytics' ORDER BY table_name"
                )
            )
        ).all()
    ]
    return AnalyticsConnection(
        server=server,
        database=database.split("?")[0],
        read_only_role=BI_ROLE,
        views=views,
        note=(
            f"Point any SQL client or BI tool at this database with the '{BI_ROLE}' role — "
            "Metabase, DBeaver, psql, R, pandas. That role can read the analytics views and "
            "nothing else: it cannot see accounts, passwords or contact details."
            + (
                ""
                if reachable
                else f" Note: '{server}' is this deployment's internal name and will not resolve "
                "from your machine. Ask an administrator to set AGRIMINDS_ANALYTICS_PUBLIC_HOST "
                "to the address the database answers on."
            )
        ),
    )
