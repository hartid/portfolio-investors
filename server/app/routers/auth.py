from fastapi import APIRouter, Depends, HTTPException, status

from app.database import pool
from app.schemas import LoginRequest, RegisterRequest, TwoFactorVerifyRequest
from app.security import (
    create_access_token,
    generate_backup_codes,
    generate_totp_secret,
    get_current_user,
    hash_password,
    qr_code_data_url,
    serialize_user,
    totp_verify,
    verify_password,
)

router = APIRouter(tags=["auth"])


@router.post("/register")
async def register(data: RegisterRequest):
    async with pool.connection() as conn:
        existing = await conn.execute(
            "SELECT id FROM users WHERE username = %s OR email = %s",
            (data.username, data.email),
        )
        if await existing.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь уже существует"
            )

        user = await conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) "
            "RETURNING id, username, email",
            (data.username, data.email, hash_password(data.password)),
        )
        new_user = await user.fetchone()

        await conn.execute(
            "INSERT INTO portfolios (name, user_id) VALUES (%s, %s)",
            ("Мои инвестиции", new_user["id"]),
        )

    token = create_access_token(new_user["id"], new_user["username"])
    return {"token": token, "user": new_user}


@router.post("/login")
async def login(data: LoginRequest):
    async with pool.connection() as conn:
        result = await conn.execute(
            "SELECT * FROM users WHERE username = %s OR email = %s", (data.username, data.username)
        )
        user = await result.fetchone()

    if user is None or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные"
        )

    if user["two_factor_enabled"]:
        if not data.two_factor_code:
            return {"requiresTwoFactor": True, "userId": user["id"]}
        if not totp_verify(user["two_factor_secret"], data.two_factor_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный код 2FA"
            )

    token = create_access_token(user["id"], user["username"])
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
    }


@router.post("/2fa/setup")
async def setup_2fa(user: dict = Depends(get_current_user)):
    secret, otpauth_url = generate_totp_secret(user["username"])
    backup_codes = generate_backup_codes()

    async with pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET two_factor_secret = %s, backup_codes = %s WHERE id = %s",
            (secret, backup_codes, user["id"]),
        )

    return {
        "secret": secret,
        "qrCode": qr_code_data_url(otpauth_url),
        "backupCodes": backup_codes,
    }


@router.post("/2fa/verify")
async def verify_2fa(data: TwoFactorVerifyRequest, user: dict = Depends(get_current_user)):
    async with pool.connection() as conn:
        result = await conn.execute(
            "SELECT two_factor_secret FROM users WHERE id = %s", (user["id"],)
        )
        row = await result.fetchone()

    if row is None or not totp_verify(row["two_factor_secret"], data.token):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный код")

    async with pool.connection() as conn:
        await conn.execute(
            "UPDATE users SET two_factor_enabled = TRUE WHERE id = %s", (user["id"],)
        )

    return {"success": True}
