"""The BI layer: persisted forecasts, the read-only star schema, and Power BI embedding."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from agriminds_api.core.config import Settings
from agriminds_api.db.models import Crop, UserRole
from agriminds_api.domain.geo import GridSpec
from agriminds_api.schemas.analytics import EmbedConfig
from agriminds_api.services.powerbi import PowerBiNotConfiguredError, PowerBiService


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


# ====================================================================== Power BI
class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _FakePowerBi:
    """Stands in for the Power BI REST API so the service logic can be exercised offline."""

    def __init__(self, *, report_status=200, token_status=200):
        self.report_status = report_status
        self.token_status = token_status
        self.generate_calls: list[dict] = []

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None):
        return _FakeResponse(self.report_status, {"embedUrl": "https://app.powerbi.com/reportEmbed?x=1"})

    async def post(self, url, headers=None, json=None):
        self.generate_calls.append(json or {})
        expiry = (datetime.now(UTC) + timedelta(minutes=50)).isoformat().replace("+00:00", "Z")
        return _FakeResponse(self.token_status, {"token": "embed-token-value", "expiration": expiry})


def _configured(**overrides) -> Settings:
    base = dict(
        _env_file=None,
        env="test",
        powerbi_tenant_id="tenant",
        powerbi_client_id="client",
        powerbi_client_secret="secret",
        powerbi_workspace_id="workspace",
        powerbi_report_id="report",
    )
    base.update(overrides)
    return Settings(**base)


class TestPowerBiService:
    def test_an_unconfigured_deployment_says_exactly_what_is_missing(self):
        status = PowerBiService(Settings(_env_file=None, env="test")).status()
        assert status.configured is False
        assert "AGRIMINDS_POWERBI_TENANT_ID" in status.reason

    async def test_an_unconfigured_deployment_refuses_rather_than_half_working(self, make_user):
        user = await make_user(UserRole.MINISTER, email="m@example.et")
        with pytest.raises(PowerBiNotConfiguredError):
            await PowerBiService(Settings(_env_file=None, env="test")).embed_config(user)

    async def test_it_mints_a_token_without_leaking_the_secret(self, monkeypatch, make_user):
        user = await make_user(UserRole.MINISTER, email="m2@example.et")
        service = PowerBiService(_configured())
        monkeypatch.setattr(service, "_acquire_aad_token", lambda: "aad-token")
        fake = _FakePowerBi()
        monkeypatch.setattr("agriminds_api.services.powerbi.httpx.AsyncClient", fake)

        config = await service.embed_config(user)
        assert isinstance(config, EmbedConfig)
        assert config.access_token == "embed-token-value"
        assert config.embed_url.startswith("https://app.powerbi.com/")
        assert config.expires_at > datetime.now(UTC)
        assert "secret" not in json.dumps(config.model_dump(), default=str)

    async def test_an_agent_is_scoped_to_their_woreda_by_the_server(self, monkeypatch, make_user):
        agent = await make_user(UserRole.AGENT, email="a@example.et", woreda_code="SNN")
        service = PowerBiService(_configured(powerbi_rls_role="WoredaScope", powerbi_dataset_id="ds"))
        monkeypatch.setattr(service, "_acquire_aad_token", lambda: "aad-token")
        fake = _FakePowerBi()
        monkeypatch.setattr("agriminds_api.services.powerbi.httpx.AsyncClient", fake)

        config = await service.embed_config(agent)
        assert config.rls_applied is True
        assert "Sinan" in config.scope
        identity = fake.generate_calls[0]["identities"][0]
        assert identity["roles"] == ["WoredaScope"]
        assert identity["customData"] == "SNN", "the district filter must travel in the token"

    async def test_a_minister_is_not_narrowed_to_a_district(self, monkeypatch, make_user):
        minister = await make_user(UserRole.MINISTER, email="m3@example.et")
        service = PowerBiService(_configured(powerbi_rls_role="WoredaScope", powerbi_dataset_id="ds"))
        monkeypatch.setattr(service, "_acquire_aad_token", lambda: "aad-token")
        fake = _FakePowerBi()
        monkeypatch.setattr("agriminds_api.services.powerbi.httpx.AsyncClient", fake)

        config = await service.embed_config(minister)
        assert config.scope == "Whole watershed"
        assert "customData" not in fake.generate_calls[0]["identities"][0]

    async def test_an_upstream_failure_is_reported_without_internal_detail(self, monkeypatch, make_user):
        from agriminds_api.services.powerbi import PowerBiUpstreamError

        user = await make_user(UserRole.MINISTER, email="m4@example.et")
        service = PowerBiService(_configured())
        monkeypatch.setattr(service, "_acquire_aad_token", lambda: "aad-token")
        monkeypatch.setattr(
            "agriminds_api.services.powerbi.httpx.AsyncClient", _FakePowerBi(report_status=404)
        )
        with pytest.raises(PowerBiUpstreamError) as caught:
            await service.embed_config(user)
        assert "404" not in str(caught.value)


class TestAnalyticsEndpoints:
    def test_status_is_staff_only(self, client, staff, make_user, sign_in):
        assert client.get("/api/v1/analytics/powerbi/status").status_code == 401
        body = client.get("/api/v1/analytics/powerbi/status", headers=sign_in(staff.email)["headers"]).json()
        assert body["configured"] is False and body["reason"]

    async def test_a_farmer_cannot_reach_the_analytics_layer(self, client, make_user, sign_in):
        farmer = await make_user(UserRole.FARMER, phone="+251911777002")
        headers = sign_in(farmer.phone)["headers"]
        for path in ("/api/v1/analytics/powerbi/status", "/api/v1/analytics/powerbi/embed-token"):
            assert client.get(path, headers=headers).status_code == 403

    def test_embedding_reports_503_when_not_configured(self, client, staff, sign_in):
        r = client.get("/api/v1/analytics/powerbi/embed-token", headers=sign_in(staff.email)["headers"])
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "powerbi_not_configured"

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

    def test_the_pbids_file_opens_power_bi_desktop_on_the_right_database(self, client, admin, sign_in):
        r = client.get("/api/v1/analytics/connection.pbids", headers=sign_in(admin.email)["headers"])
        assert r.status_code == 200
        assert "attachment" in r.headers["content-disposition"]
        payload = r.json()
        assert payload["connections"][0]["details"]["protocol"] == "postgresql"
        assert "password" not in r.text.lower()


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
