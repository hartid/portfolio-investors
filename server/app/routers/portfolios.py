from fastapi import APIRouter, Depends

from app.database import pool
from app.security import get_current_user

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.get("")
async def get_portfolios(user: dict = Depends(get_current_user)):
    async with pool.connection() as conn:
        result = await conn.execute(
            "SELECT * FROM portfolios WHERE user_id = %s ORDER BY created_at DESC",
            (user["id"],),
        )
        return await result.fetchall()
