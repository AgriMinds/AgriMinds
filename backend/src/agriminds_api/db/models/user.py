"""Accounts, roles and refresh-token sessions."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class UserRole(enum.StrEnum):
    """Who the account belongs to. Drives both routing and row-level visibility."""

    FARMER = "farmer"  # smallholder: sees only their own farms
    AGENT = "agent"  # development agent / extension worker: sees their woreda
    MINISTER = "minister"  # ministry decision maker: sees the whole watershed
    ADMIN = "admin"  # platform administrator

    @property
    def is_staff(self) -> bool:
        """Staff roles reach the ministry dashboard and aggregate figures."""
        return self in {UserRole.AGENT, UserRole.MINISTER, UserRole.ADMIN}


class Locale(enum.StrEnum):
    EN = "en"
    AM = "am"
    OM = "or"


user_role_enum = Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e])
locale_enum = Enum(Locale, name="locale", values_callable=lambda e: [m.value for m in e])


class User(UUIDPrimaryKey, Timestamps, Base):
    """A person who signs in.

    Ministry staff identify by email; farmers identify by phone number, which is what they
    actually have in the field. At least one of the two must be present.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email IS NOT NULL OR phone IS NOT NULL", name="identifier_present"),
        Index("ix_users_role_woreda", "role", "woreda_id"),
    )

    email: Mapped[str | None] = mapped_column(String(254), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(user_role_enum, default=UserRole.FARMER, index=True)
    locale: Mapped[Locale] = mapped_column(locale_enum, default=Locale.EN)
    woreda_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("woredas.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Brute-force protection; reset on a successful sign-in.
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    woreda: Mapped["Woreda | None"] = relationship(lazy="joined")  # noqa: F821
    farms: Mapped[list["Farm"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def identifier(self) -> str:
        return self.email or self.phone or str(self.id)


class RefreshToken(UUIDPrimaryKey, Timestamps, Base):
    """One row per issued refresh token.

    Only a SHA-256 hash is stored, so a database leak does not yield usable sessions.
    Tokens rotate on every refresh; presenting an already-rotated token is treated as theft
    and revokes the whole family.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_user_expires", "user_id", "expires_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # All tokens descending from one sign-in share a family id.
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="refresh_tokens")

    def is_usable(self, now: datetime) -> bool:
        return self.revoked_at is None and self.expires_at > now
