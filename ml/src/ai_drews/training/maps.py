"""Step 5: spatial drought-risk maps for the latest month."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ai_drews.config import DEFAULT_CONFIG, DataPaths, PipelineConfig
from ai_drews.inference import load_artifacts, predict_risk

log = logging.getLogger(__name__)


def render_risk_maps(paths: DataPaths, cfg: PipelineConfig = DEFAULT_CONFIG, plot: bool = True) -> np.ndarray:
    art = load_artifacts(paths)
    P = predict_risk(art)
    issue = pd.to_datetime(art.issued_date)
    paths.ensure()
    np.savez(paths.latest_risk_npz, probs=P, issued=str(issue.date()), model_version=art.model_version)
    if plot:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(1, cfg.drought_leads, figsize=(4 * cfg.drought_leads, 3.6))
        bbox = cfg.bbox
        for lead, a in enumerate(np.atleast_1d(ax)):
            im = a.imshow(P[lead], vmin=0, vmax=1, cmap="YlOrRd", extent=(bbox[0], bbox[2], bbox[1], bbox[3]))
            a.set_title(f"{(issue + pd.DateOffset(months=lead + 1)).strftime('%b %Y')} (lead {lead + 1})")
        fig.colorbar(im, ax=ax, label="P(SPI-3 <= -1)")
        plt.savefig(paths.outputs / "risk_maps.png", dpi=130, bbox_inches="tight")
        plt.close(fig)
    log.info("issued %s | basin-mean probability by lead: %s", issue.date(), P.mean((1, 2)).round(2))
    return P
