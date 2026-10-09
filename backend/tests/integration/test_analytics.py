"""The BI layer: persisted forecasts, the read-only star schema, and Metabase embedding."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from agriminds_api.core.config import Settings
from agriminds_api.db.models import Crop, UserRole
from agriminds_api.domain.geo import GridSpec
from agriminds_api.schemas.analytics import EmbedConfig
from agriminds_api.services.metabase import MetabaseNotConfiguredError, MetabaseService


@pytest.fixture
async def staff(make_user):
    return await make_user(UserRole.MINISTER, email="analyst@example.et")


@pytest.fixture
async def admin(make_user):
    return await make_user(UserRole.ADMIN, email="root@example.et")


# ====================================================================== snapshots
class TestRiskSnapshots:
    async def test_a_run_is_written_once_per_cell_and_lead(self, client, db_session, artifacts_dir):
        from agriminds_api.core.cache import MemoryCache
        from agriminds_api.services.inference import InferenceService
        from agriminds_api.services.snapshot import write_risk_snapshot

        settings = Settings(_env_file=None, env="test", data_dir=artifacts_dir.root, redis_url=None)
        inference = InferenceService(settings, MemoryCache())
        inference.load()
        grid = GridSpec.from_bbox(settings.grid_rows, settings.grid_cols, settings.bbox)

        summary = await write_risk_snapshot(db_session, inference, grid)
        await db_session.commit()
        assert summary["rows"] == summary["leads"] * summary["cells"]
        assert summary["data_source"] == "synthetic"

        stored = await db_session.scalar(text("SELECT count(*) FROM risk_snapshots"))
        assert stored == summary["rows"]

        # Re-running the same model for the same month must correct, not duplicate.
        await write_risk_snapshot(db_session, inference, grid)
        await db_session.commit()
        assert await db_session.scalar(text("SELECT count(*) FROM risk_snapshots")) == stored

    async def test_every_row_is_classified(self, client, db_session, artifacts_dir):
        from agriminds_api.core.cache import MemoryCache
        from agriminds_api.services.inference import InferenceService
        from agriminds_api.services.snapshot import write_risk_snapshot

        settings = Settings(_env_file=None, env="test", data_dir=artifacts_dir.root, redis_url=None)
        inference = InferenceService(settings, MemoryCache())
        inference.load()
        await write_risk_snapshot(
            db_session, inference, GridSpec.from_bbox(settings.grid_rows, settings.grid_cols, settings.bbox)
        )
        await db_session.commit()
        unclassified = await db_session.scalar(
            text("SELECT count(*) FROM risk_snapshots WHERE risk_level IS NULL")
        )
        assert unclassified == 0
        bad = await db_session.scalar(
            text("SELECT count(*) FROM risk_snapshots WHERE probability < 0 OR probability > 1")
        )
        assert bad == 0


# ====================================================================== star schema
class TestAnalyticsSchema:
    async def test_no_personal_identifier_is_exposed(self, db_session):
        leaked = (
            (
                await db_session.execute(
                    text(
                        "SELECT table_name || '.' || column_name FROM information_schema.columns "
                        "WHERE table_schema = 'analytics' "
                        "AND column_name ~* 'phone|email|password|hash|full_name|token'"
                    )
                )
            )
            .scalars()
            .all()
        )
        assert leaked == [], f"analytics must not expose identifiers, found {leaked}"

    async def test_the_views_agree_with_the_rows_they_summarise(self, db_session, make_user, make_farm):
        owner = await make_user(UserRole.FARMER, phone="+251911777001", woreda_code="SNN")
        await make_farm(owner, name="A", area=2.0, crop=Crop.TEF, woreda_code="SNN")
        await make_farm(owner, name="B", area=1.5, crop=Crop.WHEAT, woreda_code="SNN")
        await db_session.commit()

        plots, hectares, farmers = (
            await db_session.execute(
                text(
                    "SELECT count(*), sum(area_hectares), count(DISTINCT farmer_key) FROM analytics.fact_farm"
                )
            )
        ).one()
        assert (plots, float(hectares), farmers) == (2, 3.5, 1)

    async def test_the_month_dimension_has_no_gaps(self, db_session):
        rows = (
            await db_session.execute(
                text("SELECT month_key, ethiopian_season FROM analytics.dim_month ORDER BY month_key")
            )
        ).all()
        assert rows, "a BI tool needs a contiguous date table"
        months = [r[0] for r in rows]
        for earlier, later in zip(months, months[1:], strict=False):
            gap = (later.year - earlier.year) * 12 + (later.month - earlier.month)
            assert gap == 1, f"gap between {earlier} and {later}"
        seasons = {"Kiremt (main rains)", "Belg (short rains)", "Bega (dry season)"}
        assert {r[1] for r in rows} <= seasons, "every month must carry a known Ethiopian season"

    async def test_months_are_labelled_with_the_right_ethiopian_season(self, db_session):
        """The range in an empty database is short, so the mapping is checked over a full year."""
        labelled = dict(
            (
                await db_session.execute(
                    text(
                        """
                        SELECT EXTRACT(MONTH FROM m)::int,
                               CASE
                                   WHEN EXTRACT(MONTH FROM m) BETWEEN 6 AND 9 THEN 'Kiremt (main rains)'
                                   WHEN EXTRACT(MONTH FROM m) BETWEEN 2 AND 5 THEN 'Belg (short rains)'
                                   ELSE 'Bega (dry season)'
                               END
                        FROM generate_series(DATE '2026-01-01', DATE '2026-12-01', interval '1 month') AS m
                        """
                    )
                )
            ).all()
        )
        assert labelled[7] == "Kiremt (main rains)" and labelled[8] == "Kiremt (main rains)"
        assert labelled[3] == "Belg (short rains)" and labelled[4] == "Belg (short rains)"
        assert labelled[1] == "Bega (dry season)" and labelled[12] == "Bega (dry season)"

    async def test_the_lookup_dimensions_cover_every_enum_value(self, db_session):
        risk = (
            (await db_session.execute(text("SELECT risk_level FROM analytics.dim_risk_level")))
            .scalars()
            .all()
        )
        assert set(risk) == {"Low", "Moderate", "High", "Severe"}
        pdsi = (
            (await db_session.execute(text("SELECT pdsi_category FROM analytics.dim_pdsi_category")))
            .scalars()
            .all()
        )
        assert len(pdsi) == 7
        dry = (
            (
                await db_session.execute(
                    text("SELECT pdsi_category FROM analytics.dim_pdsi_category WHERE is_drought")
                )
            )
            .scalars()
            .all()
        )
        assert set(dry) == {"Moderately dry", "Very dry", "Extremely dry"}

    async def test_the_read_only_role_exists_and_cannot_touch_base_tables(self, db_session):
        exists = await db_session.scalar(text("SELECT count(*) FROM pg_roles WHERE rolname = 'agriminds_bi'"))
        assert exists == 1
        can_read_users = await db_session.scalar(
            text("SELECT has_table_privilege('agriminds_bi', 'public.users', 'SELECT')")
        )
        assert can_read_users is False, "the BI role must never reach the accounts table"
        can_read_view = await db_session.scalar(
            text("SELECT has_table_privilege('agriminds_bi', 'analytics.fact_farm', 'SELECT')")
        )
        assert can_read_view is True
        # Read-only really is read-only: no writes anywhere, including the analytics views.
        for privilege in ("INSERT", "UPDATE", "DELETE"):
            assert (
                await db_session.scalar(
                    text(f"SELECT has_table_privilege('agriminds_bi', 'analytics.fact_farm', '{privilege}')")
                )
                is False
            ), f"the BI role must not hold {privilege}"
        # Schema-level USAGE on `public` is granted to every role by PostgreSQL itself, so it
        # proves nothing. Table privileges are the control that matters: the role reads the
        # analytics views and no base table.
        for table in ("users", "refresh_tokens", "farms", "advisory_records", "risk_snapshots"):
            assert (
                await db_session.scalar(
                    text(f"SELECT has_table_privilege('agriminds_bi', 'public.{table}', 'SELECT')")
                )
                is False
            ), f"the BI role must not read public.{table}"


# ====================================================================== Metabase
SECRET = "0123456789abcdef0123456789abcdef"


def _configured(**overrides) -> Settings:
    base = dict(
        _env_file=None,
        env="test",
        metabase_site_url="http://metabase:3000",
        metabase_public_url="http://localhost:3001",
        metabase_secret_key=SECRET,
        metabase_dashboard_id=7,
    )
    base.update(overrides)
    return Settings(**base)


def _payload(url: str) -> dict:
    """Decode the JWT out of a signed embed URL, verifying it as Metabase would."""
    import jwt

    token = url.split("/embed/dashboard/")[1].split("#")[0]
    return jwt.decode(token, SECRET, algorithms=["HS256"])


class TestMetabaseService:
    def test_an_unconfigured_deployment_says_exactly_what_is_missing(self):
        status = MetabaseService(Settings(_env_file=None, env="test")).status()
        assert status.configured is False
        assert "AGRIMINDS_METABASE_SECRET_KEY" in status.reason
        assert "AGRIMINDS_METABASE_DASHBOARD_ID" in status.reason

    async def test_an_unconfigured_deployment_refuses_rather_than_half_working(self, make_user):
        user = await make_user(UserRole.MINISTER, email="m@example.et")
        with pytest.raises(MetabaseNotConfiguredError):
            MetabaseService(Settings(_env_file=None, env="test")).embed_config(user)

    async def test_it_signs_a_url_without_leaking_the_secret(self, make_user):
        user = await make_user(UserRole.MINISTER, email="m2@example.et")
        config = MetabaseService(_configured()).embed_config(user)

        assert isinstance(config, EmbedConfig)
        assert config.expires_at > datetime.now(UTC)
        assert SECRET not in json.dumps(config.model_dump(), default=str)
        assert _payload(config.embed_url)["resource"] == {"dashboard": 7}

    async def test_the_url_points_at_the_address_a_browser_can_reach(self, make_user):
        """Inside Compose the API knows Metabase as `metabase:3000`, which no laptop resolves."""
        user = await make_user(UserRole.MINISTER, email="m5@example.et")
        config = MetabaseService(_configured()).embed_config(user)
        assert config.embed_url.startswith("http://localhost:3001/embed/dashboard/")

    async def test_a_signed_url_expires(self, make_user):
        user = await make_user(UserRole.MINISTER, email="m6@example.et")
        config = MetabaseService(_configured(metabase_token_minutes=15)).embed_config(user)
        claims = _payload(config.embed_url)
        assert claims["exp"] == int(config.expires_at.timestamp())
        assert config.expires_at < datetime.now(UTC) + timedelta(minutes=16)

    async def test_an_agent_is_scoped_to_their_woreda_inside_the_signature(self, make_user):
        """A locked parameter cannot be overridden from the query string, so the scope holds."""
        agent = await make_user(UserRole.AGENT, email="a@example.et", woreda_code="SNN")
        service = MetabaseService(_configured(metabase_woreda_param="woreda_code"))

        config = service.embed_config(agent)
        assert config.scoped is True
        assert "Sinan" in config.scope
        assert _payload(config.embed_url)["params"] == {"woreda_code": "SNN"}

    async def test_a_minister_is_not_narrowed_to_a_district(self, make_user):
        minister = await make_user(UserRole.MINISTER, email="m3@example.et")
        service = MetabaseService(_configured(metabase_woreda_param="woreda_code"))

        config = service.embed_config(minister)
        assert config.scoped is False
        assert config.scope == "the whole watershed"
        assert _payload(config.embed_url)["params"] == {}

    async def test_without_a_locked_parameter_nobody_is_scoped(self, make_user):
        """Scoping that is configured nowhere must not be implied in the UI."""
        agent = await make_user(UserRole.AGENT, email="a2@example.et", woreda_code="SNN")
        config = MetabaseService(_configured()).embed_config(agent)
        assert config.scoped is False
        assert _payload(config.embed_url)["params"] == {}

    async def test_a_url_signed_with_the_wrong_key_is_rejected(self, make_user):
        """The signature is the whole authorisation; this is what stops a forged dashboard id."""
        import jwt

        user = await make_user(UserRole.MINISTER, email="m7@example.et")
        config = MetabaseService(_configured()).embed_config(user)
        token = config.embed_url.split("/embed/dashboard/")[1].split("#")[0]
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "not-the-secret", algorithms=["HS256"])


class TestAnalyticsEndpoints:
    def test_status_is_staff_only(self, client, staff, make_user, sign_in):
        assert client.get("/api/v1/analytics/metabase/status").status_code == 401
        body = client.get("/api/v1/analytics/metabase/status", headers=sign_in(staff.email)["headers"]).json()
        assert body["configured"] is False and body["reason"]

    async def test_a_farmer_cannot_reach_the_analytics_layer(self, client, make_user, sign_in):
        farmer = await make_user(UserRole.FARMER, phone="+251911777002")
        headers = sign_in(farmer.phone)["headers"]
        for path in ("/api/v1/analytics/metabase/status", "/api/v1/analytics/metabase/embed"):
            assert client.get(path, headers=headers).status_code == 403

    def test_embedding_reports_503_when_not_configured(self, client, staff, sign_in):
        r = client.get("/api/v1/analytics/metabase/embed", headers=sign_in(staff.email)["headers"])
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "metabase_not_configured"

    def test_the_status_endpoint_never_returns_the_signing_secret(
        self, artifacts_dir, db_engine, staff, sign_in
    ):
        from tests.conftest import _client, _settings

        settings = _settings(
            artifacts_dir.root,
            metabase_site_url="http://metabase:3000",
            metabase_secret_key=SECRET,
            metabase_dashboard_id=7,
        )
        with _client(settings) as configured:
            headers = sign_in(staff.email, c=configured)["headers"]
            body = configured.get("/api/v1/analytics/metabase/status", headers=headers).json()
        assert body["configured"] is True
        assert SECRET not in json.dumps(body)

    def test_connection_details_are_administrator_only(self, client, staff, admin, sign_in):
        assert (
            client.get("/api/v1/analytics/connection", headers=sign_in(staff.email)["headers"]).status_code
            == 403
        )
        body = client.get("/api/v1/analytics/connection", headers=sign_in(admin.email)["headers"]).json()
        assert body["schema"] == "analytics"
        assert body["read_only_role"] == "agriminds_bi"
        assert "fact_farm" in body["views"] and "dim_woreda" in body["views"]

    def test_the_connection_never_returns_a_credential(self, client, admin, sign_in):
        from tests.conftest import TEST_DATABASE_URL

        body = client.get("/api/v1/analytics/connection", headers=sign_in(admin.email)["headers"]).json()
        secret = TEST_DATABASE_URL.split("//", 1)[1].split("@")[0]
        assert secret not in json.dumps(body), "the connection string's credentials must be stripped"
        assert "@" not in body["server"], f"server should be host:port, got {body['server']}"
        assert ":" in body["server"], "server should carry the port"


class TestConnectionReachability:
    """A connection file that cannot be reached is worse than none: it fails silently."""

    def test_an_internal_hostname_is_flagged_rather_than_handed_out_silently(self, client, admin, sign_in):
        body = client.get("/api/v1/analytics/connection", headers=sign_in(admin.email)["headers"]).json()
        if body["server"].split(":")[0] in ("postgres", "localhost", "127.0.0.1", "db", "database"):
            assert "will not resolve" in body["note"]
            assert "AGRIMINDS_ANALYTICS_PUBLIC_HOST" in body["note"]

    def test_a_configured_public_address_is_used_verbatim_and_not_flagged(
        self, artifacts_dir, db_engine, admin, sign_in
    ):
        from tests.conftest import _client, _settings

        settings = _settings(artifacts_dir.root, analytics_public_host="db.example.et:5432")
        with _client(settings) as public:
            headers = sign_in(admin.email, c=public)["headers"]
            body = public.get("/api/v1/analytics/connection", headers=headers).json()
        assert body["server"] == "db.example.et:5432"
        assert "will not resolve" not in body["note"]


class TestBlankEnvironmentVariables:
    """Compose substitutes an unset `${VAR:-}` to an empty string, and `.env.example` ships
    these keys blank. Treating that as a value rather than as "unset" crash-loops the API."""

    def test_a_blank_dashboard_id_does_not_stop_the_api_starting(self):
        settings = Settings(
            _env_file=None,
            env="test",
            metabase_site_url="",
            metabase_public_url="",
            metabase_secret_key="",
            metabase_dashboard_id="",
            metabase_woreda_param="",
            analytics_public_host="",
        )
        assert settings.metabase_dashboard_id is None
        assert settings.metabase_configured is False
        assert settings.analytics_public_host is None

    def test_a_blank_setting_reads_as_unconfigured_not_as_broken(self):
        status = MetabaseService(Settings(_env_file=None, env="test", metabase_secret_key="")).status()
        assert status.configured is False
        assert "AGRIMINDS_METABASE_SECRET_KEY" in status.reason

    def test_whitespace_is_not_a_configuration(self):
        settings = Settings(_env_file=None, env="test", metabase_secret_key="   ")
        assert settings.metabase_secret_key is None
