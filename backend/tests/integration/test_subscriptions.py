"""The ledger: what an agreement locks in, and what the platform may claim it earns."""

from __future__ import annotations

import datetime as dt

import pytest

TODAY = dt.date.today()


@pytest.fixture
def bureau(client, admin_headers, pricing_tiers):
    res = client.post(
        "/api/v1/organizations",
        json={"name": "Amhara Bureau", "stakeholder": "regional_government"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _subscribe(client, headers, org, **over):
    body = {
        "organization_id": org["id"],
        "billing_period": "annual",
        "started_on": str(TODAY - dt.timedelta(days=30)),
        "ends_on": str(TODAY + dt.timedelta(days=335)),
    } | over
    return client.post("/api/v1/subscriptions", json=body, headers=headers)


class TestSigning:
    def test_takes_the_rate_in_force_without_being_told(self, client, admin_headers, bureau) -> None:
        sub = _subscribe(client, admin_headers, bureau).json()
        assert sub["unit_price_cents"] == 180_000_000  # ETB 1,800,000 annual
        assert sub["currency"] == "ETB"

    def test_the_agreed_rate_survives_a_reprice(self, client, admin_headers, bureau) -> None:
        """The whole point of versioning the catalogue: a signed price must not move."""
        sub = _subscribe(client, admin_headers, bureau).json()
        client.post(
            "/api/v1/billing/pricing/regional_government",
            json={
                "one_time_cents": 1,
                "annual_cents": 999_000_000,
                "monthly_cents": 1,
                "daily_cents": 1,
                "effective_from": str(TODAY + dt.timedelta(days=1)),
            },
            headers=admin_headers,
        )
        again = client.get("/api/v1/subscriptions", headers=admin_headers).json()
        assert again[0]["id"] == sub["id"]
        assert again[0]["unit_price_cents"] == 180_000_000

    def test_quantity_multiplies_the_rate(self, client, admin_headers, bureau) -> None:
        sub = _subscribe(client, admin_headers, bureau, quantity=3).json()
        assert sub["annualised_cents"] == 180_000_000 * 3

    def test_refuses_a_period_the_tier_does_not_sell(self, client, admin_headers, pricing_tiers) -> None:
        farmer = client.post(
            "/api/v1/organizations",
            json={"name": "Lone Farmer", "stakeholder": "farmer_premium"},
            headers=admin_headers,
        ).json()
        # The farmer tier has no perpetual licence; a zero must not quietly become a free contract.
        res = _subscribe(client, admin_headers, farmer, billing_period="perpetual")
        assert res.status_code == 422
        assert "no perpetual rate" in res.json()["error"]["message"]

    def test_refuses_an_agreement_that_ends_before_it_starts(self, client, admin_headers, bureau) -> None:
        res = _subscribe(
            client, admin_headers, bureau, started_on=str(TODAY), ends_on=str(TODAY - dt.timedelta(days=1))
        )
        assert res.status_code == 422


class TestRevenue:
    def test_counts_signed_agreements_not_the_price_list(self, client, admin_headers, bureau) -> None:
        before = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert before["arr_cents"] == 0  # a full catalogue, nothing sold

        _subscribe(client, admin_headers, bureau)
        after = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert after["arr_cents"] == 180_000_000
        assert after["mrr_cents"] == 180_000_000 // 12
        assert after["active_subscriptions"] == 1

    def test_monthly_annualises_by_twelve(self, client, admin_headers, bureau) -> None:
        _subscribe(client, admin_headers, bureau, billing_period="monthly")
        rev = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        # Monthly is annual/10, so a year of it is 1.2x the annual rate — the premium for flexibility.
        assert rev["arr_cents"] == 18_000_000 * 12

    def test_a_perpetual_licence_adds_nothing_recurring(self, client, admin_headers, bureau) -> None:
        """It recurs never, so counting it as ARR would overstate the business."""
        _subscribe(client, admin_headers, bureau, billing_period="perpetual", ends_on=None)
        rev = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert rev["arr_cents"] == 0
        assert rev["perpetual_cents"] == 720_000_000  # reported, but on its own

    def test_an_agreement_that_has_not_started_is_not_revenue_yet(
        self, client, admin_headers, bureau
    ) -> None:
        _subscribe(
            client,
            admin_headers,
            bureau,
            started_on=str(TODAY + dt.timedelta(days=10)),
            ends_on=str(TODAY + dt.timedelta(days=375)),
        )
        assert client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()["arr_cents"] == 0

    def test_flags_renewals_inside_the_horizon(self, client, admin_headers, bureau) -> None:
        _subscribe(client, admin_headers, bureau, ends_on=str(TODAY + dt.timedelta(days=20)))
        rev = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert len(rev["renewals_due"]) == 1
        assert rev["renewals_due"][0]["days_to_renewal"] == 20

    def test_flags_an_agreement_still_active_past_its_end(self, client, admin_headers, bureau) -> None:
        """Revenue nobody has chased: active in the record, expired in fact."""
        _subscribe(
            client,
            admin_headers,
            bureau,
            started_on=str(TODAY - dt.timedelta(days=400)),
            ends_on=str(TODAY - dt.timedelta(days=5)),
        )
        rev = client.get("/api/v1/subscriptions/revenue", headers=admin_headers).json()
        assert len(rev["lapsed"]) == 1
        assert rev["arr_cents"] == 0  # and it is not counted as earning


class TestAccess:
    def test_revenue_is_admin_only(self, client, minister_headers) -> None:
        assert client.get("/api/v1/subscriptions/revenue", headers=minister_headers).status_code == 403
