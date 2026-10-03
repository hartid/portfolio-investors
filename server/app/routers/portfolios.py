from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Portfolio, User
from app.schemas import PortfolioOut
from app.security import get_current_user

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.get("", response_model=list[PortfolioOut])
async def get_portfolios(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.scalars(
        select(Portfolio)
        .where(Portfolio.user_id == user.id)
        .order_by(Portfolio.created_at.desc())
    )
    return result.all()
