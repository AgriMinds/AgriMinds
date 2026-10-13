"""A single-use link that turns an approved access request into an account somebody can sign in to.

Approving a request creates the organisation. It cannot create a password, so until the contact can
sign in the organisation exists but nobody can reach it -- not the plans page, not an invoice, not
the data they were approved for. This closes that gap.

There is no mail server here, so the token is handed to the approving administrator once and
relayed by whatever channel they already use with that customer. That is the weak link in the
chain, and it is why the token expires, works once, and grants nothing beyond setting the password
on one named account: a leaked invitation should age into uselessness on its own.

Only the hash is stored, exactly as refresh tokens are handled -- a database copy must not yield
working invitations.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey
from agriminds_api.db.models.user import User

INVITATION_VALID_FOR = dt.timedelta(days=14)
"""Long enough to survive a relay by phone call and a slow reply; short enough to expire."""


class Invitation(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "invitations"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    invited_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")

    def is_usable(self, *, now: dt.datetime | None = None) -> bool:
        """Unaccepted and unexpired. Both halves matter: single use, and bounded life."""
        now = now or dt.datetime.now(dt.UTC)
        return self.accepted_at is None and self.expires_at > now
