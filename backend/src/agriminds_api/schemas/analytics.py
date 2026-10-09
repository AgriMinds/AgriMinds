from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EmbedConfig(BaseModel):
    """Everything the browser needs to render the dashboard, and nothing more.

    The embedding secret stays on the server; what goes out is a signed URL valid for minutes,
    scoped to one dashboard and — where a locked parameter is configured — to one viewer's
    district. The scope is inside the signature, so it cannot be edited client-side.
    """

    dashboard_id: int
    embed_url: str = Field(description="Signed, short-lived; safe to put in an iframe")
    expires_at: datetime
    scope: str = Field(description="Which rows this URL may read, in plain words")
    scoped: bool = Field(description="True when a locked parameter narrows the viewer's rows")


class MetabaseStatus(BaseModel):
    configured: bool
    reason: str | None = Field(None, description="Why embedding is unavailable, when it is")
    site_url: str | None = Field(None, description="Where a browser reaches Metabase")
    dashboard_id: int | None = None
    woreda_param: str | None = Field(
        None, description="Locked parameter used to scope an agent to their woreda, if any"
    )


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
