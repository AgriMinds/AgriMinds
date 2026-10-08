"""Sign-in, role enforcement, token rotation and self-service."""

from __future__ import annotations

import pytest

from agriminds_api.db.models import UserRole


@pytest.fixture
async def farmer(make_user):
    return await make_user(
        UserRole.FARMER, phone="+251911000111", full_name="Abebe Kebede", woreda_code="SNN"
    )


@pytest.fixture
async def minister(make_user):
    return await make_user(UserRole.MINISTER, email="minister@example.et", full_name="Ministry Demo")


class TestLogin:
    def test_farmer_signs_in_with_phone_in_any_format(self, client, farmer, test_password):
        for identifier in ("+251911000111", "0911000111", "251911000111", "0911 000 111"):
            r = client.post("/api/v1/auth/login", json={"identifier": identifier, "password": test_password})
            assert r.status_code == 200, identifier
            assert r.json()["user"]["full_name"] == "Abebe Kebede"

    def test_staff_sign_in_with_email_case_insensitively(self, client, minister, test_password):
        r = client.post(
            "/api/v1/auth/login", json={"identifier": "Minister@Example.ET", "password": test_password}
        )
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["role"] == "minister"
        assert body["token_type"] == "bearer"
        assert body["expires_in"] > 0
        assert "hashed_password" not in body["user"]

    def test_wrong_password_and_unknown_account_are_indistinguishable(self, client, minister):
        wrong = client.post(
            "/api/v1/auth/login", json={"identifier": "minister@example.et", "password": "nope"}
        )
        unknown = client.post(
            "/api/v1/auth/login", json={"identifier": "nobody@example.et", "password": "nope"}
        )
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json() == unknown.json(), "responses must not reveal which accounts exist"

    async def test_deactivated_account_cannot_sign_in(self, client, make_user, db_session, test_password):
        user = await make_user(UserRole.FARMER, phone="+251911000222", is_active=False)
        r = client.post("/api/v1/auth/login", json={"identifier": user.phone, "password": test_password})
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "unauthorized"

    def test_repeated_failures_lock_the_account(self, client, farmer, test_password):
        for _ in range(8):
            client.post("/api/v1/auth/login", json={"identifier": farmer.phone, "password": "nope"})
        r = client.post("/api/v1/auth/login", json={"identifier": farmer.phone, "password": test_password})
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "account_locked"

    def test_successful_sign_in_clears_earlier_failures(self, client, farmer, test_password):
        for _ in range(3):
            client.post("/api/v1/auth/login", json={"identifier": farmer.phone, "password": "nope"})
        assert (
            client.post(
                "/api/v1/auth/login", json={"identifier": farmer.phone, "password": test_password}
            ).status_code
            == 200
        )
        for _ in range(5):
            client.post("/api/v1/auth/login", json={"identifier": farmer.phone, "password": "nope"})
        assert (
            client.post(
                "/api/v1/auth/login", json={"identifier": farmer.phone, "password": test_password}
            ).status_code
            == 200
        ), "the counter should have reset, so five failures must not lock the account"


class TestSession:
    def test_me_requires_a_token(self, client, farmer, sign_in):
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401
        me = client.get("/api/v1/auth/me", headers=sign_in(farmer.phone)["headers"])
        assert me.status_code == 200
        assert me.json()["woreda"]["name_en"] == "Sinan"

    def test_refresh_rotates_and_detects_reuse(self, client, farmer, sign_in):
        first = sign_in(farmer.phone)
        second = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert second.status_code == 200
        rotated = second.json()["refresh_token"]
        assert rotated != first["refresh_token"]

        replay = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert replay.status_code == 401, "a rotated token must not work twice"

        after_theft = client.post("/api/v1/auth/refresh", json={"refresh_token": rotated})
        assert after_theft.status_code == 401, "detecting reuse must end the whole session family"

        assert sign_in(farmer.phone)["access_token"], "signing in again must still work"

    def test_logout_revokes_the_session(self, client, farmer, sign_in):
        session = sign_in(farmer.phone)
        assert (
            client.post("/api/v1/auth/logout", json={"refresh_token": session["refresh_token"]}).status_code
            == 204
        )
        assert (
            client.post("/api/v1/auth/refresh", json={"refresh_token": session["refresh_token"]}).status_code
            == 401
        )
        # Logging out twice is harmless.
        assert (
            client.post("/api/v1/auth/logout", json={"refresh_token": session["refresh_token"]}).status_code
            == 204
        )

    def test_profile_update_and_password_change(self, client, farmer, sign_in, test_password):
        headers = sign_in(farmer.phone)["headers"]
        patched = client.patch(
            "/api/v1/auth/me", json={"locale": "am", "full_name": "Abebe K."}, headers=headers
        )
        assert patched.status_code == 200
        assert (patched.json()["locale"], patched.json()["full_name"]) == ("am", "Abebe K.")

        weak = client.post(
            "/api/v1/auth/me/password",
            json={"current_password": test_password, "new_password": "short"},
            headers=headers,
        )
        assert weak.status_code == 422

        wrong_current = client.post(
            "/api/v1/auth/me/password",
            json={"current_password": "not-it", "new_password": "a brand new passphrase"},
            headers=headers,
        )
        assert wrong_current.status_code == 401

        ok = client.post(
            "/api/v1/auth/me/password",
            json={"current_password": test_password, "new_password": "a brand new passphrase"},
            headers=headers,
        )
        assert ok.status_code == 204
        assert sign_in(farmer.phone, "a brand new passphrase")["access_token"]


class TestRoleAccess:
    def test_farmer_cannot_reach_the_ministry_dashboard(self, client, farmer, sign_in):
        r = client.get("/api/v1/dashboard/ministry", headers=sign_in(farmer.phone)["headers"])
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "forbidden"

    def test_minister_cannot_reach_farmer_endpoints(self, client, minister, sign_in):
        headers = sign_in(minister.email)["headers"]
        assert client.get("/api/v1/dashboard/farmer", headers=headers).status_code == 403
        assert client.get("/api/v1/farms", headers=headers).status_code == 403

    def test_unauthenticated_access_is_refused(self, client):
        for path in ("/api/v1/dashboard/ministry", "/api/v1/dashboard/farmer", "/api/v1/farms"):
            assert client.get(path).status_code == 401

    def test_forecast_endpoints_accept_a_signed_in_person(self, client, farmer, sign_in):
        assert client.get("/api/v1/drought/map", headers=sign_in(farmer.phone)["headers"]).status_code == 200

    def test_forecast_endpoints_accept_a_service_key(self, auth_client, farmer):
        assert auth_client.get("/api/v1/drought/map").status_code == 401
        assert auth_client.get("/api/v1/drought/map", headers={"X-API-Key": "secret-key"}).status_code == 200
