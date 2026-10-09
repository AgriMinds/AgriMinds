"""Artifact loading and inference shared by the API, the maps step and the research dashboard."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import torch

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.features.fields import load_enso_fc, load_fields
from ai_drews.features.windows import apply_norm, make_inputs
from ai_drews.models import CNNLSTM, SuperHybrid


class ArtifactsMissingError(FileNotFoundError):
    """Raised when trained weights or processed fields are not present on disk."""


@dataclass
class Artifacts:
    fields: dict[str, np.ndarray]
    enso_fc: np.ndarray  # (T, drought_leads) Nino3.4 forecasts aligned to fields
    model: SuperHybrid
    norm: dict[str, np.ndarray]
    meta: dict[str, Any]
    cfg: PipelineConfig = field(default=DEFAULT_CONFIG)

    @property
    def dates(self) -> list[str]:
        return [str(d) for d in self.fields["dates"]]

    @property
    def issued_date(self) -> str:
        """Last month of data the forecast is issued from (YYYY-MM-DD)."""
        return self.dates[-1]

    @property
    def model_version(self) -> str:
        return str(self.meta.get("model_version", "unversioned"))

    @property
    def trained_at(self) -> str:
        """When these weights were fitted.

        The version and the issue month both stay the same across a retrain, so this is the only
        thing that distinguishes one set of weights from the next. Anything caching a prediction
        has to key on it or it will serve the old model indefinitely.
        """
        return str(self.meta.get("trained_at", "unknown"))

    @property
    def data_source(self) -> str:
        return str(self.meta.get("data_source", "unknown"))

    @property
    def nino_history(self) -> np.ndarray:
        return np.asarray(self.fields["nino"], dtype="float64")

    @property
    def has_pdsi(self) -> bool:
        """Sc-PDSI is only present when the raw record carried mean temperature."""
        return "pdsi" in self.fields

    def latest_pdsi(self) -> np.ndarray | None:
        """Observed Sc-PDSI for the issue month, shaped (rows, cols).

        This is a measured condition, not a forecast: it says how dry the ground is now,
        while the model output says how likely drought is next season.
        """
        if not self.has_pdsi:
            return None
        return np.asarray(self.fields["pdsi"][-1], dtype="float64")

    def latest_enso_forecast(self) -> np.ndarray | None:
        """Nino3.4 forecast for the leads following the issue month, or None if ENSO was not trained."""
        if self.enso_fc.size == 0 or not self.enso_fc.any():
            return None
        return self.enso_fc[-1]


def load_artifacts(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG) -> Artifacts:
    if not paths.has_drought_artifacts():
        missing = [
            str(p)
            for p in (
                paths.drought_model_pt,
                paths.drought_norm_npz,
                paths.drought_meta_json,
                paths.fields_npz,
            )
            if not p.exists()
        ]
        raise ArtifactsMissingError(f"missing artifacts: {missing}")
    F = load_fields(paths)
    meta = json.loads(paths.drought_meta_json.read_text())
    model = SuperHybrid(meta["c_sp"], meta["f_t"], meta["f_p"], meta["n_leads"])
    model.load_state_dict(torch.load(paths.drought_model_pt, map_location="cpu", weights_only=True))
    model.eval()
    z = np.load(paths.drought_norm_npz)
    norm = {k: z[k] for k in z.files}
    fc = load_enso_fc(paths, len(F["dates"]), meta["n_leads"])
    return Artifacts(fields=F, enso_fc=fc, model=model, norm=norm, meta=meta, cfg=cfg)


@torch.no_grad()
def predict_risk(art: Artifacts, t: int | None = None) -> np.ndarray:
    """Drought probability maps (L, H, W) issued at month index t (default: latest month)."""
    F = art.fields
    t = len(F["dates"]) - 1 if t is None else t
    xs, xt, xp = apply_norm(art.norm, *make_inputs(F, [t], art.enso_fc, art.cfg))
    logits = art.model(*[torch.as_tensor(a, dtype=torch.float32) for a in (xs, xt, xp)])
    return torch.sigmoid(logits)[0].cpu().numpy()


def load_enso_model(
    paths: DataPaths, n_feat: int = 4, cfg: PipelineConfig = DEFAULT_CONFIG
) -> tuple[CNNLSTM, dict]:
    if not (paths.enso_model_pt.exists() and paths.enso_norm_npz.exists()):
        raise ArtifactsMissingError(f"missing ENSO artifacts under {paths.models}")
    model = CNNLSTM(n_feat, cfg.enso_leads)
    model.load_state_dict(torch.load(paths.enso_model_pt, map_location="cpu", weights_only=True))
    model.eval()
    z = np.load(paths.enso_norm_npz)
    return model, {k: z[k] for k in z.files}
