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
_BACKOFF = 2.0
_TIMEOUT = 120.0
#: A 429 means the provider wants us to slow down, not that the request was malformed. Backing
#: off by seconds does not help: the archives meter by the hour, so waiting out the window is the
#: only thing that works. Rate limits do not count against the retry budget — a transport failure
#: means something is broken, while a 429 just means "later" — but the total wait is capped so a
#: run cannot hang all night unattended.
_RATE_LIMIT_WAIT = 65.0
_RATE_LIMIT_TOTAL_WAIT = 75 * 60.0


#: First month the connectors fetch. ERA5 reaches back to 1940 and CHIRPS to 1981, but MODIS
#: begins in February 2000 and the model needs every channel for the same months, so a longer
#: climate record would only be trimmed away when the grid is assembled.
INGEST_START = "2000-01-01"


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


def fetch_json(url: str, *, params: dict[str, Any] | None = None) -> Any:
    response = _fetch(url, params=params, headers={"Accept": "application/json"})
    try:
        return response.json()
    except ValueError as exc:  # a provider returning HTML on error is common
        raise IngestError(f"{url} did not return JSON: {response.text[:200]}") from exc


def _fetch(url: str, *, params: dict[str, Any] | None, headers: dict[str, str] | None) -> Any:
    try:
        import httpx
    except ModuleNotFoundError as exc:  # pragma: no cover - dependency is declared
        raise IngestError("httpx is required to ingest data: pip install -e 'ml[ingest]'") from exc

    last: Exception | None = None
    attempt = 0
    waited_for_rate_limit = 0.0
    while attempt < _RETRIES:
        try:
            response = httpx.get(url, params=params, headers=headers, timeout=_TIMEOUT, follow_redirects=True)
            response.raise_for_status()
            return response
        except Exception as exc:  # noqa: BLE001 - every transport failure is worth one more try
            last = exc
            if getattr(getattr(exc, "response", None), "status_code", None) == 429:
                if waited_for_rate_limit + _RATE_LIMIT_WAIT > _RATE_LIMIT_TOTAL_WAIT:
                    break
                waited_for_rate_limit += _RATE_LIMIT_WAIT
                log.warning(
                    "%s is rate-limited; waiting %.0fs (%.0f min waited so far)",
                    url,
                    _RATE_LIMIT_WAIT,
                    waited_for_rate_limit / 60,
                )
                time.sleep(_RATE_LIMIT_WAIT)
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
