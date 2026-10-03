from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Asset, Portfolio, User
from app.schemas import AssetCreate, AssetOut, AssetPriceOut, BulkPriceUpdate, PriceUpdate
from app.security import get_current_user

router = APIRouter(prefix="/assets", tags=["assets"])


def _owned_portfolio_ids(user: User):
    return select(Portfolio.id).where(Portfolio.user_id == user.id)


async def _set_price(session: AsyncSession, user: User, asset_id, price) -> Asset | None:
    return await session.scalar(
        update(Asset)
        .where(Asset.id == asset_id, Asset.portfolio_id.in_(_owned_portfolio_ids(user)))
        .values(current_price=price, updated_at=func.now())
        .returning(Asset)
    )


@router.get("/{portfolio_id}", response_model=list[AssetOut])
async def get_assets(
    portfolio_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.scalars(
        select(Asset)
        .join(Portfolio, Asset.portfolio_id == Portfolio.id)
        .where(Asset.portfolio_id == portfolio_id, Portfolio.user_id == user.id)
        .order_by(Asset.created_at.desc())
    )
    return result.all()


@router.post("", response_model=AssetOut)
async def create_asset(
    data: AssetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    portfolio = await session.scalar(
        select(Portfolio).where(Portfolio.id == data.portfolio_id, Portfolio.user_id == user.id)
    )
    if portfolio is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещен")

    asset = Asset(**data.model_dump())
    session.add(asset)
    await session.commit()
    await session.refresh(asset)
    return asset


@router.put("/{asset_id}/price", response_model=AssetPriceOut)
async def update_asset_price(
    asset_id: int,
    data: PriceUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    asset = await _set_price(session, user, asset_id, data.current_price)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Актив не найден")
    await session.commit()
    return asset


@router.post("/update-prices")
async def update_prices(
    data: BulkPriceUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    updates = []
    for item in data.prices:
        asset = await _set_price(session, user, item.get("id"), item.get("price"))
        if asset is not None:
            updates.append(AssetPriceOut.model_validate(asset))
    await session.commit()
    return {"updated": len(updates), "assets": updates}


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        delete(Asset).where(
            Asset.id == asset_id, Asset.portfolio_id.in_(_owned_portfolio_ids(user))
        )
    )
    await session.commit()
    return {"message": "Актив удален"}
