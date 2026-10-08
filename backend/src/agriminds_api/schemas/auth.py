from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["farmer", "agent", "minister", "admin"]
LocaleCode = Literal["en", "am", "or"]


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name_en: str
    name_am: str
    name_om: str


class WoredaOut(PlaceOut):
    latitude: float
    longitude: float
    zone_name_en: str | None = None
    region_name_en: str | None = None


class LoginRequest(BaseModel):
    """Ministry staff sign in with email, farmers with their mobile number."""

    identifier: str = Field(
        min_length=3,
        max_length=254,
        description="Email address or Ethiopian mobile number (09…, 2519… or +2519…)",
        examples=["minister@moa.gov.et", "0912000001"],
    )
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None
    phone: str | None
    full_name: str
    role: Role
    locale: LocaleCode
    is_active: bool
    last_login_at: datetime | None
    woreda: WoredaOut | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Access-token lifetime in seconds")
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=16, max_length=512)


class AccessTokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=160)
    locale: LocaleCode | None = None
