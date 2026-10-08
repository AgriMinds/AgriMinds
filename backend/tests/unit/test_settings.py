import pytest

from agriminds_api.core.config import Settings


def test_csv_env_parsing(monkeypatch):
    monkeypatch.setenv("AGRIMINDS_CORS_ORIGINS", "http://a.example, http://b.example")
    monkeypatch.setenv("AGRIMINDS_API_KEYS", "k1,k2")
    s = Settings(_env_file=None)
    assert s.cors_origins == ["http://a.example", "http://b.example"]
    assert s.api_keys == ["k1", "k2"]
    assert s.service_auth_enabled


def test_wildcard_cors_rejected():
    with pytest.raises(ValueError):
        Settings(cors_origins=["*"], _env_file=None)


def test_production_refuses_the_shared_development_jwt_secret():
    from agriminds_api.core.config import DEV_JWT_SECRET

    with pytest.raises(ValueError, match="AGRIMINDS_JWT_SECRET"):
        Settings(env="production", jwt_secret=DEV_JWT_SECRET, _env_file=None)
    # A real secret is accepted.
    assert Settings(env="production", jwt_secret="a-real-deployment-secret", _env_file=None).is_production


def test_sync_database_url_drops_the_async_driver():
    s = Settings(database_url="postgresql+asyncpg://u:p@h:5432/db", _env_file=None)
    assert s.sync_database_url == "postgresql://u:p@h:5432/db"
