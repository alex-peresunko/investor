from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field

PaymentKind = Literal["coupon", "redemption"]

Money = Annotated[Decimal, Field(max_digits=18, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=2)]
NonNegativeMoney = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=2)]
Quantity = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]
UnitPrice = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=6)]
FxRate = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=6)]
Note = Annotated[str | None, Field(default=None, max_length=500)]
