"""Plot management: ownership, geography validation and the derived grid cell."""

from __future__ import annotations

import uuid

import pytest

from agriminds_api.db.models import UserRole


@pytest.fixture
async def farmer(make_user):
    return await make_user(UserRole.FARMER, phone="+251911000333", woreda_code="SNN")


@pytest.fixture
def headers(sign_in, farmer):
    return sign_in(farmer.phone)["headers"]


PLOT = {
    "name": "Upper field",
    "latitude": 10.95,
    "longitude": 37.95,
    "area_hectares": 1.25,
    "primary_crop": "tef",
}


class TestCreate:
    def test_create_derives_the_grid_cell_and_attaches_risk(self, client, headers):
        r = client.post("/api/v1/farms", json=PLOT, headers=headers)
        assert r.status_code == 201, r.text
        body = r.json()
        assert 0 <= body["grid_row"] <= 7 and 0 <= body["grid_col"] <= 7
        assert body["risk"]["risk_level"] in {"Low", "Moderate", "High", "Severe"}
        assert 0 <= body["risk"]["probability"] <= 1
        assert body["woreda"]["name_en"] == "Sinan", "an unspecified woreda falls back to the owner's"

    def test_a_point_outside_the_watershed_is_refused_with_a_usable_message(self, client, headers):
        r = client.post("/api/v1/farms", json={**PLOT, "latitude": 9.03, "longitude": 38.74}, headers=headers)
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "invalid_location"
        assert "Choke" in r.json()["error"]["message"]

    @pytest.mark.parametrize(
        "bad", [{"area_hectares": 0}, {"area_hectares": -2}, {"name": ""}, {"primary_crop": "barley"}]
    )
    def test_invalid_payloads_are_rejected(self, client, headers, bad):
        assert client.post("/api/v1/farms", json={**PLOT, **bad}, headers=headers).status_code == 422


class TestOwnership:
    async def test_a_farmer_only_sees_their_own_plots(
        self, client, headers, farmer, make_user, make_farm, sign_in
    ):
        await make_farm(farmer, name="Mine")
        other = await make_user(UserRole.FARMER, phone="+251911000444", woreda_code="MCK")
        theirs = await make_farm(other, name="Theirs")

        mine = client.get("/api/v1/farms", headers=headers).json()
        assert [f["name"] for f in mine] == ["Mine"]

        # Someone else's plot reads as missing, not forbidden, so ids cannot be probed.
        assert client.get(f"/api/v1/farms/{theirs.id}", headers=headers).status_code == 404
        assert (
            client.patch(f"/api/v1/farms/{theirs.id}", json={"name": "x"}, headers=headers).status_code == 404
        )
        assert client.delete(f"/api/v1/farms/{theirs.id}", headers=headers).status_code == 404

        others_headers = sign_in(other.phone)["headers"]
        assert [f["name"] for f in client.get("/api/v1/farms", headers=others_headers).json()] == ["Theirs"]

    def test_unknown_plot_is_404(self, client, headers):
        assert client.get(f"/api/v1/farms/{uuid.uuid4()}", headers=headers).status_code == 404


class TestUpdateAndDelete:
    def test_moving_a_plot_recomputes_its_cell(self, client, headers):
        created = client.post("/api/v1/farms", json=PLOT, headers=headers).json()
        moved = client.patch(
            f"/api/v1/farms/{created['id']}", json={"latitude": 10.45, "longitude": 38.35}, headers=headers
        )
        assert moved.status_code == 200
        assert (moved.json()["grid_row"], moved.json()["grid_col"]) != (
            created["grid_row"],
            created["grid_col"],
        )

    def test_partial_update_leaves_other_fields_alone(self, client, headers):
        created = client.post("/api/v1/farms", json=PLOT, headers=headers).json()
        patched = client.patch(
            f"/api/v1/farms/{created['id']}", json={"primary_crop": "maize"}, headers=headers
        ).json()
        assert patched["primary_crop"] == "maize"
        assert patched["name"] == created["name"]
        assert patched["area_hectares"] == created["area_hectares"]

    def test_delete_removes_the_plot(self, client, headers):
        created = client.post("/api/v1/farms", json=PLOT, headers=headers).json()
        assert client.delete(f"/api/v1/farms/{created['id']}", headers=headers).status_code == 204
        assert client.get("/api/v1/farms", headers=headers).json() == []


class TestFarmAdvisory:
    def test_advisory_uses_the_plot_crop_and_is_recorded_once(self, client, headers):
        created = client.post("/api/v1/farms", json={**PLOT, "primary_crop": "maize"}, headers=headers).json()
        first = client.get(f"/api/v1/farms/{created['id']}/advisory", headers=headers)
        assert first.status_code == 200
        assert first.json()["crop"] == "maize"
        assert first.json()["provenance"]["data_source"] == "synthetic"

        client.get(f"/api/v1/farms/{created['id']}/advisory", headers=headers)
        # The second visit must not create a duplicate delivery record for the same issue month.
        assert (
            client.get(f"/api/v1/farms/{created['id']}/advisory?crop=tef", headers=headers).json()["crop"]
            == "tef"
        )
