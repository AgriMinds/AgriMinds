"""End-to-end smoke test of the pipeline on a tiny synthetic dataset (a few seconds on CPU)."""

import numpy as np
import torch

from ai_drews.data.io import build_dataset
from ai_drews.features.fields import build_features
from ai_drews.inference import load_artifacts, predict_risk
from ai_drews.models import CNNLSTM, SuperHybrid
from ai_drews.training.drought import train_drought
from ai_drews.training.enso import train_enso
from ai_drews.training.maps import render_risk_maps


def test_model_output_shapes():
    m = SuperHybrid(5, 7, 17, 3)
    out = m(torch.zeros(2, 5, 8, 8), torch.zeros(2, 12, 7), torch.zeros(2, 17))
    assert out.shape == (2, 3, 8, 8)
    e = CNNLSTM(4, 6)
    assert e(torch.zeros(2, 12, 4)).shape == (2, 6)


def test_full_pipeline_smoke(paths, test_cfg):
    summary = build_dataset(paths, test_cfg)
    assert summary["source"] == "synthetic"
    assert paths.has_raw_data()

    feats = build_features(paths, test_cfg)
    assert feats["train"] > 0

    enso_metrics = train_enso(paths, test_cfg, plot=False)
    assert set(enso_metrics["model"]) == {"CNN-LSTM", "Persistence", "Ridge"}
    assert paths.enso_forecast_csv.exists()

    drought_metrics = train_drought(paths, test_cfg, data_source="synthetic")
    assert len(drought_metrics) == test_cfg.drought_leads
    assert paths.has_drought_artifacts()

    art = load_artifacts(paths, test_cfg)
    assert art.data_source == "synthetic"
    assert art.model_version.startswith("superhybrid-")
    P = predict_risk(art)
    assert P.shape == (test_cfg.drought_leads, *test_cfg.grid)
    assert np.all((P >= 0) & (P <= 1))

    P2 = render_risk_maps(paths, test_cfg, plot=False)
    np.testing.assert_allclose(P, P2)
    assert paths.latest_risk_npz.exists()
