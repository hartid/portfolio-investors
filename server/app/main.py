import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.database import close_pool, open_pool
from app.routers import assets, auth, portfolios, users

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

CLIENT_DIST = Path(__file__).resolve().parent.parent.parent / "client" / "build"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await open_pool()
    yield
    await close_pool()


app = FastAPI(title="Social Investors API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(portfolios.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/")
async def root():
    index = CLIENT_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Social Investors API", "docs": "/docs"}


if CLIENT_DIST.exists():
    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc"):
            raise HTTPException(status_code=404, detail="Not found")

        file = (CLIENT_DIST / full_path).resolve()
        if file.is_file() and CLIENT_DIST in file.parents:
            return FileResponse(file)

        index = CLIENT_DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Not found")
