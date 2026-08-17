import asyncio
import selectors
import sys

import uvicorn


def main() -> None:
    config = uvicorn.Config("app.main:app", host="0.0.0.0", port=5000, reload=False)
    server = uvicorn.Server(config)

    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(server.serve())
        finally:
            loop.close()
    else:
        server.run()


if __name__ == "__main__":
    main()
