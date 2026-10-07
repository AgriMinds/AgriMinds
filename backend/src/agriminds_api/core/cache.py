"""Small cache abstraction: Redis when configured and reachable, otherwise an in-process dict.

Values are bytes; callers serialise. Redis failures degrade to memory with a warning rather than
failing requests, because a cache outage must never take the early-warning API down.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Protocol

log = logging.getLogger(__name__)


class Cache(Protocol):
    backend: str

    def get(self, key: str) -> bytes | None: ...
    def set(self, key: str, value: bytes, ttl: int) -> None: ...
    def ping(self) -> bool: ...


class MemoryCache:
    backend = "memory"

    def __init__(self) -> None:
        self._data: dict[str, tuple[float, bytes]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> bytes | None:
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return None
            expires, value = item
            if expires < time.monotonic():
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: bytes, ttl: int) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + ttl, value)

    def ping(self) -> bool:
        return True


class RedisCache:
    backend = "redis"

    def __init__(self, url: str) -> None:
        import redis

        self._client = redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
        self._fallback = MemoryCache()

    def get(self, key: str) -> bytes | None:
        try:
            return self._client.get(key)
        except Exception as exc:  # noqa: BLE001 - any redis failure degrades to memory
            log.warning("redis get failed (%s); using memory cache", exc.__class__.__name__)
            return self._fallback.get(key)

    def set(self, key: str, value: bytes, ttl: int) -> None:
        try:
            self._client.set(key, value, ex=ttl)
        except Exception as exc:  # noqa: BLE001
            log.warning("redis set failed (%s); using memory cache", exc.__class__.__name__)
        self._fallback.set(key, value, ttl)

    def ping(self) -> bool:
        try:
            return bool(self._client.ping())
        except Exception:  # noqa: BLE001
            return False


def build_cache(redis_url: str | None) -> Cache:
    if not redis_url:
        return MemoryCache()
    cache = RedisCache(redis_url)
    if cache.ping():
        log.info("cache backend: redis")
    else:
        log.warning("redis at %s not reachable at startup; requests will fall back to memory cache", redis_url)
    return cache
