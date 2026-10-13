"""The front door: who may ask, what the answer reveals, and what approval creates."""

from __future__ import annotations

ENQUIRY = {
    "organization_name": "Choke Farmers Union",
    "contact_name": "Almaz Bekele",
    "stakeholder": "cooperative",
    "contact_email": "almaz@chokeunion.et",
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


class TestInvitation:
    """Approval has to end in an account somebody can sign in to, or it ends in a locked door."""

    def _approve(self, client, admin_headers, enquiry: dict | None = None) -> dict:
        row = client.post("/api/v1/access-requests", json=enquiry or ENQUIRY).json()
        res = client.post(
            f"/api/v1/admin/access-requests/{row['id']}",
            json={"status": "approved", "stakeholder": "cooperative"},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        return res.json()

    def test_approval_hands_back_an_invitation_for_the_contact(self, client, admin_headers, db_ready) -> None:
        body = self._approve(client, admin_headers)
        assert body["invited_email"] == "almaz@chokeunion.et"
        assert body["invitation_token"]
        assert body["invitation_expires_at"]

    def test_the_token_is_never_returned_a_second_time(self, client, admin_headers, db_ready) -> None:
        """Only the hash is stored, so re-reading the request cannot show it -- by construction."""
        body = self._approve(client, admin_headers)
        inbox = client.get("/api/v1/admin/access-requests", headers=admin_headers).json()
        assert body["invitation_token"] not in str(inbox)

    def test_accepting_sets_a_password_and_signs_the_person_in(self, client, admin_headers, db_ready) -> None:
        token = self._approve(client, admin_headers)["invitation_token"]
        res = client.post(f"/api/v1/auth/invitations/{token}", json={"password": "a-long-enough-passphrase"})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["access_token"]
        assert body["user"]["email"] == "almaz@chokeunion.et"
        # The account is institutional staff, not an operator of the platform.
        assert body["user"]["role"] == "agent"

    def test_the_new_account_can_reach_its_own_plans_and_nothing_commercial(
        self, client, admin_headers, pricing_tiers
    ) -> None:
        """The whole point of the invitation: the loop from approval to a payable plan closes."""
        token = self._approve(client, admin_headers)["invitation_token"]
        pair = client.post(
            f"/api/v1/auth/invitations/{token}", json={"password": "a-long-enough-passphrase"}
        ).json()
        headers = {"Authorization": f"Bearer {pair['access_token']}"}

        plans = client.get("/api/v1/plans", headers=headers)
        assert plans.status_code == 200, plans.text
        # Priced for the segment the administrator chose, not the one the enquirer guessed.
        assert plans.json()["stakeholder"] == "cooperative"
        # Customers do not get the administrator's view of everyone else's money.
        assert client.get("/api/v1/admin/invoices", headers=headers).status_code == 403

    def test_an_invitation_works_once(self, client, admin_headers, db_ready) -> None:
        token = self._approve(client, admin_headers)["invitation_token"]
        body = {"password": "a-long-enough-passphrase"}
        assert client.post(f"/api/v1/auth/invitations/{token}", json=body).status_code == 200
        # A second use would let anyone holding a relayed token reset the password later.
        assert client.post(f"/api/v1/auth/invitations/{token}", json=body).status_code == 401

    def test_a_weak_password_is_refused_by_the_configured_policy(
        self, client, admin_headers, db_ready
    ) -> None:
        token = self._approve(client, admin_headers)["invitation_token"]
        res = client.post(f"/api/v1/auth/invitations/{token}", json={"password": "short"})
        assert res.status_code == 422, res.text
        # And the invitation survives, so a fumbled first try does not cost the account.
        assert (
            client.post(
                f"/api/v1/auth/invitations/{token}", json={"password": "a-long-enough-passphrase"}
            ).status_code
            == 200
        )

    def test_an_unknown_token_is_indistinguishable_from_a_spent_one(self, client, db_ready) -> None:
        res = client.post(
            "/api/v1/auth/invitations/not-a-real-token", json={"password": "a-long-enough-passphrase"}
        )
        assert res.status_code == 401

    def test_an_enquiry_without_an_email_is_approved_but_invites_nobody(
        self, client, admin_headers, db_ready
    ) -> None:
        """Staff sign in with an email address. Inventing one creates an unusable account."""
        body = self._approve(
            client,
            admin_headers,
            {
                "organization_name": "Phone Only Union",
                "contact_name": "Kebede Alemu",
                "contact_phone": "+251911234567",
            },
        )
        assert body["request"]["organization_id"]  # the account still exists
        assert body["invited_email"] is None
        assert body["invitation_token"] is None
