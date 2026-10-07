import time

from agriminds_api.core.cache import MemoryCache, RedisCache, build_cache


def test_memory_cache_ttl():
    c = MemoryCache()
    c.set("k", b"v", ttl=1)
    assert c.get("k") == b"v"
    c._data["k"] = (time.monotonic() - 1, b"v")  # force expiry
    assert c.get("k") is None


def test_build_cache_without_url_is_memory():
    assert build_cache(None).backend == "memory"


def test_redis_unreachable_degrades_to_memory():
    c = RedisCache("redis://127.0.0.1:1/0")  # nothing listens on port 1
    assert c.ping() is False
    c.set("k", b"v", ttl=10)
    assert c.get("k") == b"v"  # served from the in-process fallback
