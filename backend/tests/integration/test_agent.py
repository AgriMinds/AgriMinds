"""The farmer agent, and the 977 hotline that carries it to a phone without a browser."""

from __future__ import annotations

import hashlib
import hmac
import json

import pytest

from agriminds_api.db.models import Crop, Locale, UserRole
from agriminds_api.services.agent import detect_intent, fit_to_sms


@pytest.fixture
async def farmer(make_user, make_farm, sign_in):
    user = await make_user(
        UserRole.FARMER, phone="+251911222333", full_name="Abebe Kebede", woreda_code="SNN"
    )
    await make_farm(user, row=3, col=3, area=0.9, crop=Crop.TEF, name="Upper field")
    await make_farm(user, row=4, col=4, area=2.7, crop=Crop.TEF, name="Lower field")
    return {"user": user, "headers": sign_in(user.phone)["headers"]}


class TestIntent:
    """A feature-phone user types one word or one digit. Both have to land."""

    @pytest.mark.parametrize(
        ("text", "expected"),
        [
            ("1", "risk"),
            ("2", "planting"),
            ("when should i plant", "planting"),
            ("መቼ መዝራት", "planting"),
            ("yoom facaasuu", "planting"),
            ("ድርቅ", "risk"),
            ("bishaan", "water"),
            ("my plots", "plots"),
            ("", "menu"),
            ("hello", "menu"),
        ],
    )
    def test_reads_the_question(self, text, expected) -> None:
        assert detect_intent(text) == expected

    def test_matches_whole_words_only(self) -> None:
        # "watershed" contains "water" but is not a question about irrigation.
        assert detect_intent("watershed") == "menu"

    def test_an_amharic_reply_is_cut_to_what_a_handset_shows(self) -> None:
        """Ethiopic is UCS-2, so it fits 70 characters a segment, not 160."""
        assert len(fit_to_sms("ሀ" * 400)) <= 140
        assert len(fit_to_sms("a" * 400)) <= 320
        # Cut on a word boundary and marked, rather than stopping mid-word.
        assert fit_to_sms("word " * 200).endswith("…")


class TestAgent:
    def test_answers_from_the_farmer_s_own_worst_plot(self, client, farmer, artifacts_dir) -> None:
        res = client.post("/api/v1/agent/ask", json={"text": "what is my risk"}, headers=farmer["headers"])
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["intent"] == "risk"
        assert "%" in body["text"]
        # Traceable: which plot, which rule version, which lead produced the sentence.
        assert body["farm_id"]
        assert any(s.startswith("farm:") for s in body["sources"])
        assert any(s.startswith("advisory:") for s in body["sources"])

    def test_the_english_answer_is_the_engine_s_own_sentence(self, client, farmer, artifacts_dir) -> None:
        """The chat must not drift from the advisory card the farmer also sees."""
        asked = client.post(
            "/api/v1/agent/ask", json={"text": "when do i plant"}, headers=farmer["headers"]
        ).json()
        dash = client.get("/api/v1/dashboard/farmer", headers=farmer["headers"]).json()
        assert dash["advisory"]["planting_window"] in asked["text"]

    def test_answers_in_amharic_without_the_english_sentence(self, client, farmer, artifacts_dir) -> None:
        body = client.post(
            "/api/v1/agent/ask",
            json={"text": "መቼ መዝራት", "locale": "am"},
            headers=farmer["headers"],
        ).json()
        assert body["locale"] == "am"
        assert any("ሀ" <= c <= "፿" for c in body["text"])

    def test_a_digit_works_like_the_hotline_menu(self, client, farmer, artifacts_dir) -> None:
        body = client.post("/api/v1/agent/ask", json={"text": "3"}, headers=farmer["headers"]).json()
        assert body["intent"] == "water"

    def test_lists_the_plots_it_knows_about(self, client, farmer, artifacts_dir) -> None:
        body = client.post("/api/v1/agent/ask", json={"text": "my plots"}, headers=farmer["headers"]).json()
        assert "Upper field" in body["text"]
        assert "Lower field" in body["text"]

    def test_reports_what_the_answer_would_cost_to_text(self, client, farmer, artifacts_dir) -> None:
        # The hotline is free to the farmer, so the platform pays per segment. Hiding that until
        # the first carrier invoice is how a free service becomes an unbudgeted one.
        body = client.post("/api/v1/agent/ask", json={"text": "1"}, headers=farmer["headers"]).json()
        assert body["sms_segments"] >= 1

    def test_a_farmer_with_no_plots_is_told_what_to_do(self, client, farmer_headers) -> None:
        body = client.post("/api/v1/agent/ask", json={"text": "my risk"}, headers=farmer_headers).json()
        assert "development agent" in body["text"]

    def test_staff_do_not_get_a_farmer_s_agent(self, client, admin_headers) -> None:
        res = client.post("/api/v1/agent/ask", json={"text": "1"}, headers=admin_headers)
        assert res.status_code == 403


