from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
    asset_type: str
    symbol: Optional[str] = None
    name: str
    quantity: float
    purchase_price: float
    current_price: Optional[float] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None


class PriceUpdate(BaseModel):
    current_price: float


class TwoFactorVerifyRequest(BaseModel):
    token: str


class BulkPriceUpdate(BaseModel):
    prices: list[dict]
