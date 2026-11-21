from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class FxRateOut(BaseModel):
    rate_date: date
    rate: Decimal
    source: Literal["NBU"] = "NBU"
