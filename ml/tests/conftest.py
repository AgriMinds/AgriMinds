import numpy as np
import pandas as pd
import pytest

from ai_drews.config import DataPaths, PipelineConfig
from ai_drews.data.synthetic import make_synthetic

# Small, fast configuration for unit tests: 18 years of monthly data on a 4x4 grid (SPI needs >=10 samples per calendar month).
TEST_CFG = PipelineConfig(
    start="1994-01-01",
    end="2011-12-01",
    grid=(4, 4),
    train_end="2007-12-01",
    val_end="2009-12-01",
    epochs=2,
    patience=1,
)


@pytest.fixture(scope="session")
def test_cfg() -> PipelineConfig:
    return TEST_CFG


@pytest.fixture(scope="session")
def synthetic():
    return make_synthetic(TEST_CFG)


@pytest.fixture
def paths(tmp_path) -> DataPaths:
    return DataPaths(tmp_path / "data").ensure()


@pytest.fixture
def months():
    return pd.date_range(TEST_CFG.start, TEST_CFG.end, freq="MS").month.values


@pytest.fixture
def rng():
    return np.random.default_rng(0)
