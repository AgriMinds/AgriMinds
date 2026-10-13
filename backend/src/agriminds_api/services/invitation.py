"""Issuing the single-use link somebody uses to set their own password.

Three situations need exactly this and must not grow three implementations: an approved
organisation's contact opening their account, a development agent registering a farmer who walked
into the office, and anybody who has forgotten their password.

A password is never generated and never transmitted. What travels is a token that permits setting
one, once, before it expires -- so a relayed message that is overheard, forwarded or left in a call
log ages into uselessness instead of being a working credential forever.

There is no mail server and no SMS carrier here, so the relay is a person: the agent hands it over,
reads it down the phone, or writes it on a slip. That is the weak link, and it is the reason the
token is single-use and short-lived rather than a convenience.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from agriminds_api.core.security import generate_invitation_token
from agriminds_api.db.models import INVITATION_VALID_FOR, Invitation, User

log = logging.getLogger(__name__)


async def issue(
    session: AsyncSession, user: User, *, invited_by: uuid.UUID | None, reason: str
) -> tuple[str, dt.datetime]:
    """Return (raw_token, expires_at) and store only its hash.

    Any invitation this account already holds is spent first. Otherwise a reset would leave the
    previous link working, and the one you meant to revoke -- the one somebody else may be holding
    -- would still open the account.
    """
    now = dt.datetime.now(dt.UTC)
    await session.execute(
        update(Invitation)
        .where(Invitation.user_id == user.id, Invitation.accepted_at.is_(None))
        .values(accepted_at=now)
    )

    raw, token_hash = generate_invitation_token()
    expires_at = now + INVITATION_VALID_FOR
    session.add(
        Invitation(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            invited_by_id=invited_by,
        )
    )
    await session.flush()
    log.info("invitation issued user=%s by=%s reason=%s", user.id, invited_by, reason)
    return raw, expires_at
