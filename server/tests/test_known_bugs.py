"""Автотесты на известные баги (см. docs/bug-reports.md).

Каждый тест описывает ОЖИДАЕМОЕ поведение и помечен xfail(strict=True):
пока баг не исправлен, тест «ожидаемо падает». После исправления тест
начнёт проходить, strict-режим выдаст XPASS → нужно снять маркер xfail.
"""

import pyotp
import pytest
from pydantic import ValidationError

from app.config import Settings


def bug(bug_id: str, title: str):
    return pytest.mark.xfail(strict=True, reason=f"{bug_id}: {title}")


@pytest.fixture
def asset_payload():
    return {
        "asset_type": "stock",
        "symbol": "AAPL",
        "name": "Apple",
        "quantity": 2,
        "purchase_price": 100,
        "current_price": 150,
    }


async def _portfolio_id(client, headers):
    return (await client.get("/api/portfolios", headers=headers)).json()[0]["id"]


async def _enable_2fa(client, headers):
    setup = (await client.post("/api/2fa/setup", headers=headers)).json()
    await client.post(
        "/api/2fa/verify", headers=headers, json={"token": pyotp.TOTP(setup["secret"]).now()}
    )
    return setup


@bug("BUG-01", "вход по резервному коду 2FA невозможен")
async def test_login_with_backup_code(client, register):
    headers, _ = await register("alice")
    setup = await _enable_2fa(client, headers)

    response = await client.post(
        "/api/login",
        json={
            "username": "alice",
            "password": "secret123",
            "twoFactorCode": setup["backupCodes"][0],
        },
    )
    assert response.status_code == 200


@bug("BUG-02", "повторный /2fa/setup перезаписывает секрет при включённой 2FA")
async def test_setup_2fa_when_already_enabled_is_rejected(client, register):
    headers, _ = await register("alice")
    await _enable_2fa(client, headers)

    response = await client.post("/api/2fa/setup", headers=headers)
    assert response.status_code in (400, 409)


@bug("BUG-03", "удаление несуществующего актива возвращает 200")
async def test_delete_missing_asset_returns_404(client, register):
    headers, _ = await register("alice")
    response = await client.delete("/api/assets/999999", headers=headers)
    assert response.status_code == 404


@bug("BUG-04", "email при регистрации не валидируется")
async def test_register_rejects_invalid_email(client):
    response = await client.post(
        "/api/register",
        json={"username": "alice", "email": "not-an-email", "password": "secret123"},
    )
    assert response.status_code == 422


@bug("BUG-05", "можно создать актив с отрицательным количеством и ценой")
async def test_negative_quantity_and_price_rejected(client, register, asset_payload):
    headers, _ = await register("alice")
    pid = await _portfolio_id(client, headers)
    response = await client.post(
        "/api/assets",
        headers=headers,
        json={**asset_payload, "portfolio_id": pid, "quantity": -5, "purchase_price": -100},
    )
    assert response.status_code == 422


@bug("BUG-06", "нечисловой id в update-prices приводит к 500")
async def test_bulk_update_with_invalid_id_returns_422(client, register):
    headers, _ = await register("alice")
    response = await client.post(
        "/api/assets/update-prices",
        headers=headers,
        json={"prices": [{"id": "abc", "price": 10}]},
    )
    assert response.status_code == 422


@bug("BUG-07", "приложение стартует с дефолтным JWT_SECRET")
def test_default_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@bug("BUG-08", "CORS разрешает любой Origin вместе с credentials")
async def test_cors_rejects_unknown_origin(client):
    response = await client.options(
        "/api/me",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example.com"


@bug("BUG-09", "total_value портфеля не пересчитывается")
async def test_portfolio_total_value_updates(client, register, asset_payload):
    headers, _ = await register("alice")
    pid = await _portfolio_id(client, headers)
    await client.post("/api/assets", headers=headers, json={**asset_payload, "portfolio_id": pid})

    portfolio = (await client.get("/api/portfolios", headers=headers)).json()[0]
    assert portfolio["total_value"] == 300  # 2 × 150
