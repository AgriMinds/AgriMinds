import numpy as np

from ai_drews.features import compute_fields, make_inputs, make_labels, spi, split_idx, vci, zanom
from ai_drews.features.windows import FOURIER_BASE_FEATURES, apply_norm, fit_norm


def test_spi_is_standardised_and_has_leading_nans(synthetic, months, test_cfg):
    _, g = synthetic
    out = spi(g["rain"], months, test_cfg.spi_scale)
    assert out.shape == g["rain"].shape
    assert np.isnan(out[: test_cfg.spi_scale - 1]).all()
    finite = out[np.isfinite(out)]
    assert abs(finite.mean()) < 0.3
    assert 0.6 < finite.std() < 1.4


def test_vci_bounded_0_100(synthetic, months):
    _, g = synthetic
    v = vci(g["ndvi"], months)
    assert v.min() >= 0 and v.max() <= 100 + 1e-6


def test_zanom_zero_mean_per_month(synthetic, months):
    _, g = synthetic
    z = zanom(g["rain"], months)
    for m in range(1, 13):
        assert abs(z[months == m].mean()) < 1e-6


def test_fields_and_sample_shapes(synthetic, test_cfg):
    ind, g = synthetic
    F = compute_fields(ind, g, test_cfg)
    T = len(F["dates"])
    H, W = test_cfg.grid
    assert F["S"].shape == (T, 5, H, W)
    assert F["TF"].shape == (T, 7)
    tr, va, te = split_idx(F, test_cfg.drought_leads, test_cfg)
    assert len(tr) and len(va) and len(te)
    assert tr.max() < va.min() < te.min(), "splits must be chronological"
    fc = np.zeros((T, test_cfg.drought_leads), "float32")
    Xs, Xt, Xp = make_inputs(F, tr, fc, test_cfg)
    assert Xs.shape == (len(tr), 5, H, W)
    assert Xt.shape == (len(tr), test_cfg.window, 7)
    # The point vector carries the ENSO forecast, so its width follows the horizon rather than
    # being a constant. Pinning the number here is what broke when the horizon went 3 -> 12.
    assert Xp.shape == (len(tr), FOURIER_BASE_FEATURES + test_cfg.drought_leads)
    Y = make_labels(F, tr, test_cfg)
    assert Y.shape == (len(tr), test_cfg.drought_leads, H, W)
    assert set(np.unique(Y)) <= {0.0, 1.0}


def test_normalisation_roundtrip(synthetic, test_cfg):
    ind, g = synthetic
    F = compute_fields(ind, g, test_cfg)
    tr, _, _ = split_idx(F, test_cfg.drought_leads, test_cfg)
    fc = np.zeros((len(F["dates"]), 3), "float32")
    raw = make_inputs(F, tr, fc, test_cfg)
    n = fit_norm(*raw)
    Xs, Xt, Xp = apply_norm(n, *raw)
    assert abs(Xs.mean()) < 1e-3 and abs(Xt.mean()) < 1e-3 and abs(Xp.mean()) < 1e-3
