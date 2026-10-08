"""Credential primitives: hashing, identifier normalisation, token issue and decode."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from agriminds_api.core import security
from agriminds_api.core.config import Settings

SETTINGS = Settings(_env_file=None, jwt_secret="unit-test-secret", env="test", access_token_ttl_minutes=15)


class TestPasswords:
    def test_hash_is_argon2id_and_salted(self):
        a, b = (
            security.hash_password("correct horse battery"),
            security.hash_password("correct horse battery"),
        )
        assert a.startswith("$argon2id$")
        assert a != b, "identical passwords must not produce identical hashes"

    def test_verify_round_trip(self):
        hashed = security.hash_password("correct horse battery")
        assert security.verify_password("correct horse battery", hashed) == (True, None)
        assert security.verify_password("wrong", hashed) == (False, None)

    def test_verify_rejects_garbage_hash_without_raising(self):
        assert security.verify_password("anything", "not-a-hash") == (False, None)

    def test_dummy_verify_does_not_raise(self):
        security.dummy_verify()

    @pytest.mark.parametrize("bad", ["short", "password", "AgriMinds", "a" * 300])
    def test_weak_passwords_rejected(self, bad):
        with pytest.raises(security.PasswordPolicyError):
            security.validate_password_strength(bad, 10)

    def test_long_passphrase_accepted(self):
        security.validate_password_strength("tef harvest season 2026", 10)


class TestIdentifiers:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("0912345678", "+251912345678"),
            ("+251912345678", "+251912345678"),
            ("251912345678", "+251912345678"),
            ("0912 345 678", "+251912345678"),
            ("091-234-5678", "+251912345678"),
            ("0712345678", "+251712345678"),
        ],
    )
    def test_phone_normalisation(self, raw, expected):
        assert security.normalise_phone(raw) == expected

    @pytest.mark.parametrize("bad", ["12345", "0812345678", "+1 555 0100", "not a phone", ""])
    def test_invalid_phone_rejected(self, bad):
        with pytest.raises(ValueError):
            security.normalise_phone(bad)

    def test_email_detection_and_normalisation(self):
        assert security.looks_like_email("Minister@MoA.gov.et")
        assert not security.looks_like_email("0912345678")
        assert security.normalise_email("  Minister@MoA.gov.et ") == "minister@moa.gov.et"


class TestAccessTokens:
    def _issue(self, **kwargs):
        return security.create_access_token(
            SETTINGS,
            user_id=kwargs.pop("user_id", uuid.uuid4()),
            role=kwargs.pop("role", "farmer"),
            locale=kwargs.pop("locale", "am"),
            full_name=kwargs.pop("full_name", "Abebe Kebede"),
            **kwargs,
        )

    def test_round_trip_carries_identity(self):
        user_id = uuid.uuid4()
        token, expires = self._issue(user_id=user_id)
        claims = security.decode_access_token(SETTINGS, token)
        assert claims.user_id == user_id
        assert (claims.role, claims.locale, claims.full_name) == ("farmer", "am", "Abebe Kebede")
        assert claims.expires_at == expires.replace(microsecond=0)

    def test_expired_token_rejected(self):
        token, _ = self._issue(now=datetime.now(UTC) - timedelta(hours=2))
        with pytest.raises(security.TokenError):
            security.decode_access_token(SETTINGS, token)

    def test_token_signed_with_another_secret_rejected(self):
        other = Settings(_env_file=None, jwt_secret="a-different-secret", env="test")
        token, _ = security.create_access_token(
            other, user_id=uuid.uuid4(), role="admin", locale="en", full_name="X"
        )
        with pytest.raises(security.TokenError):
            security.decode_access_token(SETTINGS, token)

    def test_wrong_issuer_rejected(self):
        other = Settings(
            _env_file=None, jwt_secret="unit-test-secret", env="test", jwt_issuer="somewhere-else"
        )
        token, _ = security.create_access_token(
            other, user_id=uuid.uuid4(), role="admin", locale="en", full_name="X"
        )
        with pytest.raises(security.TokenError):
            security.decode_access_token(SETTINGS, token)

    @pytest.mark.parametrize("junk", ["", "abc", "a.b.c"])
    def test_malformed_token_rejected(self, junk):
        with pytest.raises(security.TokenError):
            security.decode_access_token(SETTINGS, junk)


class TestRefreshTokens:
    def test_generated_tokens_are_unique_and_hashed(self):
        raw_a, hash_a = security.generate_refresh_token()
        raw_b, hash_b = security.generate_refresh_token()
        assert raw_a != raw_b and hash_a != hash_b
        assert hash_a == security.hash_refresh_token(raw_a)
        assert len(hash_a) == 64
        assert raw_a not in hash_a, "the raw secret must not be recoverable from the stored hash"
