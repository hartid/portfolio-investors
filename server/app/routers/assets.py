from fastapi import APIRouter, Depends, HTTPException, status

from app.database import pool
from app.schemas import AssetCreate, BulkPriceUpdate, PriceUpdate
from app.security import get_current_user

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/{portfolio_id}")
async def get_assets(portfolio_id: int, user: dict = Depends(get_current_user)):
    async with pool.connection() as conn:
        result = await conn.execute(
            "SELECT a.* FROM assets a "
            "JOIN portfolios p ON a.portfolio_id = p.id "
            "WHERE a.portfolio_id = %s AND p.user_id = %s "
            "ORDER BY a.created_at DESC",
            (portfolio_id, user["id"]),
        )
        return await result.fetchall() or []


@router.post("")
async def create_asset(data: AssetCreate, user: dict = Depends(get_current_user)):
    async with pool.connection() as conn:
        check = await conn.execute(
            "SELECT id FROM portfolios WHERE id = %s AND user_id = %s",
            (data.portfolio_id, user["id"]),
        )
        if not await check.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещен")

        result = await conn.execute(
            "INSERT INTO assets "
            "(portfolio_id, asset_type, symbol, name, quantity, purchase_price, "
            " current_price, purchase_date, notes) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
            (
                data.portfolio_id,
                data.asset_type,
                data.symbol,
                data.name,
                data.quantity,
                data.purchase_price,
                data.current_price,
                data.purchase_date,
                data.notes,
            ),
        )
        return await result.fetchone()


@router.put("/{asset_id}/price")
async def update_asset_price(
    asset_id: int, data: PriceUpdate, user: dict = Depends(get_current_user)
):
    async with pool.connection() as conn:
        result = await conn.execute(
            "UPDATE assets SET current_price = %s, updated_at = NOW() "
            "WHERE id = %s AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = %s) "
            "RETURNING id, name, current_price",
            (data.current_price, asset_id, user["id"]),
        )
        row = await result.fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Актив не найден")
    return row


@router.post("/update-prices")
async def update_prices(data: BulkPriceUpdate, user: dict = Depends(get_current_user)):
    updates = []
    async with pool.connection() as conn:
        for item in data.prices:
            result = await conn.execute(
                "UPDATE assets SET current_price = %s, updated_at = NOW() "
                "WHERE id = %s AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = %s) "
                "RETURNING id, name, current_price",
                (item.get("price"), item.get("id"), user["id"]),
            )
            row = await result.fetchone()
            if row:
                updates.append(row)
    return {"updated": len(updates), "assets": updates}


@router.delete("/{asset_id}")
async def delete_asset(asset_id: int, user: dict = Depends(get_current_user)):
    async with pool.connection() as conn:
        await conn.execute(
            "DELETE FROM assets WHERE id = %s "
            "AND portfolio_id IN (SELECT id FROM portfolios WHERE user_id = %s)",
            (asset_id, user["id"]),
        )
    return {"message": "Актив удален"}
