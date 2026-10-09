# Analytics

AgriMinds exposes two ways to analyse the data. They are independent: either works without the
other, and **both are free**.

| | What it is | Who it is for | What it costs |
|---|---|---|---|
| **A. Direct connection** | Any SQL client reads the read-only `analytics` schema | Analysts building their own views | Nothing |
| **B. Embedded dashboard** | A Metabase dashboard rendered inside the AgriMinds web app | Ministry staff who should not leave the platform | Nothing — Metabase is open source and self-hosted |

Start with **A**. It needs no extra service at all. Add **B** when you want a dashboard inside the
app for people who will not open a SQL tool themselves.

> Power BI was the original plan and was dropped: app-owns-data embedding needs a paid Fabric or
> Power BI Embedded capacity, which is a recurring licence cost for a public agricultural agency.
> Metabase does the same job — a dashboard in the app, scoped per viewer — with no licence and no
> figure leaving the deployment.

> The farmer dashboard is deliberately *not* part of this. Farmers use a phone, in Amharic or
> Afaan Oromoo, often on a weak connection, and should never need a BI tool to be told whether to
> plant. This is the analytical layer for staff; the native dashboards stay the operational one.

---

## A. Direct connection (start here)

### 1. Enable the read-only login

The migration creates a role called `agriminds_bi` that can read the `analytics` schema and
nothing else. It cannot log in until you give it a password:

```bash
make bi-role password="$(openssl rand -base64 24)"
```

That role cannot see `users`, `refresh_tokens`, password hashes, phone numbers or email
addresses. A test asserts this, so it stays true.

### 2. Connect

Any PostgreSQL client works — Metabase, DBeaver, psql, R, pandas, Excel.

- Server: `your-host:5432` — set `AGRIMINDS_ANALYTICS_PUBLIC_HOST` to this, otherwise the app
  hands out the Compose-internal name `postgres:5432`, which will not resolve from your machine
- Database: `agriminds`
- Schema: `analytics`
- Credentials: `agriminds_bi` and the password from step 1

An administrator can read the current details from the app, or:

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/analytics/connection | jq
```

### 3. The model

The schema is a star. Load the facts you need and all the dimensions; the relationships are the
columns ending in `_key`.

```
dim_woreda ──┐
dim_crop ────┤
dim_month ───┼── fact_farm         one row per registered plot
dim_risk_level ┤   fact_advisory    one row per advisory actually shown to a farmer
dim_pdsi_category ┘ fact_risk       one row per grid cell, lead and model run
                    fact_farm_risk  plots joined to the forecast for their own cell
                    fact_account    accounts by role, district and month (no identifiers)
```

Joins:

| From | To |
|---|---|
| `fact_farm[woreda_key]` | `dim_woreda[woreda_key]` |
| `fact_farm[crop_key]` | `dim_crop[crop_key]` |
| `fact_farm_risk[woreda_key]` | `dim_woreda[woreda_key]` |
| `fact_farm_risk[risk_level]` | `dim_risk_level[risk_level]` |
| `fact_farm_risk[pdsi_category]` | `dim_pdsi_category[pdsi_category]` |
| `fact_advisory[delivered_month]` | `dim_month[month_key]` |
| `fact_risk[target_month]` | `dim_month[month_key]` |

`dim_month` is contiguous and carries `ethiopian_season`, so you can slice by Kiremt, Belg and
Bega rather than by calendar quarter.

`dim_risk_level` and `dim_pdsi_category` carry `severity_order` and `dry_to_wet_order`; sort
display columns by those so a chart reads Low → Severe and dry → wet rather than alphabetically.

### 4. Keeping it current

Forecasts come from the model, not the database, so they are written to `risk_snapshots` after
each run:

```bash
make train       # runs the pipeline, then snapshots automatically
make snapshot    # or snapshot the current model on its own
```

The snapshot is idempotent for a given issue month and model version: re-running corrects rows
rather than duplicating them.

### Two measures worth defining

```sql
-- Plots at risk
SELECT count(*) FROM analytics.fact_farm_risk r
JOIN analytics.dim_risk_level l USING (risk_level)
WHERE l.is_at_risk;

-- Advisory read rate: NULL when nothing was issued, which is correct.
-- No advisories means no rate, not a rate of zero.
SELECT count(*) FILTER (WHERE was_acknowledged)::numeric
     / nullif(count(*), 0) AS read_rate
FROM analytics.fact_advisory;
```

---

## B. Embedded dashboard

Metabase runs beside the stack and reads the same read-only schema. The API signs a short-lived
URL for one published dashboard; the signing secret never reaches the browser.

### Setup

1. **Generate a signing key.** The API and Metabase must share it:

   ```bash
   echo "AGRIMINDS_METABASE_SECRET_KEY=$(openssl rand -hex 32)" >> .env
   ```

2. **Start it.** Metabase is behind a Compose profile, so a minimal deployment stays three
   containers:

   ```bash
   docker compose --profile analytics up -d metabase
   ```

   It takes a minute or two on first boot while it builds its own schema. Then open
   <http://localhost:3001> and create the admin account.

3. **Add the database.** Admin settings → Databases → PostgreSQL.
   Host `postgres`, port `5432`, database `agriminds`, username `agriminds_bi` and the password
   from step A.1. Metabase then sees the `analytics` views and nothing else — not accounts, not
   password hashes, not a farmer's phone number.

4. **Build a dashboard**, then **Sharing → Embed → Static embedding → Publish**. The dashboard id
   is the number in its URL.

   ```bash
   echo "AGRIMINDS_METABASE_DASHBOARD_ID=7" >> .env
   docker compose up -d backend
   ```

The Analytics tab appears once the API can sign a URL. Until then the page says so plainly and
points staff at the native dashboards, rather than rendering a broken frame.

### Scoping an agent to their own district

A development agent should see their own woreda, not the whole watershed. Metabase does this with
a **locked** parameter, which is the equivalent of row-level security:

1. Add a dashboard filter on the woreda code and wire it to the relevant cards.
2. In **Sharing → Embed**, set that parameter to **Locked**.
3. Tell the API its name:

   ```bash
   echo "AGRIMINDS_METABASE_WOREDA_PARAM=woreda_code" >> .env
   ```

The agent's woreda code is then signed into the URL. Metabase refuses to let a locked parameter be
overridden from the query string, so the restriction cannot be lifted by editing anything
client-side. A minister or administrator gets no locked parameter and sees the whole watershed —
the app says which, in the line above the frame.

### Security notes

- The signing secret lives only in the API's environment. The browser receives a signed URL and
  nothing else.
- URLs expire; the frame renews itself before the deadline, on the schedule the server set.
- Metabase connects as `agriminds_bi`, so even a misconfigured question cannot read an account or
  write a row.
- Metabase keeps its own questions and dashboards in a **separate database** (`metabase`) on the
  same server. An analytics tool must not be able to write to the rows it reports on.
- The frame is sandboxed and sent with `referrerPolicy="no-referrer"`.
- Farmers are never routed here: `/analytics` redirects a farmer to their own dashboard.

### If you would rather not run Metabase

Nothing breaks. Leave the variables unset and the tab stays hidden; the national overview and the
watershed forecast already answer the day-to-day questions, in all three languages, on any phone.
Analysts still have the direct connection in **A**.
