"""Power BI embedding, "app owns data".

One service principal holds the workspace licence; the server exchanges its client credentials
for an Entra ID token, then asks Power BI for a short-lived *embed* token scoped to one report.
Only that embed token reaches the browser. The client secret never leaves the server, and no
viewer needs a Power BI licence of their own.

Row-level security: when the dataset defines a role, the embed token carries an effective
identity so a development agent sees only their own woreda. That restriction is applied by Power
BI from a server-issued token, so it cannot be lifted by editing anything client-side.
"""

from __future__ import annotations

import logging
import threading
from datetime import UTC, datetime, timedelta

import httpx

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import AppError
from agriminds_api.db.models import User, UserRole
from agriminds_api.schemas.analytics import EmbedConfig, PowerBiStatus

log = logging.getLogger(__name__)

_HTTP_TIMEOUT = 15.0


class PowerBiNotConfiguredError(AppError):
    """Power BI embedding is not set up on this deployment."""

    status_code = 503
    code = "powerbi_not_configured"


class PowerBiUpstreamError(AppError):
    """Power BI did not return a report. The analytics tab is unavailable."""

    status_code = 502
    code = "powerbi_unavailable"


class PowerBiService:
    """Mints embed tokens. One instance per application, safe to share across requests."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._aad_token: str | None = None
        self._aad_expires_at = datetime.min.replace(tzinfo=UTC)

    # ------------------------------------------------------------------ status
    def status(self) -> PowerBiStatus:
        s = self._settings
        if s.powerbi_configured:
            return PowerBiStatus(
                configured=True,
                workspace_id=s.powerbi_workspace_id,
                report_id=s.powerbi_report_id,
                rls_role=s.powerbi_rls_role,
            )
        missing = [
            name
            for name, value in (
                ("AGRIMINDS_POWERBI_TENANT_ID", s.powerbi_tenant_id),
                ("AGRIMINDS_POWERBI_CLIENT_ID", s.powerbi_client_id),
                ("AGRIMINDS_POWERBI_CLIENT_SECRET", s.powerbi_client_secret),
                ("AGRIMINDS_POWERBI_WORKSPACE_ID", s.powerbi_workspace_id),
                ("AGRIMINDS_POWERBI_REPORT_ID", s.powerbi_report_id),
            )
            if not value
        ]
        return PowerBiStatus(configured=False, reason=f"not set: {', '.join(missing)}")

    # ------------------------------------------------------------------ Entra ID
    def _acquire_aad_token(self) -> str:
        """Client-credentials token, cached until shortly before it expires."""
        now = datetime.now(UTC)
        with self._lock:
            if self._aad_token and now < self._aad_expires_at:
                return self._aad_token

            import msal

            s = self._settings
            app = msal.ConfidentialClientApplication(
                client_id=s.powerbi_client_id,
                client_credential=s.powerbi_client_secret.get_secret_value(),
                authority=f"{s.powerbi_authority}/{s.powerbi_tenant_id}",
            )
            result = app.acquire_token_for_client(scopes=[s.powerbi_scope])
            if "access_token" not in result:
                # Never log the description verbatim: it can echo tenant configuration.
                log.error("Entra ID rejected the service principal: %s", result.get("error"))
                raise PowerBiUpstreamError(
                    "Could not authenticate to Power BI. Check the service principal configuration."
                )
            self._aad_token = result["access_token"]
            self._aad_expires_at = now + timedelta(seconds=int(result.get("expires_in", 3600)) - 300)
            return self._aad_token

    # ------------------------------------------------------------------ embedding
    def _identity(self, user: User) -> tuple[list[dict] | None, str, bool]:
        """Row-level security identity for this viewer, if the dataset enforces one."""
        s = self._settings
        if not s.powerbi_rls_role or not s.powerbi_dataset_id:
            return None, "Whole watershed", False
        if user.role is UserRole.AGENT and user.woreda is not None:
            # The filter value must match what the dataset's RLS expression compares against.
            return (
                [
                    {
                        "username": str(user.id),
                        "roles": [s.powerbi_rls_role],
                        "datasets": [s.powerbi_dataset_id],
                        "customData": user.woreda.code,
                    }
                ],
                f"{user.woreda.name_en} woreda only",
                True,
            )
        return (
            [{"username": str(user.id), "roles": [s.powerbi_rls_role], "datasets": [s.powerbi_dataset_id]}],
            "Whole watershed",
            True,
        )

    async def embed_config(self, user: User) -> EmbedConfig:
        s = self._settings
        if not s.powerbi_configured:
            raise PowerBiNotConfiguredError(self.status().reason)

        from starlette.concurrency import run_in_threadpool

        token = await run_in_threadpool(self._acquire_aad_token)
        headers = {"Authorization": f"Bearer {token}"}
        base = f"{s.powerbi_api_base}/groups/{s.powerbi_workspace_id}/reports/{s.powerbi_report_id}"

        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            report = await client.get(base, headers=headers)
            if report.status_code != 200:
                log.error("Power BI report lookup failed: HTTP %s", report.status_code)
                raise PowerBiUpstreamError("The configured Power BI report could not be read.")
            embed_url = report.json()["embedUrl"]

            identities, scope, rls_applied = self._identity(user)
            body: dict = {"accessLevel": "View"}
            if identities:
                body["identities"] = identities

            minted = await client.post(f"{base}/GenerateToken", headers=headers, json=body)
            if minted.status_code not in (200, 201):
                log.error("Power BI token generation failed: HTTP %s", minted.status_code)
                raise PowerBiUpstreamError("Power BI refused to issue a viewing token.")
            payload = minted.json()

        expires = payload.get("expiration")
        expires_at = (
            datetime.fromisoformat(expires.replace("Z", "+00:00"))
            if expires
            else datetime.now(UTC) + timedelta(minutes=s.powerbi_token_minutes)
        )
        log.info("issued Power BI embed token for user=%s scope=%s", user.id, scope)
        return EmbedConfig(
            report_id=s.powerbi_report_id,
            embed_url=embed_url,
            access_token=payload["token"],
            expires_at=expires_at,
            scope=scope,
            rls_applied=rls_applied,
        )
