import pyotp


async def test_register_returns_token_and_creates_portfolio(client, register):
    headers, user = await register("alice")
    assert user["username"] == "alice"
    assert user["email"] == "alice@example.com"

    response = await client.get("/api/portfolios", headers=headers)
    assert response.status_code == 200
    portfolios = response.json()
    assert len(portfolios) == 1
    assert portfolios[0]["name"] == "Мои инвестиции"
    assert portfolios[0]["user_id"] == user["id"]


async def test_register_duplicate(client, register):
    await register("alice")
    response = await client.post(
        "/api/register",
        json={"username": "alice", "email": "other@example.com", "password": "secret123"},
    )
    assert response.status_code == 400


async def test_register_validation(client):
    response = await client.post(
        "/api/register", json={"username": "al", "email": "a@b.c", "password": "123"}
    )
    assert response.status_code == 422


async def test_login_by_username_and_email(client, register):
    await register("alice")
    for login in ("alice", "alice@example.com"):
        response = await client.post("/api/login", json={"username": login, "password": "secret123"})
        assert response.status_code == 200
        assert response.json()["user"]["username"] == "alice"
        assert response.json()["token"]


async def test_login_wrong_password(client, register):
    await register("alice")
    response = await client.post("/api/login", json={"username": "alice", "password": "nope"})
    assert response.status_code == 401


async def test_me(client, register):
    headers, _ = await register("alice")
    response = await client.get("/api/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["two_factor_enabled"] is False
    assert body["created_at"]


async def test_me_requires_auth(client):
    assert (await client.get("/api/me")).status_code == 401
    bad = await client.get("/api/me", headers={"Authorization": "Bearer garbage"})
    assert bad.status_code == 403


async def test_two_factor_flow(client, register):
    headers, _ = await register("alice")

    setup = await client.post("/api/2fa/setup", headers=headers)
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert len(setup.json()["backupCodes"]) == 10
    assert setup.json()["qrCode"].startswith("data:image/png;base64,")

    wrong = await client.post("/api/2fa/verify", headers=headers, json={"token": "abc"})
    assert wrong.status_code == 400

    ok = await client.post(
        "/api/2fa/verify", headers=headers, json={"token": pyotp.TOTP(secret).now()}
    )
    assert ok.status_code == 200
    assert (await client.get("/api/me", headers=headers)).json()["two_factor_enabled"] is True

    step1 = await client.post("/api/login", json={"username": "alice", "password": "secret123"})
    assert step1.json()["requiresTwoFactor"] is True

    bad_code = await client.post(
        "/api/login",
        json={"username": "alice", "password": "secret123", "twoFactorCode": "abc"},
    )
    assert bad_code.status_code == 401

    step2 = await client.post(
        "/api/login",
        json={
            "username": "alice",
            "password": "secret123",
            "twoFactorCode": pyotp.TOTP(secret).now(),
        },
    )
    assert step2.status_code == 200
    assert step2.json()["token"]
