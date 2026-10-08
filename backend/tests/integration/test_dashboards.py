"""The two role dashboards. Every figure must trace back to a row that exists."""

from __future__ import annotations

import pytest

from agriminds_api.db.models import Crop, UserRole


@pytest.fixture
async def minister(make_user):
    return await make_user(UserRole.MINISTER, email="minister@example.et")


@pytest.fixture
async def population(make_user, make_farm):
    """Two farmers in Sinan with three plots, one farmer in Machakel with one plot."""
    a = await make_user(UserRole.FARMER, phone="+251911000555", full_name="Farmer A", woreda_code="SNN")
    b = await make_user(UserRole.FARMER, phone="+251911000666", full_name="Farmer B", woreda_code="SNN")
    c = await make_user(UserRole.FARMER, phone="+251911000777", full_name="Farmer C", woreda_code="MCK")
    await make_farm(a, row=0, col=0, area=1.0, crop=Crop.TEF, woreda_code="SNN", name="A1")
    await make_farm(a, row=0, col=1, area=2.0, crop=Crop.TEF, woreda_code="SNN", name="A2")
    await make_farm(b, row=1, col=1, area=0.5, crop=Crop.WHEAT, woreda_code="SNN", name="B1")
    await make_farm(c, row=7, col=7, area=3.0, crop=Crop.MAIZE, woreda_code="MCK", name="C1")
    return {"a": a, "b": b, "c": c}


class TestMinistryDashboard:
    def test_counts_match_the_registered_rows(self, client, minister, population, sign_in):
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        assert d["scope"] == "Choke Mountain watershed"
        cov = d["coverage"]
        assert cov["farmers"] == 3
        assert cov["farms"] == 4
        assert cov["hectares"] == pytest.approx(6.5)
        assert cov["woredas_covered"] == 2
        assert cov["woredas_total"] == 8

    def test_exposure_accounts_for_every_plot_exactly_once(self, client, minister, population, sign_in):
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        exposure = d["exposure"]
        assert sum(b["farms"] for b in exposure["buckets"]) == 4
        assert sum(b["hectares"] for b in exposure["buckets"]) == pytest.approx(6.5)
        assert [b["risk_level"] for b in exposure["buckets"]] == ["Low", "Moderate", "High", "Severe"]
        at_risk = sum(b["farms"] for b in exposure["buckets"] if b["risk_level"] in {"High", "Severe"})
        assert exposure["farms_at_risk"] == at_risk

    def test_a_farmer_holding_plots_in_two_cells_is_counted_once_per_level(
        self, client, minister, population, sign_in
    ):
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        # Farmer A owns two plots; the sum of farmers across levels can never exceed the headcount.
        assert sum(b["farmers"] for b in d["exposure"]["buckets"]) <= d["coverage"]["farmers"]

    def test_crop_mix_and_woreda_breakdown(self, client, minister, population, sign_in):
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        mix = {c["crop"]: c for c in d["crop_mix"]}
        assert mix["tef"]["farms"] == 2 and mix["tef"]["hectares"] == pytest.approx(3.0)
        assert mix["maize"]["hectares"] == pytest.approx(3.0)

        woredas = {w["name_en"]: w for w in d["by_woreda"]}
        assert set(woredas) == {"Sinan", "Machakel"}
        assert woredas["Sinan"]["farms"] == 3 and woredas["Sinan"]["farmers"] == 2
        assert woredas["Machakel"]["farms"] == 1
        assert woredas["Sinan"]["name_am"] == "ሲናን"

    async def test_an_agent_sees_only_their_own_woreda(self, client, make_user, population, sign_in):
        agent = await make_user(UserRole.AGENT, email="agent@example.et", woreda_code="SNN")
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(agent.email)["headers"]).json()
        assert d["scope"] == "Sinan woreda"
        assert d["coverage"]["farms"] == 3
        assert [w["name_en"] for w in d["by_woreda"]] == ["Sinan"]
        assert sum(b["farms"] for b in d["exposure"]["buckets"]) == 3

    def test_empty_platform_reports_zeros_not_estimates(self, client, minister, sign_in):
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        assert d["coverage"]["farmers"] == 0 and d["coverage"]["farms"] == 0
        assert d["by_woreda"] == [] and d["crop_mix"] == []
        assert d["advisories"]["acknowledgement_rate"] is None, "no advisories means no rate, not zero"

    def test_provenance_is_attached(self, client, minister, population, sign_in):
        d = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        assert d["provenance"]["data_source"] == "synthetic"
        assert d["provenance"]["source"] == "model"

    async def test_without_a_model_exposure_is_null_rather_than_guessed(
        self, empty_client, make_user, population, test_password
    ):
        minister = await make_user(UserRole.MINISTER, email="m2@example.et")
        token = empty_client.post(
            "/api/v1/auth/login", json={"identifier": minister.email, "password": test_password}
        ).json()
        d = empty_client.get(
            "/api/v1/dashboard/ministry", headers={"Authorization": f"Bearer {token['access_token']}"}
        ).json()
        assert d["exposure"] is None, "no model must mean no risk figures at all"
        assert d["provenance"] is None
        assert d["coverage"]["farms"] == 4, "registered rows are still counted without a model"


