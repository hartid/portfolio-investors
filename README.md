# Portfolio Investors

Веб-приложение для учёта и отслеживания инвестиционных портфелей: регистрация пользователей, создание портфелей, добавление активов, двухфакторная аутентификация (TOTP + резервные коды) и наглядная статистика.

## Стек

- **Frontend:** React 18, react-scripts, axios, recharts, qrcode.react
- **Backend:** Python 3.14+, FastAPI, uvicorn, SQLAlchemy 2.0 (async, psycopg 3), Alembic, PyJWT, bcrypt, pyotp
- **База данных:** PostgreSQL
- **Тесты:** pytest, pytest-asyncio, httpx
- **Инфраструктура:** Docker, Docker Compose, GitHub Actions (CI/CD, образ в GHCR)

## Возможности

- Регистрация и вход (JWT-токены, пароли через bcrypt)
- Двухфакторная аутентификация: настройка через QR-код, резервные коды
- Несколько портфелей на пользователя
- Учёт активов: тип, символ, количество, цена покупки, текущая цена, заметки
- Статистика и графики по портфелю (recharts)
- API-документация (Swagger) по адресу `/docs`

## Структура проекта

```
client/                React-приложение
server/                FastAPI-бэкенд
  app/
    main.py            точка входа приложения, SPA-раздача, /api/health
    config.py          настройки (.env)
    database.py        async-движок и сессии SQLAlchemy
    models.py          ORM-модели (User, Portfolio, Asset)
    security.py        JWT, bcrypt, TOTP
    routers/           auth, portfolios, assets, users
  migrations/          миграции Alembic
  tests/               тесты pytest
  alembic.ini
  requirements.txt     зависимости
  requirements-dev.txt зависимости для разработки и тестов
docker/entrypoint.sh   применяет миграции при старте контейнера
Dockerfile             multi-stage сборка (React + FastAPI)
docker-compose.yml     приложение + PostgreSQL
.github/workflows/     CI/CD
```

## Быстрый старт (Docker Compose)

```bash
cp .env.example .env      # задайте JWT_SECRET
docker compose up -d --build
```

Приложение: `http://localhost:5000`, Swagger: `http://localhost:5000/docs`.
Миграции применяются автоматически при старте контейнера. На Linux можно пользоваться `make up`, `make logs`, `make down`.

## Локальная установка

### 1. База данных (PostgreSQL)

Создайте базу (по умолчанию `investor_social`). Схема создаётся миграциями Alembic (шаг 2).

> Если база уже была создана старым скриптом `database.sql`, один раз пометьте её как актуальную: `alembic stamp head`.

### 2. Backend

```bash
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS
pip install -r requirements-dev.txt
```

При необходимости создайте `.env` в папке `server`:

```
JWT_SECRET=your_secret_key_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=investor_social
DB_USER=postgres
DB_PASSWORD=postgres
# или одной строкой:
# DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/investor_social
```

Миграции и запуск:

```bash
alembic upgrade head
python run.py
```

Сервер будет доступен на `http://localhost:5000`, API-документация — на `http://localhost:5000/docs`.

Новая миграция после изменения моделей:

```bash
alembic revision --autogenerate -m "описание"
```

### 3. Frontend

```bash
cd client
npm install
npm start       # режим разработки (проксируется на API)
# npm run build # production-сборка
```

Готовая production-сборка (`client/build`) автоматически раздаётся самим FastAPI-сервером.

## Тесты

Тесты работают с реальным PostgreSQL в отдельной базе (по умолчанию `investor_social_test`, рабочая база не затрагивается):

```bash
createdb investor_social_test
cd server
pytest
```

Другую базу можно указать через `TEST_DATABASE_URL`. Тесты проверяют API (регистрация, вход, 2FA, портфели, активы), утилиты безопасности, а также что миграции применяются/откатываются и соответствуют моделям.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) на каждый push и pull request:

1. **Backend** — PostgreSQL как service-контейнер, `alembic upgrade head`, `alembic check`, `pytest` с покрытием.
2. **Frontend** — сборка React-приложения.
3. **Docker** — `docker compose up --build`, проверка `/api/health` и регистрации.
4. **Publish** (только `main`) — сборка и публикация образа в `ghcr.io/hartid/portfolio-investors` (теги `latest` и SHA коммита).

## API (основные эндпоинты)

| Метод | Путь                  | Описание                        |
|-------|-----------------------|---------------------------------|
| POST  | `/api/register`       | Регистрация                     |
| POST  | `/api/login`          | Вход (с поддержкой 2FA)         |
| POST  | `/api/2fa/setup`      | Настройка 2FA (QR + резервные коды) |
| POST  | `/api/2fa/verify`     | Подтверждение включения 2FA     |
| GET   | `/api/me`             | Текущий пользователь            |
| GET   | `/api/portfolios`     | Список портфелей                |
| GET   | `/api/assets/{id}`    | Активы портфеля                 |
| GET   | `/api/health`         | Проверка работоспособности      |

Полная спецификация: `http://localhost:5000/docs`.