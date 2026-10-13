"""Self-serve: choosing a plan, the bill it raises, and when the plan actually starts."""

from __future__ import annotations

import datetime as dt

import pytest_asyncio

from agriminds_api.db.models import Organization, StakeholderType


@pytest_asyncio.fixture
async def customer(db_session, make_user, sign_in, pricing_tiers):
    """A cooperative, and a person who belongs to it."""
    org = Organization(name="Choke Farmers Union", stakeholder=StakeholderType.COOPERATIVE)
    db_session.add(org)
    await db_session.commit()
    user = await make_user("agent", email="buyer@chokeunion.et")
    user.organization_id = org.id
    db_session.add(user)
    await db_session.commit()
    return {"org": org, "headers": sign_in(user.email)["headers"]}


class TestPlans:
    def test_shows_only_the_caller_s_own_segment(self, client, customer) -> None:
        body = client.get("/api/v1/plans", headers=customer["headers"]).json()
        # A cooperative cannot shop at a research rate: the price follows from the segment.
        assert body["stakeholder"] == "cooperative"
        assert body["label"] == "Cooperatives & farmer unions"

    def test_leaves_out_periods_the_tier_does_not_sell(self, client, customer) -> None:
        body = client.get("/api/v1/plans", headers=customer["headers"]).json()
        periods = {o["period"] for o in body["options"]}
        # Every tier carries a zero one-off in this model; a zero is not a free perpetual licence.
        assert "perpetual" not in periods
        assert {"annual", "monthly", "daily"} <= periods

    def test_states_what_a_year_on_each_period_costs(self, client, customer) -> None:
        """The comparison a customer would otherwise do by hand, and often not do at all."""
        options = {
            o["period"]: o for o in client.get("/api/v1/plans", headers=customer["headers"]).json()["options"]
        }
        assert options["annual"]["annualised_cents"] == 2_400_000
        assert options["monthly"]["annualised_cents"] == 200_000 * 12
        # This card charges essentially the same per year whichever period you pick: committing
        # for a year saves under 1%, which is the rate ladder being flat rather than a discount.
        assert options["annual"]["saving_vs_shortest_pct"] < 1.0

    def test_a_farmer_who_has_not_asked_is_pointed_at_the_request(self, client, farmer_headers) -> None:
        # A farmer has no organisation and should not be told to find one: the premium tier is
        # theirs to buy, once an officer has approved the request.
        res = client.get("/api/v1/plans", headers=farmer_headers)
        assert res.status_code == 403
        assert "from your dashboard" in res.json()["error"]["message"]

    def test_staff_with_no_organisation_are_told_why_not(self, client, admin_headers) -> None:
        # A platform administrator buys from nobody, so there is genuinely nothing to subscribe.
        res = client.get("/api/v1/plans", headers=admin_headers)
        assert res.status_code == 403
        assert "not linked to an organisation" in res.json()["error"]["message"]


class TestChoosing:
    def test_choosing_raises_a_bill_and_does_not_start_the_plan(self, client, customer) -> None:
        res = client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"])
        assert res.status_code == 201, res.text
        body = res.json()

        # The subscription exists, and is explicitly not yet earning.
        assert body["subscription"]["status"] == "pending_payment"
        assert body["invoice"]["status"] == "issued"
        assert body["invoice"]["amount_cents"] == 2_400_000
        assert body["invoice"]["reference"].startswith("AGM-")
        assert body["pay_to"]

    def test_the_bill_is_not_counted_as_revenue_until_settled(self, client, customer, admin_headers) -> None:
        client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"])
        rev = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        # An unpaid subscription in ARR would turn a record into a forecast.
        assert rev["arr_cents"] == 0

    def test_quantity_multiplies_the_bill(self, client, customer) -> None:
        body = client.post(
            "/api/v1/plans", json={"period": "annual", "quantity": 4}, headers=customer["headers"]
        ).json()
        assert body["invoice"]["amount_cents"] == 2_400_000 * 4

    def test_refuses_a_second_plan_while_one_is_live(self, client, customer) -> None:
        client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"])
        again = client.post("/api/v1/plans", json={"period": "monthly"}, headers=customer["headers"])
        assert again.status_code == 409

    def test_references_are_unique(self, client, customer, admin_headers) -> None:
        first = client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"]).json()
        # End the plan so a second may be chosen, then compare the two references.
        client.delete(f"/api/v1/subscriptions/{first['subscription']['id']}", headers=admin_headers)
        second = client.post("/api/v1/plans", json={"period": "monthly"}, headers=customer["headers"]).json()
        assert first["invoice"]["reference"] != second["invoice"]["reference"]


