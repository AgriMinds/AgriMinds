"""Async engine and session factory.

The engine is created once in the application lifespan and disposed on shutdown.
Sessions are per-request and never shared between tasks.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from agriminds_api.core.config import Settings

log = logging.getLogger(__name__)


def create_engine(settings: Settings) -> AsyncEngine:
    kwargs: dict = {"echo": settings.db_echo, "pool_pre_ping": True, "future": True}
    # SQLite (used by the test suite) has no connection pool to size.
    if not settings.database_url.startswith("sqlite"):
        kwargs |= {
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_max_overflow,
            "pool_recycle": settings.db_pool_recycle_seconds,
        }
    return create_async_engine(settings.database_url, **kwargs)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


@asynccontextmanager
async def session_scope(factory: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    """Transaction boundary: commit on success, roll back on any exception."""
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()
