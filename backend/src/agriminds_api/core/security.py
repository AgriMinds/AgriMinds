"""Credential handling: password hashing, JWT access tokens and refresh-token secrets.

Nothing here touches the database or FastAPI; it is pure, synchronous and unit-testable.
"""

from __future__ import annotations

import contextlib
import hashlib
import hmac
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from agriminds_api.core.config import Settings

# OWASP-recommended argon2id baseline (19 MiB, 2 passes). Tuned low enough that a mid-range
# server can still sign a farmer in quickly over a slow rural connection.
_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1, hash_len=32, salt_len=16)

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> tuple[bool, str | None]:
    """Return (is_valid, new_hash). ``new_hash`` is set when the stored hash uses old parameters."""
    try:
        _hasher.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False, None
    if _hasher.check_needs_rehash(hashed):
        return True, _hasher.hash(password)
    return True, None


def dummy_verify() -> None:
    """Burn a comparable amount of CPU when an account does not exist.

    Without this, a missing account answers measurably faster than a wrong password, which
    leaks which identifiers are registered.
    """
    with contextlib.suppress(Exception):  # the point is the work, not the result
        _hasher.verify(
            "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2E$0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0",
            "not-the-password",
        )


class PasswordPolicyError(ValueError):
    pass


def validate_password_strength(password: str, min_length: int) -> None:
    """Length-first policy (NIST SP 800-63B): long passphrases beat forced character classes."""
    if len(password) < min_length:
        raise PasswordPolicyError(f"Password must be at least {min_length} characters long.")
    if len(password) > 256:
        raise PasswordPolicyError("Password must be at most 256 characters long.")
    if password.lower() in _COMMON_PASSWORDS:
        raise PasswordPolicyError("That password is too common. Choose a less predictable one.")


_COMMON_PASSWORDS = {
    "password",
    "password1",
    "12345678",
    "123456789",
    "1234567890",
    "qwertyuiop",
    "letmein123",
    "agriminds",
    "agriminds1",
    "changeme",
    "welcome1",
    "admin123",
}


# ---------------------------------------------------------------------------- identifiers
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
_ETHIOPIAN_PHONE_RE = re.compile(r"^(?:\+251|0)?(9\d{8}|7\d{8})$")


def normalise_email(value: str) -> str:
    return value.strip().lower()


def normalise_phone(value: str) -> str:
    """Accept 0912345678, 251912345678 or +251912345678 and store one canonical E.164 form."""
    cleaned = re.sub(r"[\s\-()]", "", value.strip())
    cleaned = cleaned.removeprefix("+251") if cleaned.startswith("+251") else cleaned
    cleaned = cleaned.removeprefix("251") if cleaned.startswith("251") else cleaned
    match = _ETHIOPIAN_PHONE_RE.match(cleaned)
    if not match:
        raise ValueError("Enter a valid Ethiopian mobile number, for example 0912345678.")
    return f"+251{match.group(1)}"


def looks_like_email(value: str) -> bool:
    return bool(_EMAIL_RE.match(value.strip()))


# ---------------------------------------------------------------------------- access tokens
@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    role: str
    locale: str
    full_name: str
    expires_at: datetime
    token_id: str


class TokenError(Exception):
    pass


def create_access_token(
    settings: Settings,
    *,
    user_id: uuid.UUID,
    role: str,
    locale: str,
    full_name: str,
    now: datetime | None = None,
) -> tuple[str, datetime]:
    issued = now or datetime.now(UTC)
    expires = issued + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "locale": locale,
        "name": full_name,
        "typ": ACCESS_TOKEN_TYPE,
        "iss": settings.jwt_issuer,
        "iat": int(issued.timestamp()),
        "exp": int(expires.timestamp()),
        "jti": secrets.token_urlsafe(12),
    }
    token = jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=settings.jwt_algorithm)
    return token, expires


def decode_access_token(settings: Settings, token: str) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "iss"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("typ") != ACCESS_TOKEN_TYPE:
        raise TokenError("wrong token type")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise TokenError("malformed subject") from exc
    return AccessClaims(
        user_id=user_id,
        role=str(payload.get("role", "")),
        locale=str(payload.get("locale", "en")),
        full_name=str(payload.get("name", "")),
        expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
        token_id=str(payload.get("jti", "")),
    )


# ---------------------------------------------------------------------------- refresh tokens
def generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Only the hash is ever persisted."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)
