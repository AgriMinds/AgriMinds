"""Shared plumbing for the data connectors.

Every connector writes two things: a tidy CSV under ``raw/sources/`` and a manifest under
``raw/manifests/``. The manifest is what lets the rest of the system tell real data from a
stand-in: nothing downstream may infer provenance from a file merely existing, because the
synthetic generator writes to the same tree.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ai_drews.config import DataPaths

log = logging.getLogger(__name__)

#: Nothing is retried forever: a connector that cannot reach its provider must fail loudly so the
#: operator sees it, rather than quietly leaving the previous month's file in place.
_RETRIES = 5
_BACKOFF = 3.0
_TIMEOUT = 120.0
#: Hourly wind responses can be ~1 MB per cell-window; the archive is slower under load.
#: 420 s (7 min) gives a genuine slow response time to complete without burning a retry.
_WIND_TIMEOUT = 420.0
#: A 429 means the provider wants us to slow down, not that the request was malformed. Backing
#: off by seconds does not help: the archives meter by the hour, so waiting out the window is the
#: only thing that works. Rate limits do not count against the retry budget — a transport failure
#: means something is broken, while a 429 just means "later" — but the total wait is capped so a
#: run cannot hang all night unattended.
_RATE_LIMIT_WAIT = 65.0
_RATE_LIMIT_TOTAL_WAIT = 75 * 60.0


#: First month the connectors fetch. ERA5 reaches back to 1940 and CHIRPS to 1981. The record
#: used to start in 2000 because MODIS does, but greenness is opt-in and absent by default, so
#: the limit no longer binds. 1994 roughly doubles the training record, which is the cheapest
#: thing available to a model whose skill currently runs out after one month.
INGEST_START = "1994-01-01"


class IngestError(RuntimeError):
    """A connector could not retrieve what it was asked for."""


@dataclass(frozen=True)
class Manifest:
    """What was retrieved, from where, and when."""

    key: str
    provider: str
    source_url: str
    citation: str
    retrieved_at: str
    records: int
    coverage_start: str | None
    coverage_end: str | None
    variables: tuple[str, ...]
    notes: str = ""

    @classmethod
    def now(
        cls,
        key: str,
        provider: str,
        source_url: str,
        citation: str,
        records: int,
        coverage: tuple[str | None, str | None],
        variables: Sequence[str],
        notes: str = "",
    ) -> Manifest:
        return cls(
            key=key,
            provider=provider,
            source_url=source_url,
            citation=citation,
            retrieved_at=datetime.now(UTC).isoformat(timespec="seconds"),
            records=records,
            coverage_start=coverage[0],
            coverage_end=coverage[1],
            variables=tuple(variables),
            notes=notes,
        )


def manifests_dir(paths: DataPaths) -> Path:
    return paths.raw / "manifests"


def sources_dir(paths: DataPaths) -> Path:
    return paths.raw / "sources"


def write_manifest(paths: DataPaths, manifest: Manifest) -> Path:
    target = manifests_dir(paths)
    target.mkdir(parents=True, exist_ok=True)
    path = target / f"{manifest.key}.json"
    path.write_text(json.dumps(asdict(manifest), indent=2) + "\n", encoding="utf-8")
    log.info("wrote manifest %s (%d records)", path, manifest.records)
    return path


def read_manifest(paths: DataPaths, key: str) -> Manifest | None:
    path = manifests_dir(paths) / f"{key}.json"
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        raw["variables"] = tuple(raw.get("variables", ()))
        return Manifest(**raw)
    except Exception:  # noqa: BLE001 - an unreadable manifest means we know nothing about the data
        log.warning("manifest %s is unreadable; treating the source as unconnected", path)
        return None


def read_manifests(paths: DataPaths) -> dict[str, Manifest]:
    directory = manifests_dir(paths)
    if not directory.is_dir():
        return {}
    found = {}
    for path in sorted(directory.glob("*.json")):
        manifest = read_manifest(paths, path.stem)
        if manifest is not None:
            found[manifest.key] = manifest
    return found


def fetch_text(
    url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None
) -> str:
    """GET a URL as text, retrying transient failures with a widening backoff."""
    return _fetch(url, params=params, headers=headers).text


def fetch_bytes(url: str, *, params: dict[str, Any] | None = None) -> bytes:
    return _fetch(url, params=params, headers=None).content


def fetch_json(url: str, *, params: dict[str, Any] | None = None, timeout: float = _TIMEOUT) -> Any:
    response = _fetch(url, params=params, headers={"Accept": "application/json"}, timeout=timeout)
    try:
        return response.json()
    except ValueError as exc:  # a provider returning HTML on error is common
        raise IngestError(f"{url} did not return JSON: {response.text[:200]}") from exc


def _fetch(
    url: str,
    *,
    params: dict[str, Any] | None,
    headers: dict[str, str] | None,
    timeout: float = _TIMEOUT,
) -> Any:
    import os

    try:
        import httpx
    except ModuleNotFoundError as exc:  # pragma: no cover - dependency is declared
        raise IngestError("httpx is required to ingest data: pip install -e 'ml[ingest]'") from exc

    request_params = dict(params) if params is not None else {}
    api_key = os.getenv("OPEN_METEO_API_KEY")
    if api_key and "open-meteo.com" in url and "apikey" not in request_params:
        request_params["apikey"] = api_key

    last: Exception | None = None
    attempt = 0
    waited_for_rate_limit = 0.0
    while attempt < _RETRIES:
        try:
            response = httpx.get(
                url,
                params=request_params if request_params else None,
                headers=headers,
                timeout=timeout,
                follow_redirects=True,
            )
            response.raise_for_status()
            return response
        except Exception as exc:  # noqa: BLE001 - every transport failure is worth one more try
            last = exc
            resp = getattr(exc, "response", None)
            if getattr(resp, "status_code", None) == 429:
                reason = ""
                try:
                    reason = str(resp.json().get("reason", ""))
                except Exception:
                    reason = getattr(resp, "text", "")[:200]

                if any(kw in reason.lower() for kw in ("daily", "tomorrow", "quota", "limit exceeded")):
                    raise IngestError(
                        f"{url} exceeded daily rate limit (HTTP 429: {reason}). "
                        "The Open-Meteo free tier daily request quota has been reached for this IP. "
                        "Set OPEN_METEO_API_KEY in your environment to use an API key, or wait until tomorrow (00:00 UTC)."
                    ) from exc

                retry_after_str = resp.headers.get("retry-after") if hasattr(resp, "headers") else None
                wait_step = _RATE_LIMIT_WAIT
                if retry_after_str:
                    try:
                        wait_step = float(retry_after_str)
                    except ValueError:
                        pass

                if wait_step > 300.0:
                    raise IngestError(
                        f"{url} requested a long rate-limit wait ({wait_step:.0f}s): {reason}"
                    ) from exc

                if waited_for_rate_limit + wait_step > _RATE_LIMIT_TOTAL_WAIT:
                    break
                waited_for_rate_limit += wait_step
                log.warning(
                    "%s is rate-limited (%s); waiting %.0fs (%.0f min waited so far)",
                    url,
                    reason or "429 Too Many Requests",
                    wait_step,
                    waited_for_rate_limit / 60,
                )
                time.sleep(wait_step)
                # Reset the transport-failure counter: the 429 backoff already served as the
                # pause, so the next attempt should get a full retry budget.
                attempt = 0
                continue
            attempt += 1
            if attempt >= _RETRIES:
                break
            wait = _BACKOFF**attempt
            log.warning("%s failed (attempt %d/%d): %s; retrying in %.0fs", url, attempt, _RETRIES, exc, wait)
            time.sleep(wait)
    raise IngestError(f"could not retrieve {url}: {last}")


def month_floor(value: str) -> str:
    """``2024-06-17`` -> ``2024-06-01``; the whole pipeline is monthly."""
    return f"{value[:7]}-01"


def coverage_of(dates: Iterable[str]) -> tuple[str | None, str | None]:
    ordered = sorted(dates)
    return (ordered[0], ordered[-1]) if ordered else (None, None)
