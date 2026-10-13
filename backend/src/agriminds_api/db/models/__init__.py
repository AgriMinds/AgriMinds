"""ORM models. Importing this package registers every table on ``Base.metadata``."""

from agriminds_api.db.base import Base
from agriminds_api.db.models.advisory import AdvisoryRecord, RiskLevel, risk_level_enum
from agriminds_api.db.models.billing import PricingTier, StakeholderType, stakeholder_type_enum
from agriminds_api.db.models.commerce import ApiKey, ApiUsageDaily, Organization
from agriminds_api.db.models.farm import Crop, Farm, crop_enum
from agriminds_api.db.models.geography import Region, Woreda, Zone
from agriminds_api.db.models.messaging import (
    DeliveryChannel,
    DeliveryStatus,
    MessageBundle,
    MessageDelivery,
    delivery_channel_enum,
    delivery_status_enum,
)
from agriminds_api.db.models.risk import PdsiCategory, RiskSnapshot, pdsi_category_enum
from agriminds_api.db.models.subscription import (
    PERIODS_PER_YEAR,
    BillingPeriod,
    Subscription,
    SubscriptionStatus,
    billing_period_enum,
    subscription_status_enum,
)
from agriminds_api.db.models.user import Locale, RefreshToken, User, UserRole, locale_enum, user_role_enum

__all__ = [
    "AdvisoryRecord",
    "ApiKey",
    "ApiUsageDaily",
    "Base",
    "BillingPeriod",
    "Crop",
    "DeliveryChannel",
    "DeliveryStatus",
    "Farm",
    "Locale",
    "MessageBundle",
    "MessageDelivery",
    "Organization",
    "PdsiCategory",
    "PricingTier",
    "RefreshToken",
    "Region",
    "RiskLevel",
    "PERIODS_PER_YEAR",
    "RiskSnapshot",
    "StakeholderType",
    "Subscription",
    "SubscriptionStatus",
    "User",
    "UserRole",
    "Woreda",
    "Zone",
    "crop_enum",
    "locale_enum",
    "pdsi_category_enum",
    "billing_period_enum",
    "delivery_channel_enum",
    "delivery_status_enum",
    "risk_level_enum",
    "subscription_status_enum",
    "stakeholder_type_enum",
    "user_role_enum",
]
