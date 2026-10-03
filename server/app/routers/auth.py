from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Portfolio, User
from app.schemas import LoginRequest, RegisterRequest, TwoFactorVerifyRequest
from app.security import (
    create_access_token,
    generate_backup_codes,
    generate_totp_secret,
    get_current_user,
    hash_password,
    qr_code_data_url,
    totp_verify,
    verify_password,
)

router = APIRouter(tags=["auth"])


def _short_user(user: User) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email}


@router.post("/register")
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.scalar(
        select(User.id).where(or_(User.username == data.username, User.email == data.email))
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь уже существует"
        )

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    user.portfolios.append(Portfolio(name="Мои инвестиции"))
    session.add(user)
    await session.commit()

    token = create_access_token(user.id, user.username)
    return {"token": token, "user": _short_user(user)}


@router.post("/login")
async def login(data: LoginRequest, session: AsyncSession = Depends(get_session)):
    user = await session.scalar(
        select(User).where(or_(User.username == data.username, User.email == data.username))
    )

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные"
        )

    if user.two_factor_enabled:
        if not data.two_factor_code:
            return {"requiresTwoFactor": True, "userId": user.id}
        if not totp_verify(user.two_factor_secret, data.two_factor_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный код 2FA"
            )

    token = create_access_token(user.id, user.username)
    return {"token": token, "user": _short_user(user)}


@router.post("/2fa/setup")
async def setup_2fa(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    secret, otpauth_url = generate_totp_secret(user.username)
    backup_codes = generate_backup_codes()

    user.two_factor_secret = secret
    user.backup_codes = backup_codes
    await session.commit()

    return {
        "secret": secret,
        "qrCode": qr_code_data_url(otpauth_url),
        "backupCodes": backup_codes,
    }


@router.post("/2fa/verify")
async def verify_2fa(
    data: TwoFactorVerifyRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not user.two_factor_secret or not totp_verify(user.two_factor_secret, data.token):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный код")

    user.two_factor_enabled = True
    await session.commit()

    return {"success": True}
