"""Metabase embedding, signed server-side.

Metabase is self-hosted and open source, so a ministry pays nothing per seat and staff need no
account of their own to read the dashboard. Embedding works by signing a short-lived JWT for one
dashboard with the instance's embedding secret: the signature is what authorises the view, so the
secret must never reach the browser and the URL must be minted per request.

Scoping: a *locked* dashboard parameter is the equivalent of row-level security. When one is
configured, a development agent's signed URL carries their own woreda code inside the signature.
Metabase refuses to let a locked parameter be overridden from the query string, so the
restriction cannot be lifted by editing the URL.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import jwt

from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import AppError
from agriminds_api.db.models import User, UserRole
from agriminds_api.schemas.analytics import EmbedConfig, MetabaseStatus

log = logging.getLogger(__name__)

#: Appended to the embed URL. Metabase reads these from the fragment, so they never reach a
#: server log, and they only affect chrome — not which rows are returned.
_DISPLAY_OPTIONS = "#bordered=false&titled=false"


class MetabaseNotConfiguredError(AppError):
    """Metabase embedding is not set up on this deployment."""

    status_code = 503
    code = "metabase_not_configured"


class MetabaseService:
    """Signs embed URLs. Holds no connection to Metabase: signing is purely local."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def status(self) -> MetabaseStatus:
        s = self._settings
        if s.metabase_configured:
            return MetabaseStatus(
                configured=True,
                site_url=s.metabase_browser_url,
                dashboard_id=s.metabase_dashboard_id,
                woreda_param=s.metabase_woreda_param,
            )
        missing = [
            name
            for name, value in (
                ("AGRIMINDS_METABASE_SITE_URL", s.metabase_site_url),
                ("AGRIMINDS_METABASE_SECRET_KEY", s.metabase_secret_key),
                ("AGRIMINDS_METABASE_DASHBOARD_ID", s.metabase_dashboard_id),
            )
            if not value
        ]
        return MetabaseStatus(
            configured=False,
            reason=f"Not configured: {', '.join(missing)} {'is' if len(missing) == 1 else 'are'} unset.",
            site_url=s.metabase_browser_url,
            dashboard_id=s.metabase_dashboard_id,
            woreda_param=s.metabase_woreda_param,
        )

    def embed_config(self, user: User) -> EmbedConfig:
        s = self._settings
        if not s.metabase_configured or s.metabase_secret_key is None:
            raise MetabaseNotConfiguredError(self.status().reason or "Metabase is not configured.")

        params, scope, scoped = self._params(user)
        expires_at = datetime.now(UTC) + timedelta(minutes=s.metabase_token_minutes)
        token = jwt.encode(
            {
                "resource": {"dashboard": s.metabase_dashboard_id},
                # Locked parameters live inside the signature. An empty mapping still has to be
                # present: Metabase treats a missing `params` as "no locked parameters set".
                "params": params,
                "exp": int(expires_at.timestamp()),
            },
            s.metabase_secret_key.get_secret_value(),
            algorithm="HS256",
        )

        base = (s.metabase_browser_url or "").rstrip("/")
        log.info("signed Metabase embed URL for user=%s scope=%s", user.id, scope)
        return EmbedConfig(
            dashboard_id=int(s.metabase_dashboard_id or 0),
            embed_url=f"{base}/embed/dashboard/{quote(token)}{_DISPLAY_OPTIONS}",
            expires_at=expires_at,
            scope=scope,
            scoped=scoped,
        )

    # ------------------------------------------------------------------ helpers
    def _params(self, user: User) -> tuple[dict[str, str], str, bool]:
        """Locked parameters for this viewer, and what they mean in plain words."""
        s = self._settings
        if s.metabase_woreda_param and user.role is UserRole.AGENT and user.woreda is not None:
            return (
                {s.metabase_woreda_param: user.woreda.code},
                f"{user.woreda.name_en} woreda only",
                True,
            )
        return {}, "the whole watershed", False
