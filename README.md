# Portfolio Investors

Веб-приложение для учёта и отслеживания инвестиционных портфелей: регистрация пользователей, создание портфелей, добавление активов, двухфакторная аутентификация (TOTP + резервные коды) и наглядная статистика.

## Стек

- **Frontend:** React 18, react-scripts, axios, recharts, qrcode.react
- **Backend:** Python 3.14+, FastAPI, uvicorn, psycopg 3 (async), PyJWT, bcrypt, pyotp
- **База данных:** PostgreSQL

## Возможности

- Регистрация и вход (JWT-токены, пароли через bcrypt)
- Двухфакторная аутентификация: настройка через QR-код, резервные коды
- Несколько портфелей на пользователя
- Учёт активов: тип, символ, количество, цена покупки, текущая цена, заметки
- Статистика и графики по портфелю (recharts)
- API-документация (Swagger) по адресу `/docs`

## Структура проекта

```
client/              React-приложение
  src/               компоненты и сервисы
server/              FastAPI-бэкенд
  app/
    main.py          точка входа приложения, SPA-раздача
    config.py        настройки (.env)
    database.py      пул подключений к PostgreSQL
    security.py      JWT, bcrypt, TOTP
    routers/         auth, portfolios, assets, users
  run.py             запуск uvicorn (порт 5000)
  database.sql       схема базы данных
  requirements.txt   зависимости Python
```

## Установка и запуск

### 1. База данных (PostgreSQL)

Создайте базу (по умолчанию `investor_social`) и примените схему:

```sql
psql -U postgres -d investor_social -f server/database.sql
```

### 2. Backend

```bash
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS
pip install -r requirements.txt
```

При необходимости создайте `.env` в папке `server`:

```
JWT_SECRET=your_secret_key_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=investor_social
DB_USER=postgres
DB_PASSWORD=postgres
```

Запуск:

```bash
python run.py
```

Сервер будет доступен на `http://localhost:5000`, API-документация — на `http://localhost:5000/docs`.

### 3. Frontend

```bash
cd client
npm install
npm start       # режим разработки (проксируется на API)
# npm run build # production-сборка
```

Готовая production-сборка (`client/build`) автоматически раздаётся самим FastAPI-сервером.

## API (основные эндпоинты)

| Метод | Путь                  | Описание                        |
|-------|-----------------------|---------------------------------|
| POST  | `/api/register`       | Регистрация                     |
| POST  | `/api/login`          | Вход (с поддержкой 2FA)         |
| POST  | `/api/2fa/setup`      | Настройка 2FA (QR + резервные коды) |
| POST  | `/api/2fa/verify`     | Подтверждение включения 2FA     |
| GET   | `/api/me`             | Текущий пользователь            |
| GET   | `/api/portfolios`     | Список портфелей                |
| GET   | `/api/assets`         | Активы (по портфелю)            |

Полная спецификация: `http://localhost:5000/docs`.