"""The front door: who may ask, what the answer reveals, and what approval creates."""

from __future__ import annotations

PASSWORD = "almaz-own-passphrase"

ENQUIRY = {
    "organization_name": "Choke Farmers Union",
    "contact_name": "Almaz Bekele",
    "stakeholder": "cooperative",
    "contact_email": "almaz@chokeunion.et",
    "password": PASSWORD,
    "message": "We represent 1,200 members across three woredas.",
}


class TestPublicEnquiry:
    def test_anyone_may_ask_without_an_account(self, client, db_ready) -> None:
        res = client.post("/api/v1/access-requests", json=ENQUIRY)
        assert res.status_code == 202, res.text
        assert res.json()["status"] == "new"

    def test_the_answer_never_reveals_who_is_already_a_customer(self, client, db_ready) -> None:
        """A sales form that confirms existing customers is a directory of who pays."""
        body = client.post("/api/v1/access-requests", json=ENQUIRY).json()
        # Twice for the same name: identical acknowledgement, no hint that one is known to us.
        again = client.post("/api/v1/access-requests", json=ENQUIRY).json()
        assert body["message"] == again["message"]
        assert set(body) == {"id", "status", "message"}

    def test_refuses_a_lead_nobody_can_reply_to(self, client, db_ready) -> None:
        res = client.post(
            "/api/v1/access-requests",
            json={"organization_name": "Silent Co", "contact_name": "Nobody"},
        )
        assert res.status_code == 422

    def test_the_inbox_itself_stays_private(self, client) -> None:
        assert client.get("/api/v1/admin/access-requests").status_code == 401


class TestFarmerUpgrade:
    def test_a_farmer_can_ask_to_leave_the_free_tier(self, client, farmer_headers) -> None:
        res = client.post(
            "/api/v1/access-requests/premium", json={"message": "Interested"}, headers=farmer_headers
        )
        assert res.status_code == 201
        assert res.json()["kind"] == "farmer_premium"
        # Identity comes from the token, so the farmer supplies only what we do not know.
        assert res.json()["contact_name"]

    def test_asking_twice_does_not_create_a_second_lead(self, client, farmer_headers) -> None:
        client.post("/api/v1/access-requests/premium", json={}, headers=farmer_headers)
        again = client.post("/api/v1/access-requests/premium", json={}, headers=farmer_headers)
        assert again.status_code == 409

    def test_a_farmer_can_see_what_happened_to_their_request(self, client, farmer_headers) -> None:
        assert client.get("/api/v1/access-requests/premium", headers=farmer_headers).json() is None
        client.post("/api/v1/access-requests/premium", json={}, headers=farmer_headers)
        mine = client.get("/api/v1/access-requests/premium", headers=farmer_headers).json()
        assert mine["status"] == "new"


