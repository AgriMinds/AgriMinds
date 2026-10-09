#!/usr/bin/env python3
"""Provision a fresh Metabase so the analytics tab works without a tour of the admin UI.

Four steps that are tedious by hand and identical on every deployment: create the first admin,
connect the read-only `analytics` schema, turn on static embedding, and publish a starter
dashboard answering the four questions the app already promises on its empty state.

Everything is done over Metabase's own API with the one-time setup token, so nothing here needs
a password that is not already in the environment. Re-running is safe: the script stops at the
first step that has already been done rather than duplicating anything.

Usage:
    make analytics-setup                      # uses .env
    python scripts/metabase_setup.py --help
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_URL = "http://localhost:3001"
#: The read-only role. It can read the analytics views and nothing else.
BI_ROLE = "agriminds_bi"

#: The four questions the app's empty state promises. Native SQL rather than Metabase's query
#: builder, so the dashboard is reviewable in this file and survives a schema the builder has
#: not introspected yet.
CARDS: list[dict] = [
    {
        "name": "Registered land by woreda",
        "description": "Farmers, plots and hectares, per district.",
        "display": "bar",
        "sql": """
            SELECT w.woreda_en            AS "Woreda",
                   count(DISTINCT f.farmer_key) AS "Farmers",
                   count(*)               AS "Plots",
                   round(sum(f.area_hectares)::numeric, 1) AS "Hectares"
            FROM analytics.fact_farm f
            JOIN analytics.dim_woreda w USING (woreda_key)
            GROUP BY w.woreda_en
            ORDER BY "Hectares" DESC
        """,
        "size": {"col": 0, "row": 0, "size_x": 12, "size_y": 6},
    },
    {
        "name": "Advisories delivered and read",
        "description": "How many advisories reached a farmer, and how many were acknowledged.",
        "display": "bar",
        "sql": """
            SELECT delivered_month AS "Month",
                   count(*) AS "Delivered",
                   count(*) FILTER (WHERE was_acknowledged) AS "Read"
            FROM analytics.fact_advisory
            GROUP BY delivered_month
            ORDER BY delivered_month
        """,
        "size": {"col": 12, "row": 0, "size_x": 12, "size_y": 6},
    },
    {
        "name": "Forecast history",
        "description": "Mean forecast probability by target month and lead time.",
        "display": "line",
        "sql": """
            SELECT target_month AS "Month",
                   lead_month   AS "Lead",
                   round(avg(probability)::numeric, 3) AS "Mean probability"
            FROM analytics.fact_risk
            GROUP BY target_month, lead_month
            ORDER BY target_month, lead_month
        """,
        "size": {"col": 0, "row": 6, "size_x": 12, "size_y": 6},
    },
    {
        "name": "Crop mix",
        "description": "Hectares registered to each crop.",
        "display": "pie",
        "sql": """
            SELECT c.crop_name AS "Crop",
                   round(sum(f.area_hectares)::numeric, 1) AS "Hectares"
            FROM analytics.fact_farm f
            JOIN analytics.dim_crop c USING (crop_key)
            GROUP BY c.crop_name
            ORDER BY "Hectares" DESC
        """,
        "size": {"col": 12, "row": 6, "size_x": 12, "size_y": 6},
    },
]


class SetupError(RuntimeError):
    pass


def call(url: str, path: str, payload: dict | None = None, *, token: str | None = None, method: str | None = None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"{url.rstrip('/')}{path}",
        data=body,
        method=method or ("POST" if body else "GET"),
        headers={"Content-Type": "application/json", **({"X-Metabase-Session": token} if token else {})},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:400]
        raise SetupError(f"{method or 'GET'} {path} -> {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SetupError(f"cannot reach Metabase at {url}: {exc.reason}") from exc


def wait_for(url: str, attempts: int = 40) -> None:
    for _ in range(attempts):
        try:
            if call(url, "/api/health", method="GET") == {"status": "ok"}:
                return
        except SetupError:
            pass
        time.sleep(5)
    raise SetupError(f"Metabase at {url} did not become healthy")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=os.environ.get("METABASE_URL", DEFAULT_URL))
    parser.add_argument("--email", default=os.environ.get("METABASE_ADMIN_EMAIL", "admin@agriminds.local"))
    parser.add_argument("--password", default=os.environ.get("METABASE_ADMIN_PASSWORD"))
    parser.add_argument("--db-host", default=os.environ.get("METABASE_PG_HOST", "postgres"))
    parser.add_argument("--db-port", type=int, default=int(os.environ.get("METABASE_PG_PORT", "5432")))
    parser.add_argument("--db-name", default=os.environ.get("POSTGRES_DB", "agriminds"))
    parser.add_argument("--db-user", default=os.environ.get("METABASE_PG_USER", BI_ROLE))
    parser.add_argument("--db-password", default=os.environ.get("METABASE_PG_PASSWORD"))
    args = parser.parse_args()

    if not args.password:
        print("error: set METABASE_ADMIN_PASSWORD (at least 8 characters)", file=sys.stderr)
        return 2
    if not args.db_password:
        print(
            f"error: set METABASE_PG_PASSWORD to the '{BI_ROLE}' password.\n"
            '       Create one with: make bi-role password="$(openssl rand -base64 24)"',
            file=sys.stderr,
        )
        return 2

    wait_for(args.url)
    properties = call(args.url, "/api/session/properties", method="GET") or {}

    # ---- 1. the first admin -----------------------------------------------------------
    if properties.get("has-user-setup"):
        print("· admin account already exists; signing in")
        session = call(args.url, "/api/session", {"username": args.email, "password": args.password})
    else:
        token = properties.get("setup-token")
        if not token:
            raise SetupError("Metabase reports no user yet but offers no setup token")
        session = call(
            args.url,
            "/api/setup",
            {
                "token": token,
                "user": {
                    "first_name": "AgriMinds",
                    "last_name": "Admin",
                    "email": args.email,
                    "password": args.password,
                    "site_name": "AgriMinds AI-DREWS",
                },
                "prefs": {"site_name": "AgriMinds AI-DREWS", "allow_tracking": False},
            },
        )
        print(f"· created admin {args.email}")
    sid = session["id"] if isinstance(session, dict) else session
    auth = {"token": sid}

    # ---- 2. the read-only database ----------------------------------------------------
    databases = call(args.url, "/api/database", method="GET", **auth)
    rows = databases["data"] if isinstance(databases, dict) else databases
    existing = next((d for d in rows if d["name"] == "AgriMinds"), None)
    if existing:
        database_id = existing["id"]
        print(f"· database already connected (id {database_id})")
    else:
        created = call(
            args.url,
            "/api/database",
            {
                "name": "AgriMinds",
                "engine": "postgres",
                "details": {
                    "host": args.db_host,
                    "port": args.db_port,
                    "dbname": args.db_name,
                    "user": args.db_user,
                    "password": args.db_password,
                    "schema-filters-type": "inclusion",
                    "schema-filters-patterns": "analytics",
                    "ssl": False,
                },
                "is_on_demand": False,
                "is_full_sync": True,
            },
            **auth,
        )
        database_id = created["id"]
        print(f"· connected the analytics schema as '{args.db_user}' (id {database_id})")

    # Metabase needs to see the views before a question can reference them.
    call(args.url, f"/api/database/{database_id}/sync_schema", {}, **auth)
    for _ in range(30):
        tables = call(args.url, f"/api/database/{database_id}/metadata", method="GET", **auth) or {}
        if any(t.get("name", "").startswith("fact_") for t in tables.get("tables", [])):
            break
        time.sleep(2)
    else:
        print("  (warning: the analytics views have not appeared yet; cards may need a re-sync)")

    # ---- 3. static embedding ----------------------------------------------------------
    # Metabase split this setting in two at v0.51: older instances register only
    # `enable-embedding`, newer ones `enable-embedding-static`. Setting the wrong one is a 500,
    # so try both and require that at least one landed.
    enabled = False
    for setting in ("enable-embedding-static", "enable-embedding"):
        try:
            call(args.url, f"/api/setting/{setting}", {"value": True}, **auth, method="PUT")
            enabled = True
            print(f"· static embedding enabled ({setting})")
        except SetupError:
            continue
    if not enabled:
        raise SetupError("could not enable embedding; turn it on in Admin > Settings > Embedding")

    # ---- 4. a starter dashboard -------------------------------------------------------
    dashboards = call(args.url, "/api/dashboard", method="GET", **auth) or []
    existing_dash = next((d for d in dashboards if d["name"] == "Ministry overview"), None)
    if existing_dash:
        dashboard_id = existing_dash["id"]
        print(f"· dashboard already exists (id {dashboard_id})")
    else:
        dashboard = call(
            args.url,
            "/api/dashboard",
            {"name": "Ministry overview", "description": "Registered land, advisories and forecast history."},
            **auth,
        )
        dashboard_id = dashboard["id"]
        cards = []
        for card in CARDS:
            question = call(
                args.url,
                "/api/card",
                {
                    "name": card["name"],
                    "description": card["description"],
                    "display": card["display"],
                    "dataset_query": {
                        "type": "native",
                        "native": {"query": " ".join(card["sql"].split())},
                        "database": database_id,
                    },
                    "visualization_settings": {},
                },
                **auth,
            )
            cards.append({"id": -len(cards) - 1, "card_id": question["id"], **card["size"]})
        call(args.url, f"/api/dashboard/{dashboard_id}", {"dashcards": cards}, **auth, method="PUT")
        print(f"· created dashboard 'Ministry overview' with {len(cards)} cards (id {dashboard_id})")

    call(
        args.url,
        f"/api/dashboard/{dashboard_id}",
        {"enable_embedding": True, "embedding_params": {}},
        **auth,
        method="PUT",
    )
    print("· dashboard published for embedding")

    print(
        "\nDone. Add this to .env and restart the API:\n"
        f"  AGRIMINDS_METABASE_DASHBOARD_ID={dashboard_id}\n"
        "  docker compose up -d backend\n"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SetupError as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
