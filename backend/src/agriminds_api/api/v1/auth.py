"""Sign-in, token rotation and the signed-in person's own profile."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from agriminds_api.api.deps import AuthServiceDep, CurrentUser, SessionDep
from agriminds_api.schemas.auth import (
    AccessTokenOut,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenPair,
    UpdateProfileRequest,
    UserOut,
)
from agriminds_api.schemas.common import ErrorResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

_LOGIN_ERRORS = {
    401: {"model": ErrorResponse, "description": "Wrong credentials, or the account is locked"},
}


@router.post(
    "/login",
    response_model=TokenPair,
    responses=_LOGIN_ERRORS,
    summary="Sign in with an email address or mobile number",
)
async def login(payload: LoginRequest, request: Request, auth: AuthServiceDep) -> TokenPair:
    user, access, refresh, expires_in = await auth.authenticate(
        payload.identifier, payload.password, request.headers.get("user-agent")
    )
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.post(
    "/refresh",
    response_model=AccessTokenOut,
    responses=_LOGIN_ERRORS,
    summary="Exchange a refresh token for a new pair (the old one is revoked)",
)
async def refresh(payload: RefreshRequest, request: Request, auth: AuthServiceDep) -> AccessTokenOut:
    _, access, new_refresh, expires_in = await auth.refresh(
        payload.refresh_token, request.headers.get("user-agent")
    )
    return AccessTokenOut(access_token=access, refresh_token=new_refresh, expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="End the presented session")
async def logout(payload: RefreshRequest, auth: AuthServiceDep) -> Response:
    await auth.logout(payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut, summary="The signed-in person")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut, summary="Update your own name or interface language")
async def update_me(payload: UpdateProfileRequest, user: CurrentUser, session: SessionDep) -> UserOut:
    data = payload.model_dump(exclude_unset=True)
    if data.get("full_name"):
        user.full_name = data["full_name"].strip()
    if data.get("locale"):
        user.locale = data["locale"]
    await session.flush()
    return UserOut.model_validate(user)


@router.post(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change your password (signs out every other device)",
)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, auth: AuthServiceDep
) -> Response:
    await auth.change_password(user, payload.current_password, payload.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
