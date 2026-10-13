"""Every turn of a 977 conversation, inbound and outbound.

This is deliberately not the `message_deliveries` table. That one is a ledger against message
credits an organisation buys: a cooperative pays for the SMS it sends its members. The hotline is
free to the farmer and paid for by the platform, so billing a cooperative's balance for a farmer's
question would be charging one customer for another's use of a free service.

Both directions are stored because the pair is the record. A complaint that "the hotline told me to
plant" can only be answered by reading what was asked and what went back, and the intent the agent
matched is kept alongside so a wrong answer can be traced to the word that triggered it.

A caller who is not registered is still logged, with `user_id` null. Those rows are the demand
signal for where to register farmers next, and dropping them would throw that away.
"""

from __future__ import annotations

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class HotlineChannel(enum.StrEnum):
    SMS = "sms"
    #: An interactive menu session: the caller replies with digits.
    USSD = "ussd"
    #: An IVR call. The body holds what was spoken to or by the caller.
    VOICE = "voice"
    #: In-app chat. Same agent, no carrier involved.
    CHAT = "chat"


class Direction(enum.StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class HotlineStatus(enum.StrEnum):
    #: Answered and recorded, but no carrier has taken it yet.
    HELD = "held"
    SENT = "sent"
    FAILED = "failed"
    #: Inbound messages are received, not sent.
    RECEIVED = "received"


hotline_channel_enum = Enum(
    HotlineChannel, name="hotline_channel", values_callable=lambda e: [m.value for m in e]
)
hotline_direction_enum = Enum(
    Direction, name="hotline_direction", values_callable=lambda e: [m.value for m in e]
)
hotline_status_enum = Enum(
    HotlineStatus, name="hotline_status", values_callable=lambda e: [m.value for m in e]
)


class HotlineMessage(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "hotline_messages"
    __table_args__ = (
        Index("ix_hotline_caller_created", "caller", "created_at"),
        Index("ix_hotline_session", "session_id"),
    )

    direction: Mapped[Direction] = mapped_column(hotline_direction_enum, index=True)
    channel: Mapped[HotlineChannel] = mapped_column(hotline_channel_enum, index=True)
    #: The farmer's number, in both directions: whose conversation this is, not who sent it.
    caller: Mapped[str] = mapped_column(String(20))
    #: The short code dialled. Kept per row so a later change of code does not rewrite history.
    short_code: Mapped[str | None] = mapped_column(String(12), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    locale: Mapped[str] = mapped_column(String(2), default="en")
    #: What the agent decided the question was. Null on an outbound row's own account.
    intent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    #: Null when the number belongs to nobody registered.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    #: Ties the turns of one USSD or IVR session together.
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[HotlineStatus] = mapped_column(
        hotline_status_enum, default=HotlineStatus.RECEIVED, index=True
    )
    #: The aggregator's own id for a sent message, for reconciling a delivery report.
    provider_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    #: Why a send failed, as the provider explained it.
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
