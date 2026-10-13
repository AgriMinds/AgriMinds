"""Where an outbound hotline reply goes, and the honest fact that today it goes nowhere.

Reaching a real handset in Ethiopia needs a short code assigned by Ethio Telecom and a contract
with an SMS aggregator. Neither exists for this platform yet. Writing the send against an interface
rather than against a particular vendor means connecting one later is configuration, and -- more
usefully -- means the rest of the system is already written as if sending can fail, which it will.

`none` is the default and it refuses to pretend. A reply is recorded as `held`, never `sent`: a row
marked sent when nothing left the building is the kind of record that turns into a report saying
the hotline served N farmers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class SendResult:
    delivered: bool
    provider: str
    message_id: str | None = None
    error: str | None = None


class SmsProvider(Protocol):
    name: str

    def send(self, *, to: str, body: str, short_code: str) -> SendResult: ...


class NoProvider:
    """No carrier is connected. Answers are composed and stored; nothing is transmitted."""

    name = "none"

    def send(self, *, to: str, body: str, short_code: str) -> SendResult:
        return SendResult(
            delivered=False,
            provider=self.name,
            error="No SMS aggregator is connected. The reply was recorded but not sent.",
        )


class SimulatorProvider:
    """Logs the message instead of transmitting it, for walking the flow end to end locally.

    Still reports `delivered=False`. The simulator exists to show what a farmer *would* receive,
    not to make the figures look as though they received it.
    """

    name = "simulator"

    def send(self, *, to: str, body: str, short_code: str) -> SendResult:
        log.info("[sms:simulated] %s -> %s: %s", short_code, to, body)
        return SendResult(
            delivered=False,
            provider=self.name,
            message_id=f"sim-{abs(hash((to, body))) % 10**10:010d}",
            error="Simulated: shown for review, not transmitted to the handset.",
        )


def provider_for(name: str) -> SmsProvider:
    """`none` unless told otherwise, so a misconfiguration cannot silently claim to send."""
    if name == "simulator":
        return SimulatorProvider()
    if name not in ("none", ""):
        # Naming a vendor that is not implemented must fail loudly in the logs rather than
        # degrade into a silent no-op that looks like a working integration.
        log.warning("sms provider %r is not implemented; falling back to none", name)
    return NoProvider()
