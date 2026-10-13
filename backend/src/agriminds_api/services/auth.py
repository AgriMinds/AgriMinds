"""Sign-in, token rotation and account self-service.

Threat model handled here: credential stuffing (lockout + uniform error), token theft
(rotation with family revocation on reuse) and database leaks (hashes only).
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agriminds_api.core import security
from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    UnauthorizedError,
    ValidationError,
)
from agriminds_api.db.models import ApprovalStatus, Invitation, RefreshToken, User, UserRole

log = logging.getLogger(__name__)


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    # ------------------------------------------------------------------ lookups
    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = select(User).where(User.id == user_id).options(selectinload(User.woreda))
        return await self._session.scalar(stmt)

    async def _get_by_identifier(self, identifier: str) -> User | None:
        value = identifier.strip()
        if security.looks_like_email(value):
            stmt = select(User).where(User.email == security.normalise_email(value))
        else:
            try:
                phone = security.normalise_phone(value)
            except ValueError:
                return None
            stmt = select(User).where(User.phone == phone)
        return await self._session.scalar(stmt.options(selectinload(User.woreda)))

    # ------------------------------------------------------------------ sign in
    async def authenticate(
        self, identifier: str, password: str, user_agent: str | None
    ) -> tuple[User, str, str, int]:
        now = datetime.now(UTC)
        user = await self._get_by_identifier(identifier)

        if user is None:
            # Same work and same message as a wrong password: do not reveal who is registered.
            security.dummy_verify()
            raise InvalidCredentialsError()

        if user.locked_until and user.locked_until > now:
            raise AccountLockedError("Too many failed sign-in attempts. Try again in a few minutes.")

        ok, new_hash = security.verify_password(password, user.hashed_password)
        if not ok:
            await self._register_failure(user, now)
            raise InvalidCredentialsError()

        if not user.is_active:
            # Checked after the password so a disabled account is not distinguishable by probing.
            raise UnauthorizedError("This account has been deactivated. Contact your administrator.")

        if user.approval_status is ApprovalStatus.PENDING:
            # Also after the password, for the same reason. The message differs from the one above
            # on purpose: this person should wait, and the other should stop trying. It also
            # differs by who is waiting -- a farmer is checked by the agent who knows their land,
            # an institution by an administrator, and telling either the other one's story sends
            # them to the wrong person.
            raise UnauthorizedError(
                "Your account is still waiting to be confirmed. A development agent will approve "
                "it once they have checked your holding."
                if user.role is UserRole.FARMER
                else "Your account is still waiting to be approved. We are reviewing your request "
                "and will open it shortly."
            )
        if user.approval_status is ApprovalStatus.REJECTED:
            # Who to appeal to differs by who decided, for the same reason as the message above.
            raise UnauthorizedError(
                "This sign-up was not approved. Speak to your development agent if you think that "
                "is a mistake."
                if user.role is UserRole.FARMER
                else "This request was not approved. Reply to the message you received, or "
                "submit a new request, if you think that is a mistake."
            )

        if new_hash:
            user.hashed_password = new_hash
        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = now

        access, refresh, expires_in = await self._issue_pair(
            user, user_agent, family_id=uuid.uuid4(), now=now
        )
        log.info("sign-in ok user=%s role=%s", user.id, user.role)
        return user, access, refresh, expires_in

    async def accept_invitation(
        self, raw_token: str, password: str, user_agent: str | None
    ) -> tuple[User, str, str, int]:
        """Set the password an invitation was issued for and sign the person straight in.

        Signing in immediately is deliberate: asking somebody to type the password they just chose
        into a second form adds a step and no security, since accepting the invitation already
        proved they hold the token.

        A used, expired or unknown token gets one message. Distinguishing them would let a holder
        of a guessed token learn that it was once real.
        """
        now = datetime.now(UTC)
        invitation = await self._session.scalar(
            select(Invitation).where(Invitation.token_hash == security.hash_invitation_token(raw_token))
        )
        if invitation is None or not invitation.is_usable(now=now):
            raise UnauthorizedError("That invitation is no longer valid. Ask for a new one.")

        user = invitation.user
        if not user.is_active:
            raise UnauthorizedError("That invitation is no longer valid. Ask for a new one.")

        try:
            security.validate_password_strength(password, self._settings.password_min_length)
        except security.PasswordPolicyError as exc:
            # A refused password must not spend the invitation: a fumbled first try would
            # otherwise cost the account its only way in.
            raise ValidationError(str(exc)) from exc
        user.hashed_password = security.hash_password(password)
        user.last_login_at = now
        # Marked before the tokens are issued, so a retry of the same request cannot accept twice.
        invitation.accepted_at = now

        access, refresh, expires_in = await self._issue_pair(
            user, user_agent, family_id=uuid.uuid4(), now=now
        )
        log.info("invitation accepted user=%s org=%s", user.id, user.organization_id)
        return user, access, refresh, expires_in

    async def _register_failure(self, user: User, now: datetime) -> None:
        user.failed_login_count += 1
        if user.failed_login_count >= self._settings.login_max_attempts:
            user.locked_until = now + timedelta(minutes=self._settings.login_lockout_minutes)
            user.failed_login_count = 0
            log.warning("account locked after repeated failures user=%s", user.id)
        # Commit before the caller raises 401: the request-scoped session rolls back on error,
        # and a counter that disappears with the rejection is no protection at all.
        await self._session.commit()

    async def _issue_pair(
        self, user: User, user_agent: str | None, family_id: uuid.UUID, now: datetime
    ) -> tuple[str, str, int]:
        access, access_expires = security.create_access_token(
            self._settings,
            user_id=user.id,
            role=user.role.value,
            locale=user.locale.value,
            full_name=user.full_name,
            now=now,
        )
        raw_refresh, token_hash = security.generate_refresh_token()
        self._session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=token_hash,
                family_id=family_id,
                expires_at=now + timedelta(days=self._settings.refresh_token_ttl_days),
                user_agent=(user_agent or "")[:255] or None,
            )
        )
        await self._session.flush()
        return access, raw_refresh, int((access_expires - now).total_seconds())

    # ------------------------------------------------------------------ rotation
    async def refresh(self, raw_token: str, user_agent: str | None) -> tuple[User, str, str, int]:
        now = datetime.now(UTC)
        token_hash = security.hash_refresh_token(raw_token)
        stored = await self._session.scalar(
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .options(selectinload(RefreshToken.user).selectinload(User.woreda))
        )
        if stored is None:
            raise UnauthorizedError("Your session has expired. Please sign in again.")

        if stored.revoked_at is not None:
            # A rotated token came back: assume it was stolen and end every session in the family.
            # Commit before raising, because the request-scoped session rolls back on error and
            # the revocation must survive the 401 it is about to produce.
            await self._revoke_family(stored.family_id, now)
            await self._session.commit()
            log.warning("refresh token reuse detected; family revoked user=%s", stored.user_id)
            raise UnauthorizedError("Your session has expired. Please sign in again.")

        if stored.expires_at <= now:
            raise UnauthorizedError("Your session has expired. Please sign in again.")

        user = stored.user
        if not user.is_active:
            raise UnauthorizedError("This account has been deactivated. Contact your administrator.")

        stored.revoked_at = now
        access, refresh, expires_in = await self._issue_pair(user, user_agent, stored.family_id, now)
        return user, access, refresh, expires_in

    async def _revoke_family(self, family_id: uuid.UUID, now: datetime) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    async def logout(self, raw_token: str) -> None:
        """Revoke the presented session. Unknown tokens are ignored so logout is idempotent."""
        stored = await self._session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == security.hash_refresh_token(raw_token))
        )
        if stored and stored.revoked_at is None:
            await self._revoke_family(stored.family_id, datetime.now(UTC))

    async def logout_everywhere(self, user: User) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )

    # ------------------------------------------------------------------ self-service
    async def change_password(self, user: User, current: str, new: str) -> None:
        ok, _ = security.verify_password(current, user.hashed_password)
        if not ok:
            raise InvalidCredentialsError("Your current password is incorrect.")
        try:
            security.validate_password_strength(new, self._settings.password_min_length)
        except security.PasswordPolicyError as exc:
            raise ValidationError(str(exc)) from exc
        user.hashed_password = security.hash_password(new)
        await self.logout_everywhere(user)  # force every other device to sign in again
        await self._session.flush()
