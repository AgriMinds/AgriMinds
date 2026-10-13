"""Self sign-up, and the human check that has to follow it.

A farmer's advisory is tied to a holding in a kebele. Nothing on a sign-up form proves that the
person has one, so a self-registered account is created `pending` and a development agent or
administrator confirms it against what they know of the area.

The acknowledgement is identical whether or not the number is already registered. A form that said
"this number already has an account" would be a way to discover who is on the platform, one number
at a time -- and the number is the thing people sign in with.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agriminds_api.core import security
from agriminds_api.core.config import Settings
from agriminds_api.core.exceptions import ConflictError, NotFoundError, ValidationError
from agriminds_api.db.models import ApprovalStatus, Locale, User, UserRole
from agriminds_api.schemas.signup import (
    ApprovalDecision,
    CredentialLink,
    PendingUser,
    RegisterFarmer,
    SignupAccepted,
    SignupRequest,
)
from agriminds_api.services.invitation import issue as issue_invitation

log = logging.getLogger(__name__)

#: Said to everyone, registered or not. See the module docstring.
_ACKNOWLEDGEMENT = (
    "Thank you. Your account is waiting for a development agent to confirm your holding. "
    "You will be able to sign in once it is approved."
)


class SignupService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def register(self, req: SignupRequest) -> SignupAccepted:
        try:
            phone = security.normalise_phone(req.phone)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        try:
            security.validate_password_strength(req.password, self._settings.password_min_length)
        except security.PasswordPolicyError as exc:
            raise ValidationError(str(exc)) from exc

        existing = await self._session.scalar(select(User).where(User.phone == phone))
        if existing is not None:
            # Same answer as a successful sign-up, and nothing is written. Telling the caller the
            # number is taken would turn this form into a directory of who is registered.
            log.info("signup for an existing number %s; acknowledged without writing", phone)
            return SignupAccepted(status="pending", message=_ACKNOWLEDGEMENT)

        user = User(
            phone=phone,
            full_name=req.full_name.strip(),
            hashed_password=security.hash_password(req.password),
            role=UserRole.FARMER,
            locale=Locale(req.locale),
            woreda_id=uuid.UUID(req.woreda_id) if req.woreda_id else None,
            approval_status=ApprovalStatus.PENDING,
            signup_note=req.note,
            is_active=True,
        )
        self._session.add(user)
        await self._session.flush()
        log.info("signup pending user=%s woreda=%s", user.id, req.woreda_id)
        return SignupAccepted(status="pending", message=_ACKNOWLEDGEMENT)

    async def pending(self) -> list[PendingUser]:
        """Who is waiting, oldest first -- somebody who signed up a week ago is the urgent one."""
        rows = (
            await self._session.scalars(
                select(User)
                .where(User.approval_status == ApprovalStatus.PENDING)
                .options(selectinload(User.woreda))
                .order_by(User.created_at)
            )
        ).all()
        return [
            PendingUser(
                id=str(u.id),
                full_name=u.full_name,
                phone=u.phone,
                locale=u.locale.value,
                woreda_name=u.woreda.name_en if u.woreda else None,
                note=u.signup_note,
                signed_up_at=u.created_at,
            )
            for u in rows
        ]

    async def decide(
        self, user_id: uuid.UUID, decision: ApprovalDecision, *, decided_by: uuid.UUID
    ) -> PendingUser:
        user = await self._session.get(User, user_id, options=[selectinload(User.woreda)])
        if user is None:
            raise NotFoundError("No such account.")
        if user.approval_status is not ApprovalStatus.PENDING:
            raise ConflictError("That account has already been decided.")

        user.approval_status = ApprovalStatus.APPROVED if decision.approve else ApprovalStatus.REJECTED
        user.approved_by_id = decided_by
        user.approved_at = dt.datetime.now(dt.UTC)
        if decision.note:
            user.signup_note = decision.note
        await self._session.flush()
        log.info("signup %s user=%s by=%s", user.approval_status.value, user.id, decided_by)
        return PendingUser(
            id=str(user.id),
            full_name=user.full_name,
            phone=user.phone,
            locale=user.locale.value,
            woreda_name=user.woreda.name_en if user.woreda else None,
            note=user.signup_note,
            signed_up_at=user.created_at,
        )

    async def register_farmer(self, req: RegisterFarmer, *, registered_by: uuid.UUID) -> CredentialLink:
        """A development agent opens an account for a farmer who is standing in front of them.

        Approved on arrival: the check the queue exists to perform -- does this person farm here --
        has just been done in person by the one who would otherwise do it from a form.

        The agent never sets a password. They hand over a link and the farmer chooses their own, so
        no staff member ends up holding a credential that signs in as a farmer.
        """
        try:
            phone = security.normalise_phone(req.phone)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        if await self._session.scalar(select(User).where(User.phone == phone)):
            # Said plainly here, unlike the public form: an agent needs to know the number is
            # taken so they can look it up, and they are already trusted with the register.
            raise ConflictError(f"An account already exists for {phone}.")

        user = User(
            phone=phone,
            full_name=req.full_name.strip(),
            hashed_password=security.unusable_password_hash(),
            role=UserRole.FARMER,
            locale=Locale(req.locale),
            woreda_id=uuid.UUID(req.woreda_id) if req.woreda_id else None,
            approval_status=ApprovalStatus.APPROVED,
            approved_by_id=registered_by,
            approved_at=dt.datetime.now(dt.UTC),
            signup_note=req.note,
            is_active=True,
        )
        self._session.add(user)
        await self._session.flush()

        raw, expires_at = await issue_invitation(
            self._session, user, invited_by=registered_by, reason="registered by agent"
        )
        return CredentialLink(
            user_id=str(user.id),
            full_name=user.full_name,
            phone=user.phone,
            token=raw,
            expires_at=expires_at,
            instruction=(
                "Give this link to the farmer so they can choose their own password. It works "
                "once and cannot be shown again."
            ),
        )

    async def reset_password(self, user_id: uuid.UUID, *, issued_by: uuid.UUID) -> CredentialLink:
        """Give somebody who has forgotten their password a way back in.

        There is no email and no SMS to send a reset to, so the channel is the person who can
        already identify the farmer: their development agent. That is a deliberate trade -- it puts
        the check on somebody who knows them, rather than on an inbox nobody here has.

        Issuing one spends any link the account already held, so a reset also revokes whatever was
        outstanding.
        """
        user = await self._session.get(User, user_id)
        if user is None:
            raise NotFoundError("No such account.")
        if not user.is_active:
            raise ConflictError("That account is deactivated. Reactivate it before resetting.")
        if user.approval_status is ApprovalStatus.REJECTED:
            raise ConflictError("That sign-up was refused, so there is nothing to reset.")

        raw, expires_at = await issue_invitation(
            self._session, user, invited_by=issued_by, reason="password reset"
        )
        return CredentialLink(
            user_id=str(user.id),
            full_name=user.full_name,
            phone=user.phone,
            token=raw,
            expires_at=expires_at,
            instruction=(
                "Give this link to them in person or read it over the phone. It works once, it "
                "expires, and any earlier link for this account has just stopped working."
            ),
        )
