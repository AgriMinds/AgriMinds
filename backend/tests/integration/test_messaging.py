"""Advisory delivery credits: what is sold, what is spent, and what is honestly claimed."""

from __future__ import annotations

import pytest


@pytest.fixture
def coop(client, admin_headers, pricing_tiers):
    return client.post(
        "/api/v1/organizations",
        json={"name": "Choke Farmers Cooperative", "stakeholder": "cooperative"},
        headers=admin_headers,
    ).json()


def _buy(client, headers, org, messages=50_000, price=60):
    return client.post(
        "/api/v1/messaging/bundles",
        json={"organization_id": org["id"], "messages": messages, "unit_price_cents": price},
        headers=headers,
    )


def _send(client, headers, org, recipient="+251911234567"):
    return client.post(
        "/api/v1/messaging/deliveries",
        json={"organization_id": org["id"], "recipient": recipient, "body": "ዝናብ ይጠበቃል", "locale": "am"},
        headers=headers,
    )


class TestBundles:
    def test_a_bundle_freezes_the_price_it_was_sold_at(self, client, admin_headers, coop) -> None:
        bundle = _buy(client, admin_headers, coop, messages=50_000, price=60).json()
        assert bundle["unit_price_cents"] == 60
        assert bundle["value_cents"] == 50_000 * 60  # ETB 30,000
        assert bundle["value"] == "30000.00"

    def test_balance_is_derived_from_the_rows(self, client, admin_headers, coop) -> None:
        _buy(client, admin_headers, coop, messages=1_000)
        _buy(client, admin_headers, coop, messages=500)
        bal = client.get(f"/api/v1/messaging/{coop['id']}/balance", headers=admin_headers).json()
        assert bal["purchased"] == 1_500 and bal["used"] == 0 and bal["remaining"] == 1_500
        assert len(bal["bundles"]) == 2


class TestDelivery:
    def test_a_delivery_spends_a_credit(self, client, admin_headers, coop) -> None:
        _buy(client, admin_headers, coop, messages=3)
        assert _send(client, admin_headers, coop).status_code == 201
        bal = client.get(f"/api/v1/messaging/{coop['id']}/balance", headers=admin_headers).json()
        assert bal["used"] == 1 and bal["remaining"] == 2

    def test_refuses_to_send_on_an_empty_balance(self, client, admin_headers, coop) -> None:
        res = _send(client, admin_headers, coop)
        assert res.status_code == 409
        assert "no message credits left" in res.json()["error"]["message"]

    def test_says_plainly_that_nothing_is_actually_sent(self, client, admin_headers, coop) -> None:
        """No aggregator is wired in. A queue that visibly never drains beats a false 'sent'."""
        _buy(client, admin_headers, coop, messages=2)
        assert _send(client, admin_headers, coop).json()["status"] == "queued"
        bal = client.get(f"/api/v1/messaging/{coop['id']}/balance", headers=admin_headers).json()
        assert bal["provider"] == "none"
        assert bal["deliverable"] is False

    def test_keeps_the_advisory_in_the_farmer_s_language(self, client, admin_headers, coop) -> None:
        _buy(client, admin_headers, coop, messages=2)
        sent = _send(client, admin_headers, coop).json()
        assert sent["locale"] == "am"
        assert sent["body"] == "ዝናብ ይጠበቃል"

    def test_normalises_the_phone_number(self, client, admin_headers, coop) -> None:
        _buy(client, admin_headers, coop, messages=2)
        sent = _send(client, admin_headers, coop, recipient="0911234567").json()
        assert sent["recipient"].startswith("+251")


class TestAccess:
    def test_credits_are_admin_only(self, client, minister_headers, coop) -> None:
        res = client.get(f"/api/v1/messaging/{coop['id']}/balance", headers=minister_headers)
        assert res.status_code == 403
