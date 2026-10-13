"""Selling API access: who gets a key, what it may call, and what happens when it runs out."""

from __future__ import annotations

import pytest


@pytest.fixture
def org(client, admin_headers, pricing_tiers):
    """A regional bureau, whose tier carries an API allowance."""
    res = client.post(
        "/api/v1/organizations",
        json={"name": "Amhara Bureau of Agriculture", "stakeholder": "regional_government"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


class TestAccess:
    def test_accounts_are_admin_only(self, client, minister_headers) -> None:
        assert client.get("/api/v1/organizations", headers=minister_headers).status_code == 403


class TestOrganizations:
    def test_quota_comes_from_the_tier_in_force(self, org) -> None:
        # Not stored on the organization: repricing a tier must move every subscriber's allowance.
        assert org["api_quota_monthly"] == 250_000
        assert org["api_requests_this_month"] == 0

    def test_a_duplicate_name_is_refused(self, client, admin_headers, org) -> None:
        res = client.post(
            "/api/v1/organizations",
            json={"name": org["name"], "stakeholder": "cooperative"},
            headers=admin_headers,
        )
        assert res.status_code == 409


class TestKeys:
    def test_the_key_is_shown_once_and_never_again(self, client, admin_headers, org) -> None:
        issued = client.post(
            f"/api/v1/organizations/{org['id']}/keys",
            json={"label": "ETL pipeline"},
            headers=admin_headers,
        ).json()
        assert issued["key"].startswith("agm_")
        assert issued["last_four"] == issued["key"][-4:]

        # Every later read carries the fingerprint and not the credential.
        listed = client.get(f"/api/v1/organizations/{org['id']}/keys", headers=admin_headers).json()
        assert "key" not in listed[0]
        assert listed[0]["last_four"] == issued["last_four"]

    def test_a_revoked_key_is_kept_as_a_record(self, client, admin_headers, org) -> None:
        issued = client.post(
            f"/api/v1/organizations/{org['id']}/keys", json={"label": "temp"}, headers=admin_headers
        ).json()
        revoked = client.delete(
            f"/api/v1/organizations/{org['id']}/keys/{issued['id']}", headers=admin_headers
        ).json()
        assert revoked["is_active"] is False and revoked["revoked_at"]
        assert len(client.get(f"/api/v1/organizations/{org['id']}/keys", headers=admin_headers).json()) == 1


class TestMetering:
    def _key(self, client, admin_headers, org) -> str:
        return client.post(
            f"/api/v1/organizations/{org['id']}/keys",
            json={"label": "metered"},
            headers=admin_headers,
        ).json()["key"]

    def test_a_customer_key_reaches_the_forecast_and_is_counted(self, client, admin_headers, org) -> None:
        key = self._key(client, admin_headers, org)
        before = client.get(f"/api/v1/organizations/{org['id']}/usage", headers=admin_headers).json()
        assert before["used_this_month"] == 0

        assert client.get("/api/v1/enso/outlook", headers={"X-API-Key": key}).status_code == 200

        after = client.get(f"/api/v1/organizations/{org['id']}/usage", headers=admin_headers).json()
        assert after["used_this_month"] == 1
        assert after["remaining"] == after["quota_monthly"] - 1

    def test_a_revoked_key_stops_working(self, client, admin_headers, org) -> None:
        issued = client.post(
            f"/api/v1/organizations/{org['id']}/keys", json={"label": "doomed"}, headers=admin_headers
        ).json()
        client.delete(f"/api/v1/organizations/{org['id']}/keys/{issued['id']}", headers=admin_headers)
        assert client.get("/api/v1/enso/outlook", headers={"X-API-Key": issued["key"]}).status_code == 401

    def test_an_unknown_key_is_refused(self, client) -> None:
        assert client.get("/api/v1/enso/outlook", headers={"X-API-Key": "agm_nope"}).status_code == 401

    def test_a_tier_without_api_access_is_told_so(self, client, admin_headers, pricing_tiers) -> None:
        """A farmer buys the app, not an integration — and gets a reason, not a bare refusal."""
        farmer_org = client.post(
            "/api/v1/organizations",
            json={"name": "Lone Farmer", "stakeholder": "farmer_premium"},
            headers=admin_headers,
        ).json()
        key = self._key(client, admin_headers, farmer_org)
        res = client.get("/api/v1/enso/outlook", headers={"X-API-Key": key})
        assert res.status_code == 403
        assert "does not include API access" in res.json()["error"]["message"]


class TestExistingAuthIsUnaffected:
    def test_a_signed_in_person_is_never_metered(self, client, minister_headers, org, admin_headers) -> None:
        assert client.get("/api/v1/enso/outlook", headers=minister_headers).status_code == 200
        usage = client.get(f"/api/v1/organizations/{org['id']}/usage", headers=admin_headers).json()
        assert usage["used_this_month"] == 0
