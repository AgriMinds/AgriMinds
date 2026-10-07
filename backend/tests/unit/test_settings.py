import pytest

from agriminds_api.core.config import Settings


def test_csv_env_parsing(monkeypatch):
    monkeypatch.setenv("AGRIMINDS_CORS_ORIGINS", "http://a.example, http://b.example")
    monkeypatch.setenv("AGRIMINDS_API_KEYS", "k1,k2")
    s = Settings(_env_file=None)
    assert s.cors_origins == ["http://a.example", "http://b.example"]
    assert s.api_keys == ["k1", "k2"]
    assert s.auth_enabled


def test_wildcard_cors_rejected():
    with pytest.raises(ValueError):
        Settings(cors_origins=["*"], _env_file=None)
