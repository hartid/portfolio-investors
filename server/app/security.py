import base64
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import pyotp
import qrcode
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.rows import dict_row

from app.config import settings
from app.database import pool

bearer_scheme = HTTPBearer(auto_error=False)

_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, username: str) -> str:
    payload = {
        "userId": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=_ALGORITHM)


def generate_backup_codes(count: int = 10) -> list[str]:
    return [
        "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
        for _ in range(count)
    ]


def generate_totp_secret(account_name: str) -> tuple[str, str]:
    """Возвращает (base32_secret, otpauth_url)."""
    secret = pyotp.random_base32()
    otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(
        name=account_name, issuer_name="InvestorSocial"
    )
    return secret, otpauth_url


def totp_verify(secret: str, token: str) -> bool:
    try:
        return pyotp.TOTP(secret).verify(token, valid_window=1)
    except Exception:
        return False


def qr_code_data_url(otpauth_url: str) -> str:
    from io import BytesIO

    buf = BytesIO()
    qrcode.make(otpauth_url).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")

    try:
        payload = jwt.decode(
            credentials.credentials, settings.JWT_SECRET, algorithms=[_ALGORITHM]
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недействительный токен")

    async with pool.connection() as conn:
        user = await conn.execute(
            "SELECT * FROM users WHERE id = %s", (payload.get("userId"),)
        )
        row = await user.fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

    return row


def serialize_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "avatar": row.get("avatar"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "two_factor_enabled": row.get("two_factor_enabled", False),
    }
