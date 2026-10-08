"""The analytics layer: Power BI embedding for staff, and a direct SQL connection for analysts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text

from agriminds_api.api.deps import SessionDep, SettingsDep, StaffUser, get_powerbi, require_admin
from agriminds_api.db.models import User
from agriminds_api.schemas.analytics import AnalyticsConnection, EmbedConfig, PowerBiStatus
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.services.powerbi import PowerBiService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

BI_ROLE = "agriminds_bi"

#: Names that only resolve inside the deployment's own network.
_INTERNAL_HOSTS = ("postgres", "localhost", "127.0.0.1", "db", "database")


def _connection_target(settings) -> tuple[str, str, bool]:
    """(server, database, reachable_from_outside).

    Inside Compose the API knows the database as `postgres:5432`, which an analyst running
    Power BI Desktop on their own laptop cannot resolve. When an operator has set a public
    address we hand that out instead, and otherwise we say plainly that the name is internal
    rather than issuing a connection file that silently fails.
    """
    url = settings.database_url.rsplit("@", 1)[-1]  # drop any embedded credentials
    internal_server, _, database = url.partition("/")
    database = database.split("?")[0]
    if settings.analytics_public_host:
        return settings.analytics_public_host, database, True
    hostname = internal_server.split(":")[0]
    return internal_server, database, hostname not in _INTERNAL_HOSTS


@router.get(
    "/powerbi/status",
    response_model=PowerBiStatus,
    summary="Whether Power BI embedding is configured on this deployment",
    description=(
        "Lets the client show the analytics tab only when it will work, instead of rendering a "
        "broken frame. Never returns any credential."
    ),
)
def powerbi_status(user: StaffUser, service: PowerBiService = Depends(get_powerbi)) -> PowerBiStatus:
    return service.status()


@router.get(
    "/powerbi/embed-token",
    response_model=EmbedConfig,
    responses={
        502: {"model": ErrorResponse, "description": "Power BI did not respond"},
        503: {"model": ErrorResponse, "description": "Embedding is not configured"},
    },
    summary="Short-lived token for rendering the report in the browser",
    description=(
        "Issued per viewer. Where the dataset defines row-level security, a development agent's "
        "token is scoped to their own woreda by Power BI, not by the client."
    ),
)
async def powerbi_embed_token(user: StaffUser, service: PowerBiService = Depends(get_powerbi)) -> EmbedConfig:
    return await service.embed_config(user)


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
            "Connect Power BI Desktop with Get Data > PostgreSQL, using the "
            f"'{BI_ROLE}' role. That role can read the analytics views and nothing else: it "
            "cannot see accounts, passwords or contact details. Import mode is recommended for "
            "a watershed of this size; DirectQuery keeps the figures live."
            + (
                ""
                if reachable
                else f" Note: '{server}' is this deployment's internal name and will not resolve "
                "from your machine. Ask an administrator to set AGRIMINDS_ANALYTICS_PUBLIC_HOST "
                "to the address the database answers on."
            )
        ),
    )


@router.get(
    "/connection.pbids",
    dependencies=[Depends(require_admin)],
    summary="Power BI Desktop connection file (administrators)",
    description="Opens Power BI Desktop straight onto the analytics schema. Contains no credentials.",
    response_class=Response,
    responses={200: {"content": {"application/json": {}}, "description": "A .pbids file"}},
)
async def analytics_pbids(settings: SettingsDep, _: User = Depends(require_admin)) -> Response:
    server, database, _reachable = _connection_target(settings)
    payload = {
        "version": "0.1",
        "connections": [
            {
                "details": {
                    "protocol": "postgresql",
                    "address": {"server": server, "database": database.split("?")[0]},
                },
                "options": {},
                "mode": "DirectQuery",
            }
        ],
    }
    import json

    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="agriminds-analytics.pbids"'},
    )
