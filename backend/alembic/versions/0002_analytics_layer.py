"""Risk snapshots and a read-only analytics schema for business-intelligence tools.

Two things are added:

* ``risk_snapshots`` persists what the model issued. Forecasts are produced by PyTorch, not by
  the database, so without this a reporting tool can describe who is registered but not what they
  are exposed to.
* An ``analytics`` schema of star-schema views for Power BI and any other SQL client, plus a
  ``agriminds_bi`` role that can read those views and nothing else.

Privacy: the fact views carry a pseudonymous ``farmer_key`` and the district a plot sits in. They
never expose a name, phone number, email address or password hash. A ministry analyst needs to
count and locate farmers, not identify them.

Revision ID: 0002_analytics
Revises: 0001_initial
Create Date: 2026-10-08
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_analytics"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BI_ROLE = "agriminds_bi"

pdsi_category = postgresql.ENUM(
    "Extremely wet",
    "Very wet",
    "Moderately wet",
    "Normal",
    "Moderately dry",
    "Very dry",
    "Extremely dry",
    name="pdsi_category",
    create_type=False,
)

VIEWS = (
    # ---------------------------------------------------------------- dimensions
    (
        "dim_woreda",
        """
        SELECT w.id                AS woreda_key,
               w.code              AS woreda_code,
               w.name_en           AS woreda_en,
               w.name_am           AS woreda_am,
               w.name_om           AS woreda_om,
               w.latitude,
               w.longitude,
               z.code              AS zone_code,
               z.name_en           AS zone_en,
               r.code              AS region_code,
               r.name_en           AS region_en
        FROM woredas w
        JOIN zones   z ON z.id = w.zone_id
        JOIN regions r ON r.id = z.region_id
        """,
    ),
    (
        "dim_crop",
        """
        SELECT c.value::text AS crop_key,
               initcap(c.value::text) AS crop_name
        FROM unnest(enum_range(NULL::crop)) AS c(value)
        """,
    ),
    (
        "dim_risk_level",
        """
        SELECT l.value::text AS risk_level,
               CASE l.value::text
                   WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2
                   WHEN 'High' THEN 3 ELSE 4 END AS severity_order,
               (l.value::text IN ('High', 'Severe')) AS is_at_risk
        FROM unnest(enum_range(NULL::risk_level)) AS l(value)
        """,
    ),
    (
        "dim_pdsi_category",
        """
        SELECT p.value::text AS pdsi_category,
               CASE p.value::text
                   WHEN 'Extremely dry' THEN 1 WHEN 'Very dry' THEN 2
                   WHEN 'Moderately dry' THEN 3 WHEN 'Normal' THEN 4
                   WHEN 'Moderately wet' THEN 5 WHEN 'Very wet' THEN 6 ELSE 7 END AS dry_to_wet_order,
               (p.value::text IN ('Moderately dry', 'Very dry', 'Extremely dry')) AS is_drought
        FROM unnest(enum_range(NULL::pdsi_category)) AS p(value)
        """,
    ),
    (
        # A contiguous month table: BI tools need one to build time intelligence, and it must not
        # have gaps just because no advisory happened to be issued in some month.
        "dim_month",
        """
        WITH bounds AS (
            SELECT date_trunc('month', LEAST(
                       COALESCE((SELECT min(created_at)::date FROM farms), CURRENT_DATE),
                       COALESCE((SELECT min(issued_date) FROM risk_snapshots), CURRENT_DATE)
                   ))::date AS first_month,
                   date_trunc('month', GREATEST(
                       CURRENT_DATE,
                       COALESCE((SELECT max(target_month) FROM risk_snapshots), CURRENT_DATE)
                   ))::date AS last_month
        )
        SELECT m::date                                   AS month_key,
               EXTRACT(YEAR  FROM m)::int                AS year,
               EXTRACT(MONTH FROM m)::int                AS month_number,
               to_char(m, 'Mon')                         AS month_short,
               to_char(m, 'YYYY-MM')                     AS year_month,
               CASE
                   WHEN EXTRACT(MONTH FROM m) BETWEEN 6 AND 9 THEN 'Kiremt (main rains)'
                   WHEN EXTRACT(MONTH FROM m) BETWEEN 2 AND 5 THEN 'Belg (short rains)'
                   ELSE 'Bega (dry season)'
               END                                       AS ethiopian_season
        FROM bounds, generate_series(bounds.first_month, bounds.last_month, interval '1 month') AS m
        """,
    ),
    # ---------------------------------------------------------------- facts
    (
        "fact_farm",
        """
        SELECT f.id                        AS farm_key,
               f.owner_id                  AS farmer_key,
               f.woreda_id                 AS woreda_key,
               f.primary_crop::text        AS crop_key,
               f.area_hectares,
               f.latitude,
               f.longitude,
               f.grid_row,
               f.grid_col,
               date_trunc('month', f.created_at)::date AS registered_month,
               u.locale::text              AS farmer_locale
        FROM farms f
        JOIN users u ON u.id = f.owner_id
        """,
    ),
    (
        "fact_advisory",
        """
        SELECT a.id                        AS advisory_key,
               a.farm_id                   AS farm_key,
               a.user_id                   AS farmer_key,
               f.woreda_id                 AS woreda_key,
               a.crop::text                AS crop_key,
               a.lead_month,
               a.issued_date,
               a.target_month,
               date_trunc('month', a.created_at)::date AS delivered_month,
               a.raw_probability,
               a.adjusted_probability,
               a.risk_level::text          AS risk_level,
               a.model_version,
               a.rules_version,
               a.data_source,
               (a.acknowledged_at IS NOT NULL) AS was_acknowledged,
               a.acknowledged_at
        FROM advisory_records a
        JOIN farms f ON f.id = a.farm_id
        """,
    ),
    (
        "fact_risk",
        """
        SELECT s.id                        AS risk_key,
               s.issued_date,
               s.target_month,
               s.lead_month,
               s.grid_row,
               s.grid_col,
               s.latitude,
               s.longitude,
               s.probability,
               s.risk_level::text          AS risk_level,
               s.pdsi,
               s.pdsi_category::text       AS pdsi_category,
               s.model_version,
               s.data_source
        FROM risk_snapshots s
        """,
    ),
    (
        # Plots joined to the forecast for their own cell: the question a ministry analyst asks.
        "fact_farm_risk",
        """
        SELECT f.id                        AS farm_key,
               f.owner_id                  AS farmer_key,
               f.woreda_id                 AS woreda_key,
               f.primary_crop::text        AS crop_key,
               f.area_hectares,
               s.issued_date,
               s.target_month,
               s.lead_month,
               s.probability,
               s.risk_level::text          AS risk_level,
               s.pdsi,
               s.pdsi_category::text       AS pdsi_category,
               s.model_version
        FROM farms f
        JOIN risk_snapshots s
          ON s.grid_row = f.grid_row AND s.grid_col = f.grid_col
        """,
    ),
    (
        "fact_account",
        """
        SELECT u.id                        AS farmer_key,
               u.role::text                AS role,
               u.locale::text              AS locale,
               u.woreda_id                 AS woreda_key,
               u.is_active,
               date_trunc('month', u.created_at)::date AS registered_month,
               date_trunc('month', u.last_login_at)::date AS last_seen_month
        FROM users u
        """,
    ),
)


def upgrade() -> None:
    bind = op.get_bind()
    pdsi_category.create(bind, checkfirst=True)

    op.create_table(
        "risk_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("issued_date", sa.Date(), nullable=False),
        sa.Column("target_month", sa.Date(), nullable=False),
        sa.Column("model_version", sa.String(64), nullable=False),
        sa.Column("data_source", sa.String(32), nullable=False),
        sa.Column("lead_month", sa.Integer(), nullable=False),
        sa.Column("grid_row", sa.Integer(), nullable=False),
        sa.Column("grid_col", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("probability", sa.Float(), nullable=False),
        sa.Column("risk_level", postgresql.ENUM(name="risk_level", create_type=False), nullable=False),
        sa.Column("pdsi", sa.Float(), nullable=True),
        sa.Column("pdsi_category", pdsi_category, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_risk_snapshots")),
    )
    # One row per cell per lead per run, as a unique index rather than a named constraint: five
    # columns would overrun PostgreSQL's 63-character identifier limit under the naming
    # convention, and the truncated name would drift from the model on every `alembic check`.
    op.create_index(
        "uq_risk_snapshots_run_cell",
        "risk_snapshots",
        ["issued_date", "model_version", "lead_month", "grid_row", "grid_col"],
        unique=True,
    )
    op.create_index(op.f("ix_risk_snapshots_issued_date"), "risk_snapshots", ["issued_date"])
    op.create_index(op.f("ix_risk_snapshots_risk_level"), "risk_snapshots", ["risk_level"])
    op.create_index("ix_risk_snapshots_issued_lead", "risk_snapshots", ["issued_date", "lead_month"])
    op.create_index("ix_risk_snapshots_cell", "risk_snapshots", ["grid_row", "grid_col"])

    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")
    op.execute(
        "COMMENT ON SCHEMA analytics IS 'Read-only star schema for BI tools. No personal identifiers.'"
    )
    for name, body in VIEWS:
        op.execute(f"CREATE OR REPLACE VIEW analytics.{name} AS {body}")

    # A login-less role by default: an operator grants LOGIN and a password deliberately.
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{BI_ROLE}') THEN
                CREATE ROLE {BI_ROLE} NOLOGIN;
            END IF;
            GRANT USAGE ON SCHEMA analytics TO {BI_ROLE};
            GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO {BI_ROLE};
            ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO {BI_ROLE};
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'Not permitted to manage role {BI_ROLE}; create it manually and grant SELECT on schema analytics.';
        END $$;
        """
    )


def downgrade() -> None:
    for name, _ in reversed(VIEWS):
        op.execute(f"DROP VIEW IF EXISTS analytics.{name}")
    op.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
    op.drop_table("risk_snapshots")
    op.get_bind()
    pdsi_category.drop(op.get_bind(), checkfirst=True)
