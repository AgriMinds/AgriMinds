# Power BI integration

AgriMinds exposes two ways to use Power BI. They are independent: either works without the other.

| | What it is | Who it is for | What it costs |
|---|---|---|---|
| **A. Direct connection** | Power BI Desktop reads the read-only `analytics` schema over SQL | Analysts building their own reports | Nothing beyond Power BI Desktop (free) |
| **B. Embedded report** | A published report rendered inside the AgriMinds web app | Ministry staff who should not leave the platform | A paid Fabric/Power BI capacity |

Start with **A**. It needs no Azure tenant, no licence and no capacity, and it is what most ministries
actually need. Add **B** only when you want the report inside the app for people who will not open
Power BI themselves.

> The farmer dashboard is deliberately *not* part of this. Farmers use a phone, in Amharic or Afaan
> Oromoo, often on a weak connection, and should never need a Microsoft licence to be told whether
> to plant. Power BI is the analytical layer for staff; the native dashboards stay the operational one.

---

## A. Direct connection (start here)

### 1. Enable the read-only login

The migration creates a role called `agriminds_bi` that can read the `analytics` schema and nothing
else. It cannot log in until you give it a password:

```bash
make bi-role password="$(openssl rand -base64 24)"
```

That role cannot see `users`, `refresh_tokens`, password hashes, phone numbers or email addresses.
A test asserts this, so it stays true.

### 2. Connect

In Power BI Desktop: **Get Data → PostgreSQL database**.

- Server: `your-host:5432` — set `AGRIMINDS_ANALYTICS_PUBLIC_HOST` to this, otherwise the app
  hands out the Compose-internal name `postgres:5432`, which will not resolve from your machine
- Database: `agriminds`
- Data Connectivity mode: **Import** for a watershed of this size; **DirectQuery** if figures must be live
- Credentials: `agriminds_bi` and the password from step 1

An administrator can download a ready-made connection file from the app, or:

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/analytics/connection.pbids -o agriminds.pbids
```

Opening that file starts Power BI Desktop on the right database.

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

Relationships to create in Power BI:

| From | To |
|---|---|
| `fact_farm[woreda_key]` | `dim_woreda[woreda_key]` |
| `fact_farm[crop_key]` | `dim_crop[crop_key]` |
| `fact_farm_risk[woreda_key]` | `dim_woreda[woreda_key]` |
| `fact_farm_risk[risk_level]` | `dim_risk_level[risk_level]` |
| `fact_farm_risk[pdsi_category]` | `dim_pdsi_category[pdsi_category]` |
| `fact_advisory[delivered_month]` | `dim_month[month_key]` |
| `fact_risk[target_month]` | `dim_month[month_key]` |

Mark `dim_month` as the date table on `month_key`. It is contiguous and carries
`ethiopian_season`, so you can slice by Kiremt, Belg and Bega rather than by calendar quarter.

`dim_risk_level` and `dim_pdsi_category` carry `severity_order` and `dry_to_wet_order`; sort the
display columns by those so a chart reads Low → Severe and dry → wet rather than alphabetically.

### 4. Keeping it current

Forecasts come from the model, not the database, so they are written to `risk_snapshots` after each
run:

```bash
make train       # runs the pipeline, then snapshots automatically
make snapshot    # or snapshot the current model on its own
```

The snapshot is idempotent for a given issue month and model version: re-running corrects rows
rather than duplicating them. For a DirectQuery report this is all you need; for Import mode,
schedule a refresh after the pipeline runs.

### Two measures worth defining

```dax
Plots at risk =
CALCULATE ( COUNTROWS ( fact_farm_risk ), dim_risk_level[is_at_risk] = TRUE () )

Advisory read rate =
DIVIDE (
    CALCULATE ( COUNTROWS ( fact_advisory ), fact_advisory[was_acknowledged] = TRUE () ),
    COUNTROWS ( fact_advisory )
)
```

`Advisory read rate` is blank when nothing has been issued, which is correct: no advisories means
no rate, not a rate of zero.

---

## B. Embedded report

Embedding uses the **app owns data** model. One service principal holds the licence and the
AgriMinds server mints a short-lived token for each viewer, so staff need no Power BI licence of
their own and the client secret never reaches a browser.

**This needs a paid capacity** (Fabric F-SKU or Power BI Embedded A-SKU). Without one, the API
returns `503 powerbi_not_configured` and the web app shows the setup instructions instead of a
broken frame.

### Setup

1. **Entra ID → App registrations → New registration** (single tenant). Record the Application
   (client) ID and Directory (tenant) ID, then create a client secret.
2. Put the app in a security group. In the **Power BI admin portal → Tenant settings**, enable
   *Allow service principals to use Power BI APIs* for that group.
3. In the Power BI **workspace → Access**, add the security group as **Member**.
4. Assign the workspace to a capacity.
5. Publish your report. The ids are in its URL:
   `app.powerbi.com/groups/<workspace-id>/reports/<report-id>`
6. Set these and restart the API:

```bash
AGRIMINDS_POWERBI_TENANT_ID=...
AGRIMINDS_POWERBI_CLIENT_ID=...
AGRIMINDS_POWERBI_CLIENT_SECRET=...
AGRIMINDS_POWERBI_WORKSPACE_ID=...
AGRIMINDS_POWERBI_REPORT_ID=...
```

Check it with `GET /api/v1/analytics/powerbi/status`, which reports what is still unset.

### Scoping an agent to their own district

A development agent should see only the woreda they are posted to. Define row-level security in the
dataset and let the server assert it, so it cannot be lifted client-side.

In Power BI Desktop, **Modeling → Manage roles**, create a role (for example `WoredaScope`) on
`dim_woreda`:

```dax
[woreda_code] = CUSTOMDATA() || CUSTOMDATA() = ""
```

Then set:

```bash
AGRIMINDS_POWERBI_DATASET_ID=...
AGRIMINDS_POWERBI_RLS_ROLE=WoredaScope
```

The server puts the agent's woreda code in `CUSTOMDATA()` when it mints the token. Ministers and
administrators get the same role with no custom data, so the `|| CUSTOMDATA() = ""` branch gives
them the whole watershed. The embed response reports which scope was applied, and the web app shows
it, so a viewer always knows whether they are seeing everything.

### Security notes

- The client secret stays server-side. Only a short-lived embed token, scoped to one report, is
  sent to the browser.
- The embed endpoint is staff-only; a farmer receives 403.
- Token errors are logged with their status code but returned to the client as a generic message,
  so tenant configuration is not echoed to end users.
- Rotate the client secret on the schedule your tenant requires; the server picks up a new value on
  restart.
