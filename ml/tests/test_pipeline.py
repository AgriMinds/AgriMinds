"""End-to-end smoke test of the pipeline on a tiny synthetic dataset (a few seconds on CPU)."""

import json

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
    # Every candidate is scored, and "Selected" is the per-lead winner actually published.
    assert set(enso_metrics["model"]) == {"CNN-LSTM", "Persistence", "Ridge", "Selected"}
    assert paths.enso_forecast_csv.exists()

    # The published lead must be traceable to the estimator that produced it.
    meta = json.loads((paths.models / "enso_meta.json").read_text())
    assert set(meta["selected_per_lead"]) == {str(i + 1) for i in range(test_cfg.enso_leads)}
    assert set(meta["selected_per_lead"].values()) <= {"CNN-LSTM", "Persistence", "Ridge"}
    # Selection happens on validation, so it may lose on test, but never by a wide margin:
    # a published lead that is far worse than persistence means the gate is wired up wrong.
    chosen = enso_metrics[enso_metrics.model == "Selected"].set_index("lead")["RMSE"]
    naive = enso_metrics[enso_metrics.model == "Persistence"].set_index("lead")["RMSE"]
    assert (chosen <= naive * 1.5 + 1e-9).all()

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


def test_pipeline_runs_without_a_vegetation_index(paths, test_cfg):
    """No source the study names supplies NDVI, and MODIS takes hours, so the pipeline must
    train on what it has rather than refuse to start."""
    from ai_drews.data.io import load_raw, save_raw

    build_dataset(paths, test_cfg)
    ind, grids = load_raw(paths)
    assert "ndvi" in grids
    save_raw(paths, ind, {k: v for k, v in grids.items() if k != "ndvi"})

    feats = build_features(paths, test_cfg)
    assert feats["train"] > 0

    fields = np.load(paths.fields_npz, allow_pickle=True)
    sp = [str(c) for c in fields["sp_channels"]]
    tm = [str(c) for c in fields["tm_channels"]]
    assert "ndvi" not in sp and "vci" not in sp
    assert "ndvi" not in tm and "vci" not in tm
    assert "vci" not in fields.files, "VCI must be absent, not zero-filled"
    # The cubes must match the channel names they are stored with.
    assert fields["S"].shape[1] == len(sp)
    assert fields["TF"].shape[1] == len(tm)

    train_enso(paths, test_cfg, plot=False)
    metrics = train_drought(paths, test_cfg, data_source="synthetic")
    assert len(metrics) == test_cfg.drought_leads

    art = load_artifacts(paths, test_cfg)
    risk = predict_risk(art)
    assert risk.shape == (test_cfg.drought_leads, *test_cfg.grid)
    assert np.all((risk >= 0) & (risk <= 1))
