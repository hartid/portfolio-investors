import jwt
import pyotp

from app.config import settings
from app.security import (
    create_access_token,
    generate_backup_codes,
    generate_totp_secret,
    hash_password,
    qr_code_data_url,
    totp_verify,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("secret123")
    assert hashed != "secret123"
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong", hashed)


def test_verify_password_with_garbage_hash():
    assert not verify_password("secret123", "not-a-bcrypt-hash")


def test_access_token_payload():
    token = create_access_token(42, "alice")
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["userId"] == 42
    assert payload["username"] == "alice"
    assert "exp" in payload


def test_backup_codes():
    codes = generate_backup_codes()
    assert len(codes) == 10
    assert all(len(code) == 8 and code.isalnum() for code in codes)


def test_totp_secret_and_verify():
    secret, url = generate_totp_secret("alice")
    assert url.startswith("otpauth://totp/")
    assert "InvestorSocial" in url
    assert totp_verify(secret, pyotp.TOTP(secret).now())
    assert not totp_verify(secret, "abcdef")


def test_totp_verify_invalid_secret():
    assert not totp_verify(None, "123456")


def test_qr_code_data_url():
    assert qr_code_data_url("otpauth://totp/test").startswith("data:image/png;base64,")
