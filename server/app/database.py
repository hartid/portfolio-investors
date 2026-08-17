from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.config import settings

pool: AsyncConnectionPool = AsyncConnectionPool(
    settings.database_url,
    min_size=1,
    max_size=10,
    open=False,
    kwargs={"row_factory": dict_row},
)


async def open_pool() -> None:
    await pool.open()
    await pool.wait()


async def close_pool() -> None:
    await pool.close()
