"""Opening an account for yourself, and the human check that has to follow it."""

from __future__ import annotations

from agriminds_api.db.models import Locale, UserRole

APPLICANT = {
    "full_name": "Almaz Tesfaye",
    "phone": "0911505050",
    "password": "a-long-enough-passphrase",
    "note": "Three plots in Sinan kebele 04. DA Getachew knows me.",
}


class TestSignup:
    def test_anyone_can_open_an_account(self, client, db_ready) -> None:
        res = client.post("/api/v1/signup", json=APPLICANT)
        assert res.status_code == 202, res.text
        assert res.json()["status"] == "pending"

    def test_the_account_cannot_be_signed_into_until_it_is_confirmed(self, client, db_ready) -> None:
        """The whole point: a form cannot prove somebody farms a plot in a kebele."""
        client.post("/api/v1/signup", json=APPLICANT)
        res = client.post(
            "/api/v1/auth/login",
            json={"identifier": "0911505050", "password": "a-long-enough-passphrase"},
        )
        assert res.status_code == 401
        assert "waiting to be confirmed" in res.json()["error"]["message"]

    def test_waiting_and_deactivated_are_not_the_same_message(self, client, make_user, db_ready) -> None:
        # One of them should wait; the other should stop trying. A single message for both tells
        # the first person to give up and the second to keep calling.
        client.post("/api/v1/signup", json=APPLICANT)
        pending = client.post(
            "/api/v1/auth/login",
            json={"identifier": "0911505050", "password": "a-long-enough-passphrase"},
        ).json()["error"]["message"]
        assert "deactivated" not in pending

    async def test_an_existing_number_gets_the_same_answer_as_a_new_one(self, client, make_user) -> None:
        """Otherwise the form is a way to discover who is registered, one number at a time."""
        await make_user(UserRole.FARMER, phone="+251911505050", full_name="Already Here")

        fresh = client.post("/api/v1/signup", json={**APPLICANT, "phone": "0911707070"})
        taken = client.post("/api/v1/signup", json=APPLICANT)
        assert fresh.status_code == taken.status_code == 202
        assert fresh.json() == taken.json()

    def test_a_weak_password_is_refused(self, client, db_ready) -> None:
        res = client.post("/api/v1/signup", json={**APPLICANT, "password": "short"})
        assert res.status_code == 422

    def test_a_number_nobody_can_call_is_refused(self, client, db_ready) -> None:
        # A development agent confirms by phoning. An uncallable number cannot be confirmed.
        res = client.post("/api/v1/signup", json={**APPLICANT, "phone": "12345"})
        assert res.status_code == 422


class TestApprovalQueue:
    def _apply(self, client, phone: str = "0911505050") -> None:
        assert client.post("/api/v1/signup", json={**APPLICANT, "phone": phone}).status_code == 202

    def test_staff_see_who_is_waiting_and_what_they_said(self, client, agent_headers, db_ready) -> None:
        self._apply(client)
        rows = client.get("/api/v1/staff/signups", headers=agent_headers).json()
        assert [r["full_name"] for r in rows] == ["Almaz Tesfaye"]
        # The note is the only thing an agent has to check against what they know of the area.
        assert "Sinan kebele 04" in rows[0]["note"]

    def test_the_queue_is_not_public(self, client) -> None:
        assert client.get("/api/v1/staff/signups").status_code == 401

    def test_a_farmer_cannot_approve_themselves(self, client, farmer_headers, db_ready) -> None:
        self._apply(client)
        assert client.get("/api/v1/staff/signups", headers=farmer_headers).status_code == 403

    def test_approval_lets_them_in(self, client, agent_headers, db_ready) -> None:
        self._apply(client)
        waiting = client.get("/api/v1/staff/signups", headers=agent_headers).json()[0]
        decided = client.post(
            f"/api/v1/staff/signups/{waiting['id']}", json={"approve": True}, headers=agent_headers
        )
        assert decided.status_code == 200, decided.text

        signed_in = client.post(
            "/api/v1/auth/login",
            json={"identifier": "0911505050", "password": "a-long-enough-passphrase"},
        )
        assert signed_in.status_code == 200, signed_in.text
        assert signed_in.json()["user"]["role"] == "farmer"

    def test_a_refusal_says_so_rather_than_failing_silently(self, client, agent_headers, db_ready) -> None:
        self._apply(client)
        waiting = client.get("/api/v1/staff/signups", headers=agent_headers).json()[0]
        client.post(
            f"/api/v1/staff/signups/{waiting['id']}",
            json={"approve": False, "note": "No holding at that kebele."},
            headers=agent_headers,
        )
        res = client.post(
            "/api/v1/auth/login",
            json={"identifier": "0911505050", "password": "a-long-enough-passphrase"},
        )
        assert res.status_code == 401
        assert "not approved" in res.json()["error"]["message"]

    def test_a_decided_account_leaves_the_queue(self, client, agent_headers, db_ready) -> None:
        self._apply(client)
        waiting = client.get("/api/v1/staff/signups", headers=agent_headers).json()[0]
        client.post(f"/api/v1/staff/signups/{waiting['id']}", json={"approve": True}, headers=agent_headers)
        assert client.get("/api/v1/staff/signups", headers=agent_headers).json() == []

    def test_it_cannot_be_decided_twice(self, client, agent_headers, db_ready) -> None:
        self._apply(client)
        waiting = client.get("/api/v1/staff/signups", headers=agent_headers).json()[0]
        body = {"approve": True}
        url = f"/api/v1/staff/signups/{waiting['id']}"
        assert client.post(url, json=body, headers=agent_headers).status_code == 200
        assert client.post(url, json=body, headers=agent_headers).status_code == 409

    def test_existing_accounts_are_not_locked_out_by_the_new_gate(self, client, farmer_headers) -> None:
        """Everyone who arrived by seeding or invitation is approved; the default must not trap them."""
        assert client.get("/api/v1/auth/me", headers=farmer_headers).status_code == 200


class TestLocaleCodes:
    """`or` is Afaan Oromoo everywhere: the column, the catalogues and every endpoint."""

    def test_the_agent_accepts_the_same_code_the_interface_sends(self, client, farmer_headers) -> None:
        # The frontend sends the locale from its own catalogue, which is `or`. An endpoint that
        # accepted only `om` would reject every Oromo-speaking farmer with a validation error.
        res = client.post("/api/v1/agent/ask", json={"text": "1", "locale": "or"}, headers=farmer_headers)
        assert res.status_code == 200, res.text

    async def test_an_oromo_speaker_s_own_setting_reaches_the_hotline(
        self, client, make_user, make_farm, artifacts_dir
    ) -> None:
        """A farmer cannot pick a language over SMS, so the account's own setting has to work."""
        assert Locale.OM.value == "or"
        user = await make_user(UserRole.FARMER, phone="+251911808080", locale=Locale.OM, woreda_code="SNN")
        await make_farm(user, row=2, col=2, name="Lafa koo")

        body = client.post("/api/v1/hotline/inbound", json={"caller": "0911808080", "text": "1"}).json()
        assert body["locale"] == "or"
        # Afaan Oromoo is Latin script, so the proof is the wording, not the alphabet.
        assert "carraa hongee" in body["reply"]

    def test_signup_accepts_it_too(self, client, db_ready) -> None:
        res = client.post("/api/v1/signup", json={**APPLICANT, "phone": "0911606060", "locale": "or"})
        assert res.status_code == 202, res.text


def test_the_role_enum_is_unchanged() -> None:
    assert UserRole.FARMER.value == "farmer"
