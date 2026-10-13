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


class TestAnonymousAccess:
    """Who may read forecast data when no API keys are configured.

    The convenience that lets a developer run the stack with no credentials must not be the thing
    that opens a paid product. It was guarded only on "no keys configured", which a production
    deployment that never set `AGRIMINDS_API_KEYS` satisfies — so the whole forecast grid was
    served to anyone with the URL, outside the metering customers are billed by.
    """

    @staticmethod
    def _principal(env: str, keys: str = ""):
        from agriminds_api.api.deps import require_principal
        from agriminds_api.core.config import Settings

        settings = Settings(
            _env_file=None,
            env=env,
            api_keys=keys,
            jwt_secret="a-unique-secret-for-this-test-only-32b",
        )
        return require_principal(settings, None, None)

    def test_development_without_credentials_still_works(self) -> None:
        assert self._principal("development").name == "anonymous"

    def test_production_without_credentials_is_refused(self) -> None:
        from agriminds_api.core.exceptions import UnauthorizedError

        with pytest.raises(UnauthorizedError):
            self._principal("production")

    def test_staging_without_credentials_still_works(self) -> None:
        # Staging is a stand-in for development here; only production is sealed.
        assert self._principal("staging").name == "anonymous"

    def test_production_with_a_configured_key_is_unaffected(self) -> None:
        from agriminds_api.api.deps import require_principal
        from agriminds_api.core.config import Settings

        settings = Settings(
            _env_file=None,
            env="production",
            api_keys="a-service-key",
            jwt_secret="a-unique-secret-for-this-test-only-32b",
        )
        assert require_principal(settings, "a-service-key", None) is not None
