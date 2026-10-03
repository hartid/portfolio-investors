# --- 1. Сборка React-клиента ---
FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

# --- 2. FastAPI-сервер + собранный клиент ---
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app/server

COPY server/requirements.txt ./
RUN pip install -r requirements.txt

COPY server/ ./
COPY --from=client /client/build /app/client/build
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && useradd --create-home --uid 1000 app \
    && chown -R app:app /app
USER app

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')"

ENTRYPOINT ["entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--proxy-headers"]
