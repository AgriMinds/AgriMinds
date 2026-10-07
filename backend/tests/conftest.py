"""Builds a tiny set of real artifacts once per session (synthetic data, 2 epochs) so integration tests
exercise the true inference path without depending on the committed weights or a running server."""

from __future__ import annotations

import pytest
from ai_drews.config import DataPaths, PipelineConfig
from ai_drews.data.io import build_dataset
from ai_drews.features.fields import build_features
from ai_drews.training.drought import train_drought
from ai_drews.training.enso import train_enso
from ai_drews.training.maps import render_risk_maps
from fastapi.testclient import TestClient

from agriminds_api.core.config import Settings
from agriminds_api.main import create_app

TEST_CFG = PipelineConfig(
    start="1994-01-01",
    end="2011-12-01",
    grid=(8, 8),
    train_end="2007-12-01",
    val_end="2009-12-01",
    epochs=2,
    patience=1,
)


@pytest.fixture(scope="session")
def artifacts_dir(tmp_path_factory) -> DataPaths:
    paths = DataPaths(tmp_path_factory.mktemp("data")).ensure()
    build_dataset(paths, TEST_CFG)
    build_features(paths, TEST_CFG)
    train_enso(paths, TEST_CFG, plot=False)
    train_drought(paths, TEST_CFG, data_source="synthetic")
    render_risk_maps(paths, TEST_CFG, plot=False)
    return paths


def _settings(data_dir, **overrides) -> Settings:
    base = dict(env="test", data_dir=data_dir, redis_url=None, api_keys=[], _env_file=None)
    base.update(overrides)
    return Settings(**base)


@pytest.fixture(scope="session")
def client(artifacts_dir) -> TestClient:
    with TestClient(create_app(_settings(artifacts_dir.root))) as c:
        yield c


@pytest.fixture
def auth_client(artifacts_dir) -> TestClient:
    with TestClient(create_app(_settings(artifacts_dir.root, api_keys=["secret-key"]))) as c:
        yield c


@pytest.fixture
def empty_client(tmp_path) -> TestClient:
    """No weights, no precomputed raster -> model unavailable."""
    with TestClient(create_app(_settings(tmp_path / "nothing"))) as c:
        yield c


@pytest.fixture
def precomputed_client(artifacts_dir, tmp_path) -> TestClient:
    """Only outputs/latest_risk.npz present -> degraded mode."""
    paths = DataPaths(tmp_path / "pre").ensure()
    (paths.outputs / "latest_risk.npz").write_bytes(artifacts_dir.latest_risk_npz.read_bytes())
    with TestClient(create_app(_settings(paths.root))) as c:
        yield c
