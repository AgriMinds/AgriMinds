"""The farmer agent: one brain, asked through chat, voice, SMS or a USSD menu.

Every answer is assembled from this farmer's own plots and the advisory engine's output for them.
Nothing is generated: the agent decides *which* of the engine's findings answers the question and
says it in the farmer's language. That is the whole design, and it is deliberate -- an agent that
composed agronomic advice freely would be inventing planting dates for people whose season depends
on them, and it would do so most confidently exactly where the model is least sure.

The consequence worth stating: this agent can be wrong only in the way the forecast is wrong, and
it says so when the forecast is missing rather than answering anyway.

The same core serves all four channels because a feature phone and a browser are asking the same
question. What differs is length -- an SMS reply is cut to fit, a chat reply is not.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from agriminds_api.core.exceptions import ModelUnavailableError
from agriminds_api.schemas.advisory import AdvisoryRequest, AdvisoryResponse
from agriminds_api.schemas.farm import FarmOut
from agriminds_api.services import agent_phrases as phrases
from agriminds_api.services.advisory import AdvisoryService

log = logging.getLogger(__name__)

#: One SMS segment in GSM-7. Ethiopic is UCS-2 and fits 70, which `fit_to_sms` accounts for.
SMS_GSM7_LIMIT = 160
SMS_UCS2_LIMIT = 70

Intent = str

#: What a farmer can ask, and the words -- in all three languages, plus the menu digit -- that mean
#: they are asking it. Matching is on whole words so that "water" does not fire on "watershed".
INTENTS: dict[Intent, tuple[str, ...]] = {
    "risk": ("1", "risk", "drought", "danger", "ድርቅ", "ስጋት", "አደጋ", "hongee", "balaa", "carraa"),
    "planting": (
        "2",
        "plant",
        "plantig",
        "sow",
        "sowing",
        "when",
        "date",
        "time",
        "መዝራት",
        "ዝረት",
        "መቼ",
        "ጊዜ",
        "facaasuu",
        "dhaabuu",
        "yoom",
        "yeroo",
    ),
    "water": ("3", "water", "irrigation", "rain", "ውሃ", "መስኖ", "bishaan", "jallisii"),
    "crop": ("4", "crop", "seed", "variety", "which", "ዘር", "ዝርያ", "ሰብል", "sanyii", "midhaan"),
    "plots": ("5", "plot", "plots", "land", "farm", "ማሳ", "ማሳዎች", "መሬት", "lafa", "qonnaa"),
    "season": ("6", "season", "month", "kiremt", "meher", "belg", "ወቅት", "ክረምት", "መሃር", "waqtii", "ji'a"),
    "prepare": ("7", "prepare", "preparedness", "help me", "ዝግጅት", "qophii"),
    "enso": ("8", "nino", "nina", "enso", "pacific", "ኒኞ", "ፓስፊክ", "paasifiik"),
    "menu": (
        "0",
        "menu",
        "help",
        "hi",
        "hello",
        "selam",
        "start",
        "ሰላም",
        "እርዳታ",
        "ምናሌ",
        "akkam",
        "gargaarsa",
    ),
}

#: Which part of the advisory answers which question. The agent routes; it does not write.
_ENGINE_FIELD: dict[Intent, str] = {
    "planting": "planting_window",
    "water": "water_management",
    "crop": "crop_recommendation",
    "prepare": "preparedness_action",
}

#: The Amharic/Afaan Oromoo wording for the same four, keyed by risk level.
_TRANSLATED: dict[Intent, dict[str, dict[str, str]]] = {
    "planting": phrases.PLANTING,
    "water": phrases.WATER,
    "crop": phrases.CROP,
    "prepare": phrases.PREP,
}

_MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


@dataclass
class Answer:
    """What the agent said, and what it said it from.

    `sources` is not decoration. An extension officer checking a farmer's complaint needs to know
    which plot and which model run produced the sentence the farmer acted on.
    """

    intent: Intent
    text: str
    locale: str
    farm_id: str | None = None
    sources: list[str] = field(default_factory=list)
    followups: list[str] = field(default_factory=list)


def detect_intent(text: str) -> Intent:
    """Match the question to one of the things the agent can actually answer.

    A bare digit is treated as a menu choice, because that is how a USSD or SMS user replies and
    because "3" from a feature phone means the third option, not the number three.
    """
    cleaned = (text or "").strip().lower()
    if not cleaned:
        return "menu"
    if re.fullmatch(r"[0-9]", cleaned):
        for intent, words in INTENTS.items():
            if cleaned in words:
                return intent
        return "menu"

    words = set(re.findall(r"[\w’']+", cleaned, flags=re.UNICODE))
    # Longest-phrase keywords first so "help me" beats "help".
    for intent, keys in INTENTS.items():
        for key in keys:
            if " " in key and key in cleaned:
                return intent
            if key in words:
                return intent
    return "menu"


def fit_to_sms(text: str, segments: int = 2) -> str:
    """Trim a reply to what a phone will actually show in `segments` messages.

    Ethiopic forces UCS-2 encoding, which halves the characters per segment -- an Amharic answer
    that fits two English segments does not fit two of its own. Cutting on a word boundary and
    marking the cut is better than a reply that stops mid-word, which reads as a broken service.
    """
    limit = (SMS_UCS2_LIMIT if any(ord(c) > 127 for c in text) else SMS_GSM7_LIMIT) * segments
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    spaced = cut.rsplit(" ", 1)[0] if " " in cut else cut
    return f"{spaced}…"


class AgentService:
    """Answers a farmer's question from their own plots and the forecast for them."""

    def __init__(self, advisory: AdvisoryService) -> None:
        self._advisory = advisory

    def answer(
        self,
        *,
        question: str,
        locale: str,
        farms: list[FarmOut],
        lead_month: int = 1,
        farm_id: str | None = None,
    ) -> Answer:
        loc = locale if locale in ("en", "am", "om") else "en"
        intent = detect_intent(question)

        if intent == "menu":
            return Answer(intent=intent, text=self._menu(loc), locale=loc, followups=self._chips())

        if not farms:
            return Answer(intent=intent, text=phrases.NO_PLOTS[loc], locale=loc)

        plot = self._plot(farms, farm_id)

        if intent == "plots":
            listed = ", ".join(
                f"{f.name} {f.area_hectares:g} ha" + (f" · {f.risk.risk_level}" if f.risk else "")
                for f in farms
            )
            return Answer(
                intent=intent,
                text=phrases.PLOTS[loc].format(list=listed),
                locale=loc,
                sources=[f"farm:{f.id}" for f in farms],
                followups=self._chips(),
            )

        try:
            advisory = self._advise(plot, lead_month)
        except ModelUnavailableError:
            # Saying nothing is the right answer here. A cached guess presented as a forecast is
            # how a farmer plants on a number the model never produced.
            log.info("agent asked %r while the model is down", intent)
            return Answer(intent=intent, text=phrases.MODEL_DOWN[loc], locale=loc)

        sources = [f"farm:{plot.id}", f"advisory:{advisory.rules_version}", f"lead:{lead_month}"]

        if intent == "risk":
            text = phrases.RISK[loc].format(
                plot=plot.name,
                crop=plot.primary_crop,
                pct=round(advisory.adjusted_probability * 100),
                level=phrases.LEVEL[loc][advisory.risk_level],
            )
        elif intent == "season":
            month = _MONTHS[int(advisory.target_date[5:7]) - 1]
            text = phrases.SEASON[loc].format(season=advisory.season, month=month, enso=advisory.enso_state)
        elif intent == "enso":
            text = f"{advisory.enso_state} ({advisory.enso_category})."
        else:
            text = self._action(intent, loc, advisory)
            # The risk is prefixed because advice without the number behind it invites the farmer
            # to weigh it against nothing.
            text = f"{phrases.LEVEL[loc][advisory.risk_level]} · {text}"

        return Answer(
            intent=intent,
            text=text,
            locale=loc,
            farm_id=str(plot.id),
            sources=sources,
            followups=self._chips(),
        )

    # ------------------------------------------------------------------ internals
    def _advise(self, plot: FarmOut, lead_month: int) -> AdvisoryResponse:
        return self._advisory.evaluate(
            AdvisoryRequest(
                crop=plot.primary_crop,
                lead_month=lead_month,
                row=plot.grid_row,
                col=plot.grid_col,
            )
        )

    @staticmethod
    def _plot(farms: list[FarmOut], farm_id: str | None) -> FarmOut:
        """The plot asked about, or the one that needs attention first."""
        if farm_id:
            for f in farms:
                if str(f.id) == farm_id:
                    return f
        rated = [f for f in farms if f.risk is not None]
        if rated:
            return max(rated, key=lambda f: f.risk.probability)  # type: ignore[union-attr]
        return farms[0]

    @staticmethod
    def _action(intent: Intent, loc: str, advisory: AdvisoryResponse) -> str:
        """The engine's own sentence in English; the matching translation otherwise."""
        if loc == "en":
            return str(getattr(advisory, _ENGINE_FIELD[intent]))
        return _TRANSLATED[intent][loc][advisory.risk_level]

    @staticmethod
    def _menu(loc: str, code: str = "977") -> str:
        return phrases.MENU[loc].format(code=code)

    @staticmethod
    def _chips() -> list[str]:
        """Intents offered as one-tap replies, so a farmer never has to guess the wording."""
        return ["risk", "planting", "water", "crop", "plots", "season"]
