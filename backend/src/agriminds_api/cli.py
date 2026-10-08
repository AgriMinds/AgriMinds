"""Administrative commands: ``agriminds --help``."""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

import typer
from sqlalchemy import select

from agriminds_api.core.config import get_settings
from agriminds_api.core.security import (
    PasswordPolicyError,
    hash_password,
    looks_like_email,
    normalise_email,
    normalise_phone,
    validate_password_strength,
)
from agriminds_api.db.models import Locale, User, UserRole
from agriminds_api.db.seed import DEMO_PASSWORD, seed_demo, seed_geography
from agriminds_api.db.session import create_engine, create_session_factory, session_scope

app = typer.Typer(help="AgriMinds API administration.", no_args_is_help=True)


def _bootstrap():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    settings = get_settings()
    engine = create_engine(settings)
    return settings, engine, create_session_factory(engine)


def _run(coro_factory) -> None:
    async def main() -> None:
        settings, engine, factory = _bootstrap()
        try:
            async with session_scope(factory) as session:
                await coro_factory(session, settings)
        finally:
            await engine.dispose()

    asyncio.run(main())


@app.command()
def seed(
    demo: Annotated[
        bool, typer.Option("--demo", help="Also create demonstration accounts and plots")
    ] = False,
    password: Annotated[str, typer.Option(help="Password for the demonstration accounts")] = DEMO_PASSWORD,
) -> None:
    """Load reference geography, and optionally a demonstration dataset."""

    async def work(session, settings) -> None:
        woredas = await seed_geography(session)
        typer.echo(f"geography: {len(woredas)} woredas in Amhara / East Gojjam")
        if demo:
            totals = await seed_demo(session, settings, password)
            typer.echo(
                f"demo accounts: +{totals['users_created']} users, +{totals['farms_created']} plots "
                f"(totals: {totals['users_total']} users, {totals['farms_total']} plots)"
            )
            typer.secho(
                "\nDemonstration sign-ins (development only):\n"
                f"  minister@moa.gov.et      {password}   ministry dashboard\n"
                f"  agent.sinan@moa.gov.et   {password}   ministry dashboard, Sinan woreda only\n"
                f"  0912000001               {password}   farmer dashboard\n",
                fg=typer.colors.YELLOW,
            )

    _run(work)


@app.command("create-user")
def create_user(
    identifier: Annotated[str, typer.Argument(help="Email address or Ethiopian mobile number")],
    full_name: Annotated[str, typer.Option("--name", prompt=True)],
    role: Annotated[UserRole, typer.Option(case_sensitive=False)] = UserRole.ADMIN,
    locale: Annotated[Locale, typer.Option(case_sensitive=False)] = Locale.EN,
    password: Annotated[str, typer.Option(prompt=True, hide_input=True, confirmation_prompt=True)] = ...,
) -> None:
    """Create an account. Use this to make the first administrator."""

    async def work(session, settings) -> None:
        try:
            validate_password_strength(password, settings.password_min_length)
        except PasswordPolicyError as exc:
            raise typer.BadParameter(str(exc)) from exc

        email = phone = None
        if looks_like_email(identifier):
            email = normalise_email(identifier)
            clause = User.email == email
        else:
            try:
                phone = normalise_phone(identifier)
            except ValueError as exc:
                raise typer.BadParameter(str(exc)) from exc
            clause = User.phone == phone

        if await session.scalar(select(User).where(clause)):
            raise typer.BadParameter(f"An account already exists for {identifier}.")

        session.add(
            User(
                email=email,
                phone=phone,
                full_name=full_name,
                hashed_password=hash_password(password),
                role=role,
                locale=locale,
            )
        )
        typer.secho(f"created {role.value} account for {email or phone}", fg=typer.colors.GREEN)

    _run(work)


@app.command("snapshot-risk")
def snapshot_risk() -> None:
    """Persist the current forecast to `risk_snapshots` so SQL and BI tools can read it.

    Run this after every pipeline run. It is idempotent for a given issue month and model.
    """

    async def work(session, settings) -> None:
        from starlette.concurrency import run_in_threadpool

        from agriminds_api.core.cache import build_cache
        from agriminds_api.domain.geo import GridSpec
        from agriminds_api.services.inference import InferenceService
        from agriminds_api.services.snapshot import write_risk_snapshot

        inference = InferenceService(settings, build_cache(None))
        await run_in_threadpool(inference.load)
        grid = GridSpec.from_bbox(settings.grid_rows, settings.grid_cols, settings.bbox)
        typer.echo(await write_risk_snapshot(session, inference, grid))

    _run(work)


@app.command("list-users")
def list_users(limit: int = 50) -> None:
    """List accounts, newest first."""

    async def work(session, settings) -> None:
        users = (await session.scalars(select(User).order_by(User.created_at.desc()).limit(limit))).all()
        if not users:
            typer.echo("no accounts yet; run: agriminds seed --demo")
            return
        for user in users:
            status = "" if user.is_active else " (inactive)"
            typer.echo(f"{user.role.value:9} {user.identifier:28} {user.full_name}{status}")

    _run(work)


if __name__ == "__main__":
    app()
