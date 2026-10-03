from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    username: str
    password: str
    two_factor_code: Optional[str] = Field(default=None, alias="twoFactorCode")

    model_config = ConfigDict(populate_by_name=True)


class AssetCreate(BaseModel):
    portfolio_id: int
    asset_type: str = Field(max_length=50)
    symbol: Optional[str] = Field(default=None, max_length=20)
    name: str = Field(max_length=200)
    quantity: float
    purchase_price: float
    current_price: Optional[float] = None
    purchase_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("purchase_date", mode="before")
    @classmethod
    def empty_date_to_none(cls, value):
        return value or None


class PriceUpdate(BaseModel):
    current_price: float


class TwoFactorVerifyRequest(BaseModel):
    token: str


class BulkPriceUpdate(BaseModel):
    prices: list[dict]


class PortfolioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    total_value: float
    created_at: datetime
    updated_at: datetime


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    portfolio_id: int
    asset_type: str
    symbol: Optional[str]
    name: str
    quantity: float
    purchase_price: float
    current_price: Optional[float]
    purchase_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class AssetPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    current_price: Optional[float]