class TestFarmerDashboard:
    def test_shows_own_plots_and_advises_on_the_worst_one(self, client, population, sign_in):
        d = client.get("/api/v1/dashboard/farmer", headers=sign_in(population["a"].phone)["headers"]).json()
        assert {f["name"] for f in d["farms"]} == {"A1", "A2"}
        assert d["user"]["full_name"] == "Farmer A"
        assert d["advisory"] is not None
        worst = max(d["farms"], key=lambda f: f["risk"]["probability"])
        assert d["advisory_farm_id"] == worst["id"]
        assert d["advisory"]["crop"] == worst["primary_crop"]
        assert d["enso_state"] in {"El Niño", "La Niña", "Neutral"}

    async def test_a_farmer_with_no_plots_gets_an_empty_dashboard_not_an_error(
        self, client, make_user, sign_in
    ):
        farmer = await make_user(UserRole.FARMER, phone="+251911000888")
        d = client.get("/api/v1/dashboard/farmer", headers=sign_in(farmer.phone)["headers"]).json()
        assert d["farms"] == []
        assert d["advisory"] is None and d["advisory_farm_id"] is None

    def test_viewing_the_dashboard_records_the_advisory_for_delivery_reporting(
        self, client, population, minister, sign_in
    ):
        before = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        assert before["advisories"]["issued_total"] == 0

        client.get("/api/v1/dashboard/farmer", headers=sign_in(population["a"].phone)["headers"])
        client.get("/api/v1/dashboard/farmer", headers=sign_in(population["a"].phone)["headers"])

        after = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        assert after["advisories"]["issued_total"] == 1, "revisiting must not inflate the delivery count"
        assert after["advisories"]["acknowledged_30d"] == 0
        assert after["advisories"]["acknowledgement_rate"] == 0.0


class TestAcknowledgement:
    def test_a_farmer_can_acknowledge_the_advisory_they_were_shown(
        self, client, population, minister, sign_in
    ):
        headers = sign_in(population["a"].phone)["headers"]
        dashboard = client.get("/api/v1/dashboard/farmer", headers=headers).json()
        record_id = dashboard["advisory_record_id"]
        assert record_id, "the dashboard must expose the record so the client can acknowledge it"
        assert dashboard["advisory_acknowledged_at"] is None

        ack = client.post(f"/api/v1/dashboard/farmer/advisories/{record_id}/acknowledge", headers=headers)
        assert ack.status_code == 204

        again = client.get("/api/v1/dashboard/farmer", headers=headers).json()
        assert again["advisory_acknowledged_at"] is not None
        assert again["advisory_record_id"] == record_id, "acknowledging must not create a new record"

        figures = client.get("/api/v1/dashboard/ministry", headers=sign_in(minister.email)["headers"]).json()
        assert figures["advisories"]["acknowledged_30d"] == 1
        assert figures["advisories"]["acknowledgement_rate"] == 1.0

    def test_acknowledging_twice_is_harmless(self, client, population, sign_in):
        headers = sign_in(population["a"].phone)["headers"]
        record_id = client.get("/api/v1/dashboard/farmer", headers=headers).json()["advisory_record_id"]
        for _ in range(2):
            assert (
                client.post(
                    f"/api/v1/dashboard/farmer/advisories/{record_id}/acknowledge", headers=headers
                ).status_code
                == 204
            )

    async def test_a_farmer_cannot_acknowledge_someone_else_s_advisory(
        self, client, population, make_user, sign_in
    ):
        owner_headers = sign_in(population["a"].phone)["headers"]
        record_id = client.get("/api/v1/dashboard/farmer", headers=owner_headers).json()["advisory_record_id"]

        intruder = await make_user(UserRole.FARMER, phone="+251911000999")
        r = client.post(
            f"/api/v1/dashboard/farmer/advisories/{record_id}/acknowledge",
            headers=sign_in(intruder.phone)["headers"],
        )
        assert r.status_code == 404, "another farmer's record must read as missing"

    def test_per_plot_advisory_returns_its_record_id(self, client, population, sign_in):
        headers = sign_in(population["a"].phone)["headers"]
        farm_id = client.get("/api/v1/farms", headers=headers).json()[0]["id"]
        advisory = client.get(f"/api/v1/farms/{farm_id}/advisory", headers=headers).json()
        assert advisory["record_id"]
        assert advisory["acknowledged_at"] is None
        assert (
            client.post(
                f"/api/v1/dashboard/farmer/advisories/{advisory['record_id']}/acknowledge", headers=headers
            ).status_code
            == 204
        )
        again = client.get(f"/api/v1/farms/{farm_id}/advisory", headers=headers).json()
        assert again["record_id"] == advisory["record_id"]
        assert again["acknowledged_at"] is not None
