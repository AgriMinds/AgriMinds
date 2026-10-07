"""API-key authentication for machine clients (mobile app, Next.js proxy).

Enabled when AGRIMINDS_API_KEYS is non-empty. Keys are compared in constant time.
"""

from __future__ import annotations

import hmac

from fastapi import Depends, Request
from fastapi.security import APIKeyHeader

from agriminds_api.core.config import Settings, get_settings
from agriminds_api.core.exceptions import UnauthorizedError

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(
    request: Request,
    presented: str | None = Depends(api_key_header),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.auth_enabled:
        return
    if presented and any(hmac.compare_digest(presented, k) for k in settings.api_keys):
        return
    raise UnauthorizedError()
