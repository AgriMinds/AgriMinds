"""The farmer agent, and the 977 hotline that carries it to a phone."""

from __future__ import annotations

import hashlib
import hmac

from fastapi import APIRouter, Depends, Header, Request

from agriminds_api.api.deps import (
    AgentServiceDep,
    FarmerUser,
    FarmServiceDep,
    HotlineServiceDep,
    SettingsDep,
    require_admin,
)
from agriminds_api.core.exceptions import UnauthorizedError, ValidationError
from agriminds_api.schemas.agent import AgentAnswer, AgentQuestion, HotlineInbound, HotlineTurn
from agriminds_api.schemas.common import ErrorResponse
from agriminds_api.services.agent import SMS_GSM7_LIMIT, SMS_UCS2_LIMIT

router = APIRouter(prefix="/agent", tags=["Farmer agent"])
hotline_router = APIRouter(prefix="/hotline", tags=["Farmer agent"])
admin_router = APIRouter(
    prefix="/admin/hotline", tags=["Farmer agent"], dependencies=[Depends(require_admin)]
)


def _segments(text: str) -> int:
    """How many SMS segments this answer would occupy. Ethiopic halves what fits."""
    limit = SMS_UCS2_LIMIT if any(ord(c) > 127 for c in text) else SMS_GSM7_LIMIT
    return max(1, -(-len(text) // limit))


@router.post(
    "/ask",
    response_model=AgentAnswer,
    summary="Ask the farmer agent a question",
    description=(
        "Answers from **this farmer's own plots** and the forecast for them. The agent chooses "
        "which of the advisory engine's findings answers the question; it does not compose "
        "agronomic advice of its own, so it cannot state a planting date the model never "
        "produced.\n\n"
        "A digit works as well as a sentence — `1` is the drought risk — because the same agent "
        "answers the USSD menu on the hotline.\n\n"
        "When the forecast is unavailable the agent says so rather than answering from a stale "
        "number."
    ),
)
async def ask(
    question: AgentQuestion,
    user: FarmerUser,
    agent: AgentServiceDep,
    farms: FarmServiceDep,
) -> AgentAnswer:
    owned = await farms.list_for_owner(user, question.lead_month)
    answer = agent.answer(
        question=question.text,
        locale=question.locale,
        farms=owned,
        lead_month=question.lead_month,
        farm_id=question.farm_id,
    )
    return AgentAnswer(
        intent=answer.intent,
        text=answer.text,
        locale=answer.locale,
        farm_id=answer.farm_id,
        sources=answer.sources,
        followups=answer.followups,
        sms_segments=_segments(answer.text),
    )


@hotline_router.post(
    "/inbound",
    response_model=HotlineTurn,
    responses={401: {"model": ErrorResponse, "description": "Bad or missing webhook signature"}},
    summary="An SMS, USSD or IVR turn arriving from the carrier",
    description=(
        "Unauthenticated by design: the caller is a phone, not a session. An aggregator posts "
        "here and the signature header is what proves the post came from them, so "
        "`hotline_webhook_secret` must be set before the short code is public.\n\n"
        "The reply is returned **and** recorded. With no aggregator connected it is recorded as "
        "`held`, never `sent`: a row marked sent when nothing left the building becomes a report "
        "claiming the hotline served farmers it never reached."
    ),
)
async def inbound(
    payload: HotlineInbound,
    request: Request,
    hotline: HotlineServiceDep,
    settings: SettingsDep,
    x_hotline_signature: str = Header("", alias="X-Hotline-Signature"),
) -> HotlineTurn:
    await _verify(request, settings.hotline_webhook_secret, x_hotline_signature)
    try:
        return await hotline.handle(payload)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc


@admin_router.get(
    "",
    response_model=list[HotlineTurn],
    summary="What the hotline has been asked lately",
    description=(
        "Newest first. `delivered` is false for every row until a carrier is connected, and "
        "`registered` false means a farmer the platform has not reached asked it something — "
        "which is the most useful column here."
    ),
)
async def recent(hotline: HotlineServiceDep, limit: int = 50) -> list[HotlineTurn]:
    return await hotline.recent(limit=limit)


async def _verify(request: Request, secret: str, signature: str) -> None:
    """HMAC-SHA256 over the raw body, compared in constant time.

    An empty secret skips the check, which is only tolerable while no public short code exists.
    Comparing the computed digest with `compare_digest` rather than `==` keeps the comparison from
    leaking how much of a forged signature was right.
    """
    if not secret:
        return
    body = await request.body()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise UnauthorizedError("The webhook signature did not match.")
