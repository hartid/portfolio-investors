import pytest


@pytest.fixture
def asset_payload():
    return {
        "asset_type": "stock",
        "symbol": "AAPL",
        "name": "Apple",
        "quantity": 1.5,
        "purchase_price": 150,
        "current_price": 170.25,
        "purchase_date": "2026-01-15",
        "notes": "долгосрок",
    }


async def _portfolio_id(client, headers):
    return (await client.get("/api/portfolios", headers=headers)).json()[0]["id"]


async def _create_asset(client, headers, payload, portfolio_id):
    response = await client.post(
        "/api/assets", headers=headers, json={**payload, "portfolio_id": portfolio_id}
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_create_and_list_assets(client, register, asset_payload):
    headers, _ = await register("alice")
    pid = await _portfolio_id(client, headers)

    asset = await _create_asset(client, headers, asset_payload, pid)
    assert asset["portfolio_id"] == pid
    assert asset["quantity"] == 1.5
    assert asset["current_price"] == 170.25
    assert asset["purchase_date"] == "2026-01-15"

    listed = await client.get(f"/api/assets/{pid}", headers=headers)
    assert listed.status_code == 200
    assert [a["id"] for a in listed.json()] == [asset["id"]]


async def test_empty_purchase_date(client, register, asset_payload):
    headers, _ = await register("alice")
    pid = await _portfolio_id(client, headers)
    asset = await _create_asset(client, headers, {**asset_payload, "purchase_date": ""}, pid)
    assert asset["purchase_date"] is None


async def test_cannot_use_foreign_portfolio(client, register, asset_payload):
    alice, _ = await register("alice")
    bob, _ = await register("bob")
    alice_pid = await _portfolio_id(client, alice)

    response = await client.post(
        "/api/assets", headers=bob, json={**asset_payload, "portfolio_id": alice_pid}
    )
    assert response.status_code == 403
    assert (await client.get(f"/api/assets/{alice_pid}", headers=bob)).json() == []


async def test_update_price(client, register, asset_payload):
    alice, _ = await register("alice")
    bob, _ = await register("bob")
    pid = await _portfolio_id(client, alice)
    asset_id = (await _create_asset(client, alice, asset_payload, pid))["id"]

    response = await client.put(
        f"/api/assets/{asset_id}/price", headers=alice, json={"current_price": 200}
    )
    assert response.status_code == 200
    assert response.json() == {"id": asset_id, "name": "Apple", "current_price": 200.0}

    foreign = await client.put(
        f"/api/assets/{asset_id}/price", headers=bob, json={"current_price": 1}
    )
    assert foreign.status_code == 404


async def test_bulk_update_prices(client, register, asset_payload):
    headers, _ = await register("alice")
    pid = await _portfolio_id(client, headers)
    ids = [(await _create_asset(client, headers, asset_payload, pid))["id"] for _ in range(2)]

    response = await client.post(
        "/api/assets/update-prices",
        headers=headers,
        json={
            "prices": [
                {"id": ids[0], "price": 10},
                {"id": ids[1], "price": 20},
                {"id": 999999, "price": 1},
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["updated"] == 2
    assert {a["id"]: a["current_price"] for a in body["assets"]} == {ids[0]: 10.0, ids[1]: 20.0}


async def test_delete_asset(client, register, asset_payload):
    alice, _ = await register("alice")
    bob, _ = await register("bob")
    pid = await _portfolio_id(client, alice)
    asset_id = (await _create_asset(client, alice, asset_payload, pid))["id"]

    await client.delete(f"/api/assets/{asset_id}", headers=bob)
    assert len((await client.get(f"/api/assets/{pid}", headers=alice)).json()) == 1

    response = await client.delete(f"/api/assets/{asset_id}", headers=alice)
    assert response.status_code == 200
    assert (await client.get(f"/api/assets/{pid}", headers=alice)).json() == []


async def test_create_asset_missing_required_fields(client, register):
    headers, _ = await register("alice")
    pid = await _portfolio_id(client, headers)
    response = await client.post("/api/assets", headers=headers, json={"portfolio_id": pid})
    assert response.status_code == 422
    missing = {err["loc"][-1] for err in response.json()["detail"]}
    assert {"asset_type", "name", "quantity", "purchase_price"} <= missing
