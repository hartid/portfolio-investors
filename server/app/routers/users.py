from fastapi import APIRouter, Depends

from app.models import User
from app.security import get_current_user, serialize_user

router = APIRouter(tags=["users"])


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return serialize_user(user)