class TestConfirmingPayment:
    def test_settling_the_bill_starts_the_plan_and_the_revenue(self, client, customer, admin_headers) -> None:
        chosen = client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"]).json()

        res = client.post(
            f"/api/v1/admin/invoices/{chosen['invoice']['id']}/paid",
            json={"method": "telebirr", "payment_reference": "TB-9931"},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "paid"

        rev = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert rev["arr_cents"] == 2_400_000
        assert rev["active_subscriptions"] == 1

    def test_a_settled_bill_cannot_be_settled_twice(self, client, customer, admin_headers) -> None:
        chosen = client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"]).json()
        body = {"method": "bank_transfer"}
        url = f"/api/v1/admin/invoices/{chosen['invoice']['id']}/paid"
        assert client.post(url, json=body, headers=admin_headers).status_code == 200
        assert client.post(url, json=body, headers=admin_headers).status_code == 409

    def test_the_customer_can_see_their_own_bills(self, client, customer) -> None:
        client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"])
        mine = client.get("/api/v1/plans/invoices", headers=customer["headers"]).json()
        assert len(mine) == 1 and mine[0]["status"] == "issued"

    def test_a_fresh_bill_is_not_overdue_and_carries_its_due_date(
        self, client, customer, admin_headers
    ) -> None:
        chosen = client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"]).json()
        outstanding = client.get("/api/v1/admin/invoices", headers=admin_headers).json()
        assert outstanding[0]["reference"] == chosen["invoice"]["reference"]
        assert outstanding[0]["overdue"] is False
        assert dt.date.fromisoformat(outstanding[0]["due_on"]) > dt.date.today()


@pytest_asyncio.fixture
async def premium_farmer(client, db_session, make_user, sign_in, admin_headers, pricing_tiers):
    """A farmer whose premium request an administrator has approved.

    The approval is made through the API rather than by writing the row, because the approval is
    the gate the farmer's access depends on and a fixture that forged it would not test it.
    """
    user = await make_user("farmer", phone="+251911777777", full_name="Abebe Kebede")
    headers = sign_in(user.phone)["headers"]
    asked = client.post("/api/v1/access-requests/premium", json={"message": "Two plots."}, headers=headers)
    assert asked.status_code in (200, 201), asked.text
    decided = client.post(
        f"/api/v1/admin/access-requests/{asked.json()['id']}",
        json={"status": "approved"},
        headers=admin_headers,
    )
    assert decided.status_code == 200, decided.text
    return {"user": user, "headers": headers}


class TestFarmerPremium:
    """The farmer was priced, given a request form, approved -- and then could not buy anything."""

    def test_an_approved_farmer_is_offered_their_own_tier(self, client, premium_farmer) -> None:
        res = client.get("/api/v1/plans", headers=premium_farmer["headers"])
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["stakeholder"] == "farmer_premium"
        # Priced per year only: the farmer card carries no monthly or daily rate, and a zero is
        # left out rather than offered as free.
        assert [o["period"] for o in body["options"]] == ["annual"]

    def test_choosing_bills_the_farmer_by_name(self, client, premium_farmer) -> None:
        res = client.post("/api/v1/plans", json={"period": "annual"}, headers=premium_farmer["headers"])
        assert res.status_code == 201, res.text
        body = res.json()
        # No organisation exists to address this to, which is the whole point of the change.
        assert body["invoice"]["organization_id"] is None
        assert body["invoice"]["payer_name"] == "Abebe Kebede"
        assert body["subscription"]["payer_kind"] == "farmer"
        assert body["subscription"]["status"] == "pending_payment"
        assert body["invoice"]["reference"].startswith("AGM-")

    def test_the_premium_only_starts_once_somebody_confirms_the_money(
        self, client, premium_farmer, admin_headers
    ) -> None:
        invoice = client.post(
            "/api/v1/plans", json={"period": "annual"}, headers=premium_farmer["headers"]
        ).json()["invoice"]

        before = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert all(r["stakeholder"] != "farmer_premium" for r in before["by_stakeholder"])

        paid = client.post(
            f"/api/v1/admin/invoices/{invoice['id']}/paid",
            json={"method": "telebirr", "payment_reference": "TB-1"},
            headers=admin_headers,
        )
        assert paid.status_code == 200, paid.text

        after = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        farmers = next(r for r in after["by_stakeholder"] if r["stakeholder"] == "farmer_premium")
        assert farmers["subscriptions"] == 1
        assert (
            client.get("/api/v1/plans", headers=premium_farmer["headers"]).json()["current"]["status"]
            == "active"
        )

    def test_a_farmer_sees_their_own_bill_and_no_one_else_s(self, client, premium_farmer, customer) -> None:
        client.post("/api/v1/plans", json={"period": "annual"}, headers=premium_farmer["headers"])
        client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"])

        mine = client.get("/api/v1/plans/invoices", headers=premium_farmer["headers"]).json()
        assert [i["payer_name"] for i in mine] == ["Abebe Kebede"]

    def test_the_administrator_sees_the_farmer_bill_waiting(
        self, client, premium_farmer, admin_headers
    ) -> None:
        # It needs the same human step as a ministry's: somebody has to confirm the money came.
        client.post("/api/v1/plans", json={"period": "annual"}, headers=premium_farmer["headers"])
        outstanding = client.get("/api/v1/admin/invoices", headers=admin_headers).json()
        assert [i["payer_name"] for i in outstanding] == ["Abebe Kebede"]

    def test_premium_is_per_farmer_so_a_quantity_is_refused(self, client, premium_farmer) -> None:
        # Otherwise a stray quantity silently multiplies the bill with nothing to show for it.
        res = client.post(
            "/api/v1/plans", json={"period": "annual", "quantity": 10}, headers=premium_farmer["headers"]
        )
        assert res.status_code == 422, res.text

    def test_the_term_bought_has_an_end_so_it_can_be_renewed(self, client, premium_farmer) -> None:
        # Open-ended meant no plan ever reached a renewal date, for farmers or institutions.
        body = client.post(
            "/api/v1/plans", json={"period": "annual"}, headers=premium_farmer["headers"]
        ).json()
        started = dt.date.fromisoformat(body["subscription"]["started_on"])
        assert dt.date.fromisoformat(body["subscription"]["ends_on"]) == started.replace(
            year=started.year + 1
        )

    def test_the_institutional_accounts_list_stays_institutional(
        self, client, premium_farmer, customer, admin_headers
    ) -> None:
        """One row per farmer would bury the accounts an account manager actually works."""
        client.post("/api/v1/plans", json={"period": "annual"}, headers=premium_farmer["headers"])
        rows = client.get("/api/v1/subscriptions", headers=admin_headers).json()
        assert all(r["payer_kind"] == "organization" for r in rows)
