"""ORM models. Importing this package registers every table on ``Base.metadata``."""

from agriminds_api.db.base import Base
from agriminds_api.db.models.advisory import AdvisoryRecord, RiskLevel, risk_level_enum
from agriminds_api.db.models.farm import Crop, Farm, crop_enum
from agriminds_api.db.models.geography import Region, Woreda, Zone
from agriminds_api.db.models.risk import PdsiCategory, RiskSnapshot, pdsi_category_enum
from agriminds_api.db.models.user import Locale, RefreshToken, User, UserRole, locale_enum, user_role_enum

__all__ = [
    "AdvisoryRecord",
    "Base",
    "Crop",
    "Farm",
    "Locale",
    "PdsiCategory",
    "RefreshToken",
    "Region",
    "RiskLevel",
    "RiskSnapshot",
    "User",
    "UserRole",
    "Woreda",
    "Zone",
    "crop_enum",
    "locale_enum",
    "pdsi_category_enum",
    "risk_level_enum",
    "user_role_enum",
]