class TestHotline:
    """What a phone with no browser gets. Nothing here may claim to have been delivered."""

    def test_a_registered_number_gets_an_answer_for_its_own_land(self, client, farmer, artifacts_dir) -> None:
        res = client.post(
            "/api/v1/hotline/inbound", json={"caller": "0911222333", "text": "1", "channel": "sms"}
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["registered"] is True
        assert body["intent"] == "risk"
        assert body["short_code"] == "977"
        assert "Upper field" in body["reply"] or "Lower field" in body["reply"]

    def test_nothing_is_reported_as_delivered_without_a_carrier(self, client, farmer, artifacts_dir) -> None:
        body = client.post("/api/v1/hotline/inbound", json={"caller": "0911222333", "text": "1"}).json()
        assert body["delivered"] is False
        assert body["provider"] == "none"
        # And it says why, so the row is not mistaken for a failure of the agent.
        assert "aggregator" in (body["note"] or "")

    def test_an_unknown_caller_is_helped_and_still_recorded(self, client, db_ready) -> None:
        """Those rows are the only record of demand from farmers nobody has registered."""
        body = client.post("/api/v1/hotline/inbound", json={"caller": "0911999888", "text": "1"}).json()
        assert body["registered"] is False
        assert "register" in body["reply"].lower()

    def test_a_ussd_session_always_ends_with_the_menu_again(self, client, farmer, artifacts_dir) -> None:
        # A menu-driven caller cannot type a question, so the options have to come back every turn.
        body = client.post(
            "/api/v1/hotline/inbound",
            json={"caller": "0911222333", "text": "1", "channel": "ussd", "session_id": "s1"},
        ).json()
        assert "977" in body["reply"]

    def test_an_sms_reply_is_not_padded_with_a_menu(self, client, farmer, artifacts_dir) -> None:
        # Every extra segment is paid for by the platform, on every message, forever.
        body = client.post(
            "/api/v1/hotline/inbound", json={"caller": "0911222333", "text": "1", "channel": "sms"}
        ).json()
        assert "Reply:" not in body["reply"]

    async def test_the_farmer_s_own_language_is_used_without_being_asked(
        self, client, make_user, make_farm, artifacts_dir
    ) -> None:
        """A farmer cannot choose a language over SMS, so their account setting has to carry."""
        user = await make_user(UserRole.FARMER, phone="+251911444555", locale=Locale.AM, woreda_code="SNN")
        await make_farm(user, row=2, col=2, crop=Crop.TEF, name="Amharic plot")

        body = client.post("/api/v1/hotline/inbound", json={"caller": "0911444555", "text": "1"}).json()
        assert body["locale"] == "am"
        assert any("\u1200" <= c <= "\u137f" for c in body["reply"])

    def test_a_number_that_cannot_be_dialled_back_is_refused(self, client, db_ready) -> None:
        res = client.post("/api/v1/hotline/inbound", json={"caller": "12", "text": "1"})
        assert res.status_code == 422

    def test_the_operator_can_read_what_the_hotline_was_asked(
        self, client, farmer, admin_headers, artifacts_dir
    ) -> None:
        client.post("/api/v1/hotline/inbound", json={"caller": "0911222333", "text": "2"})
        rows = client.get("/api/v1/admin/hotline", headers=admin_headers).json()
        assert rows
        assert rows[0]["intent"] == "planting"
        assert rows[0]["delivered"] is False

    def test_the_traffic_log_is_not_public(self, client) -> None:
        assert client.get("/api/v1/admin/hotline").status_code == 401


class TestWebhookSignature:
    """Before a public short code this check is optional. After it, it is the only proof of origin.

    Exercised against the verifier itself rather than through the app, because the point under test
    is the comparison, and routing a request through FastAPI to reach it proves less about it.
    """

    @staticmethod
    def _sign(secret: str, body: bytes) -> str:
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    async def test_a_matching_signature_passes(self) -> None:
        from agriminds_api.api.v1.agent import _verify

        body = json.dumps({"caller": "0911222333", "text": "1"}).encode()
        await _verify(_FakeRequest(body), "s3cret", self._sign("s3cret", body))

    async def test_a_forged_signature_is_refused(self) -> None:
        from agriminds_api.api.v1.agent import _verify
        from agriminds_api.core.exceptions import UnauthorizedError

        body = b'{"caller":"0911222333"}'
        with pytest.raises(UnauthorizedError):
            await _verify(_FakeRequest(body), "s3cret", self._sign("wrong", body))

    async def test_a_signature_over_a_different_body_is_refused(self) -> None:
        """Signing the right secret over other content must not authorise this request."""
        from agriminds_api.api.v1.agent import _verify
        from agriminds_api.core.exceptions import UnauthorizedError

        with pytest.raises(UnauthorizedError):
            await _verify(_FakeRequest(b'{"caller":"0911000111"}'), "s3cret", self._sign("s3cret", b"{}"))

    async def test_no_secret_configured_skips_the_check(self) -> None:
        # The deployed state today: no short code exists, so no aggregator can post here.
        from agriminds_api.api.v1.agent import _verify

        await _verify(_FakeRequest(b"{}"), "", "")


class _FakeRequest:
    """The one thing `_verify` needs from a request: the raw body it was signed over."""

    def __init__(self, body: bytes) -> None:
        self._body = body

    async def body(self) -> bytes:
        return self._body
