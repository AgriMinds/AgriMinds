"""The pricing catalogue: who may read it, and what a price change is allowed to do."""

from __future__ import annotations

import datetime as dt

STAKEHOLDERS = {
    "farmer_premium",
    "cooperative",
    "development_agent",
    "regional_government",
    "federal_ministry",
    "research",
    "international_partner",
    "private_sector",
}


class TestAccess:
    def test_pricing_is_admin_only(self, client, minister_headers) -> None:
        # A minister runs the watershed and still has no business reading the rate card.
        assert client.get("/api/v1/billing/pricing", headers=minister_headers).status_code == 403

    def test_signed_out_is_refused(self, client) -> None:
        assert client.get("/api/v1/billing/pricing").status_code == 401


class TestCatalogue:
    def test_prices_every_stakeholder_once(self, client, admin_headers, pricing_tiers) -> None:
        body = client.get("/api/v1/billing/pricing", headers=admin_headers).json()
        assert {t["stakeholder"] for t in body["tiers"]} == STAKEHOLDERS
        assert all(t["is_current"] for t in body["tiers"])

    def test_money_crosses_as_integers_and_as_text(self, client, admin_headers, pricing_tiers) -> None:
        """A client that renders a price must never have to divide by 100 itself."""
        body = client.get("/api/v1/billing/pricing", headers=admin_headers).json()
        assert body["currency"] == "ETB"
        tiers = {t["stakeholder"]: t for t in body["tiers"]}
        coop = tiers["cooperative"]["rates"]
        # Santim, the minor unit of the birr, exactly as cents are for a dollar.
        assert coop["annual_cents"] == 3_000_000
        assert coop["annual"] == "30000.00"
        farmer = tiers["farmer_premium"]["rates"]
        # 0.41 birr a day is exactly representable in santim and not in binary floating point.
        assert farmer["daily_cents"] == 41
        assert farmer["daily"] == "0.41"

    def test_the_unit_is_part_of_the_price(self, client, admin_headers, pricing_tiers) -> None:
        tiers = {t["stakeholder"]: t for t in client.get("/api/v1/billing/pricing", headers=admin_headers).json()["tiers"]}
        assert tiers["development_agent"]["unit"] == "per woreda"

    def test_states_its_own_annual_total(self, client, admin_headers, pricing_tiers) -> None:
        body = client.get("/api/v1/billing/pricing", headers=admin_headers).json()
        assert body["annual_total_cents"] == sum(t["rates"]["annual_cents"] for t in body["tiers"])


class TestReprice:
    def _change(self, **over):
        base = {
            "one_time_cents": 300_000,
            "annual_cents": 75_000,
            "monthly_cents": 7_500,
            "daily_cents": 205,
            "effective_from": str(dt.date.today() + dt.timedelta(days=30)),
        }
        return base | over

    def test_a_change_supersedes_rather_than_rewrites(self, client, admin_headers, pricing_tiers) -> None:
        res = client.post(
            "/api/v1/billing/pricing/cooperative", json=self._change(), headers=admin_headers
        )
        assert res.status_code == 201, res.text

        history = client.get("/api/v1/billing/pricing/cooperative", headers=admin_headers).json()
        assert len(history) == 2
        current, superseded = history[0], history[1]
        assert current["is_current"] and current["rates"]["annual_cents"] == 75_000
        # The old rate is still readable at the number it was actually charged at.
        assert not superseded["is_current"] and superseded["rates"]["annual_cents"] == 3_000_000
        assert superseded["effective_to"] == current["effective_from"]

    def test_only_one_price_is_ever_in_force(self, client, admin_headers, pricing_tiers) -> None:
        client.post("/api/v1/billing/pricing/research", json=self._change(), headers=admin_headers)
        history = client.get("/api/v1/billing/pricing/research", headers=admin_headers).json()
        assert sum(1 for t in history if t["is_current"]) == 1

    def test_refuses_a_date_before_the_price_in_force(self, client, admin_headers, pricing_tiers) -> None:
        res = client.post(
            "/api/v1/billing/pricing/research",
            json=self._change(effective_from=str(dt.date.today() - dt.timedelta(days=365))),
            headers=admin_headers,
        )
        assert res.status_code == 409

    def test_refuses_a_tier_with_no_rate_at_all(self, client, admin_headers, pricing_tiers) -> None:
        res = client.post(
            "/api/v1/billing/pricing/research",
            json=self._change(one_time_cents=0, annual_cents=0, monthly_cents=0, daily_cents=0),
            headers=admin_headers,
        )
        assert res.status_code == 422

    def test_refuses_negative_money(self, client, admin_headers, pricing_tiers) -> None:
        res = client.post(
            "/api/v1/billing/pricing/research",
            json=self._change(annual_cents=-1),
            headers=admin_headers,
        )
        assert res.status_code == 422

    def test_refuses_a_stakeholder_it_does_not_price(self, client, admin_headers, pricing_tiers) -> None:
        res = client.post(
            "/api/v1/billing/pricing/space_agency", json=self._change(), headers=admin_headers
        )
        assert res.status_code == 422
