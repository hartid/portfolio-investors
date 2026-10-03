from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    avatar: Mapped[Optional[str]] = mapped_column(String(500))
    two_factor_secret: Mapped[Optional[str]] = mapped_column(Text)
    two_factor_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    backup_codes: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))

    portfolios: Mapped[list["Portfolio"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class Portfolio(TimestampMixin, Base):
    __tablename__ = "portfolios"
    __table_args__ = (Index("idx_portfolios_user_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(
        String(200), default="Мое портфолио", server_default="Мое портфолио"
    )
    total_value: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=0, server_default="0"
    )

    user: Mapped[User] = relationship(back_populates="portfolios")
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan", passive_deletes=True
    )


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"
    __table_args__ = (Index("idx_assets_portfolio_id", "portfolio_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(
        ForeignKey("portfolios.id", ondelete="CASCADE")
    )
    asset_type: Mapped[str] = mapped_column(String(50))
    symbol: Mapped[Optional[str]] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[Decimal] = mapped_column(Numeric(15, 8))
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    current_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    purchase_date: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    portfolio: Mapped[Portfolio] = relationship(back_populates="assets")
