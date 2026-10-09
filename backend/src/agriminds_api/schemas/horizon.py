"""How far ahead the platform will commit, and what it will say at each distance."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

HorizonKind = Literal["forecast", "outlook"]
OutlookDirection = Literal["drier", "near normal", "wetter"]
OutlookConfidence = Literal["low", "moderate"]


class LeadSkill(BaseModel):
    """What this lead was measured to be worth on held-out data."""

    auc: float | None = Field(None, description="Ranking skill; 0.5 is a coin flip")
    auc_persistence: float | None = Field(None, description="The same for the naive baseline")
    brier: float | None = None
    bss_vs_climatology: float | None = Field(
        None,
        description=(
            "Brier Skill Score against climatology. Positive means the probabilities are better "
            "calibrated than quoting the long-run average; this is what decides publication."
        ),
    )
    pod: float | None = Field(None, description="Probability of detection at the chosen threshold")
    far: float | None = Field(None, description="False alarm ratio at the chosen threshold")


class LeadHorizon(BaseModel):
    """One month of the horizon."""

    lead_month: int
    target_month: str = Field(description="The month being described, YYYY-MM-DD")
    kind: HorizonKind = Field(
        description=(
            "'forecast' carries a probability measured to beat climatology. 'outlook' carries a "
            "direction only, because at this distance a probability would not be supported."
        )
    )
    skill: LeadSkill

    # Present only when kind == 'forecast'.
    probability: float | None = Field(None, description="Basin-mean drought probability")
    max_probability: float | None = None
    cells_at_risk: int | None = None

    # Present only when kind == 'outlook'.
    direction: OutlookDirection | None = None
    confidence: OutlookConfidence | None = None
    basis: str | None = Field(None, description="Why the season leans this way, in plain words")

    enso_anomaly: float | None = Field(None, description="Niño 3.4 expected for this month")
    enso_category: str | None = None


class HorizonResponse(BaseModel):
    """The full horizon: what can be forecast, what can only be leaned on, and why.

    The split is the point. A forecast says how likely drought is and is published only where
    that was measured to beat climatology. An outlook says which way the season leans and never
    carries a number. Serving the second as the first is the failure this endpoint prevents.
    """

    issued_date: str
    trained_leads: int = Field(description="How many leads the model was trained for")
    skilful_leads: list[int] = Field(description="Those that earned a probability")
    min_skilful_bss: float = Field(description="The margin a lead must clear to be published")
    teleconnection_r: float | None = Field(
        None, description="ENSO vs the drought index, measured on the loaded record"
    )
    leads: list[LeadHorizon]
    note: str