class TestDeciding:
    def test_approval_creates_the_account(self, client, admin_headers, db_ready) -> None:
        enquiry = client.post("/api/v1/access-requests", json=ENQUIRY).json()
        res = client.post(
            f"/api/v1/admin/access-requests/{enquiry['id']}",
            json={"status": "approved", "stakeholder": "cooperative"},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        assert res.json()["request"]["organization_id"]  # traceable back to how it arrived

        orgs = client.get("/api/v1/organizations", headers=admin_headers).json()
        assert any(o["name"] == "Choke Farmers Union" for o in orgs)

    def test_the_enquirer_s_own_guess_is_not_binding(self, client, admin_headers, db_ready) -> None:
        """The price follows from the segment, so a cooperative cannot price itself as a ministry."""
        enquiry = client.post(
            "/api/v1/access-requests", json={**ENQUIRY, "stakeholder": "federal_ministry"}
        ).json()
        client.post(
            f"/api/v1/admin/access-requests/{enquiry['id']}",
            json={"status": "approved", "stakeholder": "cooperative"},
            headers=admin_headers,
        )
        orgs = client.get("/api/v1/organizations", headers=admin_headers).json()
        created = next(o for o in orgs if o["name"] == "Choke Farmers Union")
        assert created["stakeholder"] == "cooperative"

    def test_approving_without_a_segment_is_refused(self, client, admin_headers, db_ready) -> None:
        enquiry = client.post(
            "/api/v1/access-requests",
            json={k: v for k, v in ENQUIRY.items() if k != "stakeholder"},
        ).json()
        res = client.post(
            f"/api/v1/admin/access-requests/{enquiry['id']}",
            json={"status": "approved"},
            headers=admin_headers,
        )
        assert res.status_code == 422

    def test_a_decided_request_cannot_be_decided_again(self, client, admin_headers, db_ready) -> None:
        enquiry = client.post("/api/v1/access-requests", json=ENQUIRY).json()
        body = {"status": "declined", "note": "Out of scope"}
        assert (
            client.post(
                f"/api/v1/admin/access-requests/{enquiry['id']}", json=body, headers=admin_headers
            ).status_code
            == 200
        )
        assert (
            client.post(
                f"/api/v1/admin/access-requests/{enquiry['id']}", json=body, headers=admin_headers
            ).status_code
            == 409
        )

    def test_declining_creates_no_account(self, client, admin_headers, db_ready) -> None:
        enquiry = client.post("/api/v1/access-requests", json=ENQUIRY).json()
        client.post(
            f"/api/v1/admin/access-requests/{enquiry['id']}",
            json={"status": "declined", "note": "No budget this cycle"},
            headers=admin_headers,
        )
        orgs = client.get("/api/v1/organizations", headers=admin_headers).json()
        assert not any(o["name"] == "Choke Farmers Union" for o in orgs)


class TestContactAccount:
    """The enquirer chooses their password on the form; approval is what makes it work."""

    def _approve(self, client, admin_headers, enquiry: dict | None = None) -> dict:
        row = client.post("/api/v1/access-requests", json=enquiry or ENQUIRY).json()
        res = client.post(
            f"/api/v1/admin/access-requests/{row['id']}",
            json={"status": "approved", "stakeholder": "cooperative"},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        return res.json()

    def test_the_account_is_held_until_somebody_approves_it(self, client, db_ready) -> None:
        client.post("/api/v1/access-requests", json=ENQUIRY)
        res = client.post(
            "/api/v1/auth/login",
            json={"identifier": "almaz@chokeunion.et", "password": PASSWORD},
        )
        assert res.status_code == 401
        message = res.json()["error"]["message"]
        assert "waiting to be approved" in message
        # Not the farmer's wording: an institution is not waiting on a development agent.
        assert "holding" not in message

    def test_approval_lets_them_in_with_the_password_they_chose(
        self, client, admin_headers, db_ready
    ) -> None:
        """No link to relay and no credential read down a telephone."""
        body = self._approve(client, admin_headers)
        assert body["invited_email"] == "almaz@chokeunion.et"
        # Nothing to hand over: the password never left the person who chose it.
        assert body["invitation_token"] is None

        signed_in = client.post(
            "/api/v1/auth/login",
            json={"identifier": "almaz@chokeunion.et", "password": PASSWORD},
        )
        assert signed_in.status_code == 200, signed_in.text
        assert signed_in.json()["user"]["role"] == "agent"

    def test_the_new_account_reaches_its_own_plans_and_nothing_commercial(
        self, client, admin_headers, pricing_tiers
    ) -> None:
        self._approve(client, admin_headers)
        pair = client.post(
            "/api/v1/auth/login",
            json={"identifier": "almaz@chokeunion.et", "password": PASSWORD},
        ).json()
        headers = {"Authorization": f"Bearer {pair['access_token']}"}

        plans = client.get("/api/v1/plans", headers=headers)
        assert plans.status_code == 200, plans.text
        # Priced for the segment the administrator chose, not the one the enquirer guessed.
        assert plans.json()["stakeholder"] == "cooperative"
        assert client.get("/api/v1/admin/invoices", headers=headers).status_code == 403

    def test_declining_closes_the_account_it_created(self, client, admin_headers, db_ready) -> None:
        """Otherwise a refused organisation keeps a sign-in waiting for a later approval."""
        row = client.post("/api/v1/access-requests", json=ENQUIRY).json()
        client.post(
            f"/api/v1/admin/access-requests/{row['id']}",
            json={"status": "declined", "note": "Out of scope"},
            headers=admin_headers,
        )
        res = client.post(
            "/api/v1/auth/login",
            json={"identifier": "almaz@chokeunion.et", "password": PASSWORD},
        )
        assert res.status_code == 401
        message = res.json()["error"]["message"]
        assert "not approved" in message
        # Again not the farmer's wording: an institution appeals to whoever decided, not a DA.
        assert "development agent" not in message

    def test_a_weak_password_is_refused_on_the_form(self, client, db_ready) -> None:
        res = client.post("/api/v1/access-requests", json={**ENQUIRY, "password": "short"})
        assert res.status_code == 422, res.text

    def test_an_address_already_in_use_is_acknowledged_the_same_way(
        self, client, make_user, db_ready
    ) -> None:
        """This form is public, so a different answer would reveal who is already a customer."""
        fresh = client.post(
            "/api/v1/access-requests",
            json={**ENQUIRY, "contact_email": "nobody@chokeunion.et"},
        )
        taken = client.post("/api/v1/access-requests", json=ENQUIRY)
        again = client.post("/api/v1/access-requests", json=ENQUIRY)
        assert fresh.status_code == taken.status_code == again.status_code == 202
        assert set(taken.json()) == set(again.json()) == {"id", "status", "message"}
        assert taken.json()["message"] == again.json()["message"]

    def test_an_enquiry_reachable_only_by_phone_still_gets_an_account(
        self, client, admin_headers, db_ready
    ) -> None:
        """Staff usually sign in by email, but a number is an identifier too -- and it is all
        some callers have."""
        body = self._approve(
            client,
            admin_headers,
            {
                "organization_name": "Phone Only Union",
                "contact_name": "Kebede Alemu",
                "contact_phone": "+251911234567",
                "password": "kebede-own-passphrase",
            },
        )
        assert body["request"]["organization_id"]
        assert body["invited_email"] == "+251911234567"
        signed_in = client.post(
            "/api/v1/auth/login",
            json={"identifier": "0911234567", "password": "kebede-own-passphrase"},
        )
        assert signed_in.status_code == 200, signed_in.text
