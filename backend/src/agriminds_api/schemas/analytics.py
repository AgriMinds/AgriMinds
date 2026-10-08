from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EmbedConfig(BaseModel):
    """Everything the browser needs to render a Power BI report, and nothing more.

    The client secret stays on the server; what goes out is a short-lived token scoped to one
    report and, where row-level security is configured, to one viewer's district.
    """

    report_id: str
    embed_url: str
    access_token: str = Field(description="Short-lived embed token, not an AAD token")
    expires_at: datetime
    scope: str = Field(description="Which rows this token may read, in plain words")
    rls_applied: bool


class PowerBiStatus(BaseModel):
    configured: bool
    reason: str | None = Field(None, description="Why embedding is unavailable, when it is")
    workspace_id: str | None = None
    report_id: str | None = None
    rls_role: str | None = None


class AnalyticsConnection(BaseModel):
    """A direct SQL connection for analysts who build their own reports."""

    protocol: Literal["postgresql"] = "postgresql"
    server: str
    database: str
    schema_name: str = Field("analytics", alias="schema")
    read_only_role: str
    views: list[str]
    note: str

    model_config = {"populate_by_name": True}
