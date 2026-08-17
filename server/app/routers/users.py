from fastapi import APIRouter, Depends

from app.database import pool
from app.security import get_current_user, serialize_user

router = APIRouter(tags=["users"])


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return serialize_user(user)
