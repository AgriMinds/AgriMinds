from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SourceStatus = Literal["connected", "synthetic", "not_connected"]


class DataSource(BaseModel):
    """One input the platform depends on, and whether it is actually wired up."""

    key: str
    name: str
    provider: str
    feeds: str = Field(description="What this input is used for")
    status: SourceStatus = Field(
        description=(
            "connected: real observations in use. synthetic: a stand-in is filling this slot. "
            "not_connected: nothing is supplying it yet."
        )
    )
    detail: str


class DataInventory(BaseModel):
    """What the current forecast is actually built from.

    Reported from what is on disk and in the model metadata, never from a fixed list, so the
    page cannot claim a source is connected after it has been removed.
    """

    model_version: str | None
    data_source: str | None = Field(description="'real' or 'synthetic', from the trained model")
    issued_date: str | None
    sources: list[DataSource]
    connected: int
    total: int
    caveat: str | None = Field(None, description="Set whenever the forecast is not from real data")
