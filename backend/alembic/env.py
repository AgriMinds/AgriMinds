"""Alembic environment.

Uses the same async driver as the application (asyncpg), so there is only ever one
PostgreSQL driver in the dependency tree.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.pool import NullPool

from agriminds_api.core.config import get_settings
from agriminds_api.db.models import Base  # noqa: F401 - importing registers every table

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
DATABASE_URL = get_settings().database_url


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = async_engine_from_config(
        {"sqlalchemy.url": DATABASE_URL}, prefix="sqlalchemy.", poolclass=NullPool, future=True
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
        # The async connection owns the transaction: without this the DDL is rolled back on close.
        await connection.commit()
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
