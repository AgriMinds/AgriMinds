"""What the platform actually sells, as three packages.

The rate card prices a *segment*; this names what that segment receives. Keeping the two
connected is what stops a price existing for something nobody has defined.
"""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from agriminds_api.db.base import Base, Timestamps, UUIDPrimaryKey


class Product(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "products"

    code: Mapped[str] = mapped_column(String(4), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text)
    #: Stakeholder keys this package serves. An array rather than a join table: three rows, and
    #: nothing else references the pairing.
    stakeholders: Mapped[list[str]] = mapped_column(ARRAY(String(40)))
