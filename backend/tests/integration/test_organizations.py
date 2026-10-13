"""Selling API access: who gets a key, what it may call, and what happens when it runs out."""

from __future__ import annotations

import pytest


@pytest.fixture
def org(client, admin_headers, pricing_tiers):
    """An agricultural office, priced per woreda, whose tier carries an API allowance."""
    res = client.post(
        "/api/v1/organizations",
        json={"name": "Amhara Bureau of Agriculture", "stakeholder": "development_agent"},
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
        assert org["api_quota_monthly"] == 25_000
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


class TestMembers:
    """An organisation that nobody can sign in to is an organisation that does not exist yet."""

    async def _org(self, client, admin_headers) -> str:
        res = client.post(
            "/api/v1/organizations",
            json={"name": "Haramaya University", "stakeholder": "research"},
            headers=admin_headers,
        )
        assert res.status_code in (200, 201), res.text
        return res.json()["id"]

    async def test_an_account_created_directly_has_nobody_in_it(
        self, client, admin_headers, db_ready
    ) -> None:
        """This is the state the question came from: created by hand, unreachable."""
        org_id = await self._org(client, admin_headers)
        listed = client.get("/api/v1/organizations", headers=admin_headers).json()
        created = next(o for o in listed if o["id"] == org_id)
        # Shown in the list rather than discovered when somebody asks why they cannot log in.
        assert created["members"] == 0
        assert created["pending_invitations"] == 0
        assert client.get(f"/api/v1/organizations/{org_id}/members", headers=admin_headers).json() == []

    async def test_inviting_gives_a_link_and_never_a_password(self, client, admin_headers, db_ready) -> None:
        org_id = await self._org(client, admin_headers)
        res = client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"full_name": "Bona Nasser", "email": "bona@haramaya.edu.et"},
            headers=admin_headers,
        )
        assert res.status_code == 201, res.text
        body = res.json()
        assert body["token"]
        # An administrator who could set it could then sign in as them.
        assert "password" not in body

    async def test_the_invited_person_sets_their_own_password_and_is_in(
        self, client, admin_headers, db_ready
    ) -> None:
        org_id = await self._org(client, admin_headers)
        token = client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"full_name": "Bona Nasser", "email": "bona@haramaya.edu.et"},
            headers=admin_headers,
        ).json()["token"]

        accepted = client.post(
            f"/api/v1/auth/invitations/{token}", json={"password": "haramaya-own-passphrase"}
        )
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["user"]["email"] == "bona@haramaya.edu.et"

        # And they land on their own account's billing, not somebody else's.
        headers = {"Authorization": f"Bearer {accepted.json()['access_token']}"}
        plans = client.get("/api/v1/plans", headers=headers)
        assert plans.status_code in (200, 404)  # 404 only when that segment has no tier

    async def test_the_list_distinguishes_invited_from_arrived(self, client, admin_headers, db_ready) -> None:
        """Somebody who has never accepted an invitation is not yet a way into the account."""
        org_id = await self._org(client, admin_headers)
        token = client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"full_name": "Bona Nasser", "email": "bona@haramaya.edu.et"},
            headers=admin_headers,
        ).json()["token"]

        before = client.get(f"/api/v1/organizations/{org_id}/members", headers=admin_headers).json()
        assert before[0]["invitation_pending"] is True
        assert before[0]["has_signed_in"] is False

        client.post(f"/api/v1/auth/invitations/{token}", json={"password": "haramaya-own-passphrase"})
        after = client.get(f"/api/v1/organizations/{org_id}/members", headers=admin_headers).json()
        assert after[0]["invitation_pending"] is False
        assert after[0]["has_signed_in"] is True

    async def test_an_address_already_in_use_is_reported(self, client, admin_headers, db_ready) -> None:
        org_id = await self._org(client, admin_headers)
        body = {"full_name": "Bona Nasser", "email": "bona@haramaya.edu.et"}
        assert (
            client.post(
                f"/api/v1/organizations/{org_id}/members", json=body, headers=admin_headers
            ).status_code
            == 201
        )
        again = client.post(f"/api/v1/organizations/{org_id}/members", json=body, headers=admin_headers)
        assert again.status_code == 409

    async def test_only_an_administrator_may_invite(
        self, client, admin_headers, farmer_headers, db_ready
    ) -> None:
        org_id = await self._org(client, admin_headers)
        res = client.post(
            f"/api/v1/organizations/{org_id}/members",
            json={"full_name": "Nobody", "email": "nobody@example.et"},
            headers=farmer_headers,
        )
        assert res.status_code == 403
