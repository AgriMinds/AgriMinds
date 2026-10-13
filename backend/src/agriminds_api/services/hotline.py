"""The 977 hotline: a question arrives from a phone, the agent answers, the turn is recorded.

An aggregator posts an inbound message to this service, the same agent that answers in-app decides
what to say, and the reply goes back through whichever provider is configured -- today, none.

Two decisions worth stating, because both are easy to get wrong in a way nobody notices:

* **An unknown number still gets a useful reply and is still logged.** Telling an unregistered
  caller to ask their development agent is more use than silence, and the row is the only evidence
  of demand from farmers the platform has not reached.
* **A reply is never recorded as sent unless a provider says it was.** With no carrier connected
  the row reads `held`, so no report can add these up into farmers served.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from agriminds_api.core.config import Settings
from agriminds_api.core.security import normalise_phone
from agriminds_api.db.models import (
    Direction,
    HotlineChannel,
    HotlineMessage,
    HotlineStatus,
    User,
)
from agriminds_api.schemas.agent import HotlineInbound, HotlineTurn
from agriminds_api.services import agent_phrases as phrases
from agriminds_api.services.agent import AgentService, fit_to_sms
from agriminds_api.services.farm import FarmService
from agriminds_api.services.sms import provider_for

log = logging.getLogger(__name__)

#: A USSD or IVR session is menu-driven, so it always ends with the options again. SMS does not:
#: appending a menu to every SMS doubles the segments the platform pays for.
_MENU_CHANNELS = (HotlineChannel.USSD, HotlineChannel.VOICE)


class HotlineService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        agent: AgentService,
        farms: FarmService,
    ) -> None:
        self._session = session
        self._settings = settings
        self._agent = agent
        self._farms = farms

    async def handle(self, inbound: HotlineInbound) -> HotlineTurn:
        channel = HotlineChannel(inbound.channel)
        try:
            caller = normalise_phone(inbound.caller)
        except ValueError:
            # Nothing can be done with a number that cannot be dialled back, and storing it would
            # pollute the caller history that the registration-demand figures are read from.
            raise ValueError("The calling number is not a valid Ethiopian mobile number.") from None

        user = await self._session.scalar(
            select(User).where(User.phone == caller).options(selectinload(User.woreda))
        )
        locale = inbound.locale or (user.locale.value if user else "en")

        await self._record(
            direction=Direction.INBOUND,
            channel=channel,
            caller=caller,
            body=inbound.text,
            locale=locale,
            user=user,
            session_id=inbound.session_id,
            status=HotlineStatus.RECEIVED,
        )

        if user is None:
            answer_text = phrases.UNKNOWN_CALLER[locale if locale in ("en", "am", "om") else "en"]
            intent = "unknown_caller"
            farm_id = None
        else:
            farms = await self._farms.list_for_owner(user, lead_month=inbound.lead_month)
            answer = self._agent.answer(
                question=inbound.text, locale=locale, farms=farms, lead_month=inbound.lead_month
            )
            answer_text, intent, farm_id = answer.text, answer.intent, answer.farm_id
            if channel in _MENU_CHANNELS and answer.intent != "menu":
                answer_text = f"{answer_text}\n{phrases.MENU[answer.locale].format(code=self._code)}"

        # Cut to what a handset will show. A chat answer is not cut; a text message has to be.
        body = fit_to_sms(answer_text) if channel is HotlineChannel.SMS else answer_text

        sender = provider_for(self._settings.hotline_sms_provider)
        result = sender.send(to=caller, body=body, short_code=self._code)
        outbound = await self._record(
            direction=Direction.OUTBOUND,
            channel=channel,
            caller=caller,
            body=body,
            locale=locale,
            user=user,
            session_id=inbound.session_id,
            intent=intent,
            status=HotlineStatus.SENT if result.delivered else HotlineStatus.HELD,
            provider_message_id=result.message_id,
            error=result.error,
        )

        log.info(
            "hotline %s from %s: intent=%s provider=%s delivered=%s",
            channel.value,
            caller,
            intent,
            result.provider,
            result.delivered,
        )
        return HotlineTurn(
            id=str(outbound.id),
            caller=caller,
            channel=channel.value,
            locale=locale,
            intent=intent,
            reply=body,
            farm_id=farm_id,
            registered=user is not None,
            short_code=self._code,
            provider=result.provider,
            delivered=result.delivered,
            note=result.error,
        )

    async def recent(self, limit: int = 50) -> list[HotlineTurn]:
        """The last turns, newest first. What an operator reads to see the hotline working."""
        rows = (
            await self._session.scalars(
                select(HotlineMessage)
                .where(HotlineMessage.direction == Direction.OUTBOUND)
                .order_by(HotlineMessage.created_at.desc())
                .limit(limit)
            )
        ).all()
        return [
            HotlineTurn(
                id=str(r.id),
                caller=r.caller,
                channel=r.channel.value,
                locale=r.locale,
                intent=r.intent or "",
                reply=r.body,
                farm_id=None,
                registered=r.user_id is not None,
                short_code=r.short_code or self._code,
                provider=self._settings.hotline_sms_provider,
                delivered=r.status is HotlineStatus.SENT,
                note=r.error,
                at=r.created_at,
            )
            for r in rows
        ]

    @property
    def _code(self) -> str:
        return self._settings.hotline_short_code

    async def _record(self, **kwargs) -> HotlineMessage:
        user = kwargs.pop("user", None)
        row = HotlineMessage(short_code=self._code, user_id=user.id if user else None, **kwargs)
        self._session.add(row)
        await self._session.flush()
        return row
