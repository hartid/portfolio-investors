import os

# Тесты очищают таблицы, поэтому никогда не используем рабочую БД:
# либо явный TEST_DATABASE_URL, либо отдельная база investor_social_test.
os.environ.pop("DATABASE_URL", None)
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
else:
    os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "investor_social_test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only-0123456789")

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import pool, text  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import get_session  # noqa: E402
from app.main import app  # noqa: E402

SERVER_DIR = Path(__file__).resolve().parent.parent


def alembic_config() -> Config:
    cfg = Config(str(SERVER_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(SERVER_DIR / "migrations"))
    cfg.attributes["configure_logger"] = False
    return cfg


@pytest.fixture(scope="session")
def migrated_db():
    """Накатывает миграции на тестовую БД; пропускает тесты, если БД недоступна."""
    try:
        command.upgrade(alembic_config(), "head")
    except Exception as exc:  # pragma: no cover - зависит от окружения
        pytest.skip(f"PostgreSQL недоступен: {exc}")
    return alembic_config()


@pytest.fixture
async def session_factory(migrated_db):
    engine = create_async_engine(settings.database_url, poolclass=pool.NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE users, portfolios, assets RESTART IDENTITY CASCADE"))
    await engine.dispose()


@pytest.fixture
async def client(session_factory):
    async def override_get_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def register(client):
    async def _register(username="alice", password="secret123"):
        response = await client.post(
            "/api/register",
            json={"username": username, "email": f"{username}@example.com", "password": password},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        return {"Authorization": f"Bearer {body['token']}"}, body["user"]

    return _register
