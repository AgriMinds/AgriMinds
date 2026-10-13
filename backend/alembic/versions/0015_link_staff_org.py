"""Link ministry staff and development agents to the Ministry of Agriculture organisation.

Accounts created in earlier deployments or prior to the self-serve billing schema had
`organization_id = NULL`. This prevented Ministry staff (`minister@moa.gov.et`) and Development
Agents (`agent.sinan@moa.gov.et`) from viewing or selecting commercial subscription plans on `/billing`.

This migration ensures the "FDRE Ministry of Agriculture" organisation exists with stakeholder type
`federal_ministry`, and connects all relevant ministry staff to it.

Revision ID: 0015_link_staff_org
Revises: 0014_signup
Create Date: 2026-10-13
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_link_staff_org"
down_revision: str | None = "0014_signup"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MINISTRY_NAME = "FDRE Ministry of Agriculture"


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Locate or create the Ministry of Agriculture organisation
    row = bind.execute(
        sa.text(
            "SELECT id FROM organizations "
            "WHERE name IN ('FDRE Ministry of Agriculture', 'Ministry of Agriculture (demo account)') "
            "   OR stakeholder = 'federal_ministry'::stakeholder_type "
            "ORDER BY created_at ASC LIMIT 1"
        )
    ).first()

    if row is not None:
        ministry_id = row[0]
        bind.execute(
            sa.text(
                "UPDATE organizations "
                "SET name = :name, stakeholder = 'federal_ministry'::stakeholder_type, "
                "    contact_email = COALESCE(contact_email, 'minister@moa.gov.et'), is_active = true "
                "WHERE id = :id"
            ),
            {"name": MINISTRY_NAME, "id": ministry_id},
        )
    else:
        ministry_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO organizations (id, name, stakeholder, contact_email, is_active, created_at, updated_at) "
                "VALUES (:id, :name, 'federal_ministry'::stakeholder_type, 'minister@moa.gov.et', true, now(), now())"
            ),
            {"id": ministry_id, "name": MINISTRY_NAME},
        )

    # 2. Attach ministry and agent staff to this organisation
    bind.execute(
        sa.text(
            """
            UPDATE users
            SET organization_id = :ministry_id
            WHERE email IN ('minister@moa.gov.et', 'agent.sinan@moa.gov.et')
               OR (organization_id IS NULL AND (email LIKE '%@moa.gov.et' OR role IN ('minister', 'agent')))
            """
        ),
        {"ministry_id": ministry_id},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE users
            SET organization_id = NULL
            WHERE email IN ('minister@moa.gov.et', 'agent.sinan@moa.gov.et')
            """
        )
    )
