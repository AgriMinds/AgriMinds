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
        options = {o["period"]: o for o in client.get("/api/v1/plans", headers=customer["headers"]).json()["options"]}
        assert options["annual"]["annualised_cents"] == 2_400_000
        assert options["monthly"]["annualised_cents"] == 200_000 * 12
        # This card charges essentially the same per year whichever period you pick: committing
        # for a year saves under 1%, which is the rate ladder being flat rather than a discount.
        assert options["annual"]["saving_vs_shortest_pct"] < 1.0

    def test_a_user_with_no_organisation_is_told_why_not(self, client, farmer_headers) -> None:
        res = client.get("/api/v1/plans", headers=farmer_headers)
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
        client.delete(
            f"/api/v1/subscriptions/{first['subscription']['id']}", headers=admin_headers
        )
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

    def test_a_fresh_bill_is_not_overdue_and_carries_its_due_date(self, client, customer, admin_headers) -> None:
        chosen = client.post("/api/v1/plans", json={"period": "annual"}, headers=customer["headers"]).json()
        outstanding = client.get("/api/v1/admin/invoices", headers=admin_headers).json()
        assert outstanding[0]["reference"] == chosen["invoice"]["reference"]
        assert outstanding[0]["overdue"] is False
        assert dt.date.fromisoformat(outstanding[0]["due_on"]) > dt.date.today()
