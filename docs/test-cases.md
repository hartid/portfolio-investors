# Тест-кейсы API «Портфель инвестора»

**Объект тестирования:** REST API бэкенда (FastAPI), базовый путь `/api`
**Тип:** функциональное тестирование, позитивные и негативные проверки, безопасность доступа
**Окружение:** Python 3.14, PostgreSQL 17; автотесты — `server/tests/` (pytest + httpx)

## Обозначения

| Поле | Значение |
|---|---|
| Приоритет | **P1** — критичный сценарий, **P2** — важный, **P3** — второстепенный |
| Статус | ✅ Pass — проходит, ❌ Fail — найден дефект (ссылка на баг-репорт) |
| Автотест | файл и функция в `server/tests/` |

## Общие предусловия

- Сервер запущен, миграции применены (`alembic upgrade head`).
- «Пользователь A» — зарегистрирован: `alice` / `alice@example.com` / `secret123`.
- «Пользователь B» — второй зарегистрированный пользователь `bob`.
- `{token}` — JWT, полученный при регистрации/входе; передаётся в заголовке `Authorization: Bearer {token}`.

---

## 1. Регистрация и вход

| ID | Название | Предусловия | Шаги | Ожидаемый результат | Приор. | Статус | Автотест |
|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | Регистрация нового пользователя | Пользователя `alice` нет | `POST /register` `{"username":"alice","email":"alice@example.com","password":"secret123"}` | 200; в ответе `token` и `user` (id, username, email); у пользователя создан портфель «Мои инвестиции» | P1 | ✅ | `test_auth.py::test_register_returns_token_and_creates_portfolio` |
| TC-AUTH-02 | Регистрация с занятым username | Пользователь A | `POST /register` с `username=alice` и новым email | 400, «Пользователь уже существует» | P1 | ✅ | `test_auth.py::test_register_duplicate` |
| TC-AUTH-03 | Регистрация с занятым email | Пользователь A | `POST /register` с новым username и `email=alice@example.com` | 400, «Пользователь уже существует» | P1 | ✅ | `test_auth.py::test_register_duplicate_email` |
| TC-AUTH-04 | Валидация длины полей | — | `POST /register` `{"username":"al","email":"a@b.c","password":"123"}` | 422, ошибки валидации username (< 3) и password (< 6) | P2 | ✅ | `test_auth.py::test_register_validation` |
| TC-AUTH-05 | Валидация формата email | — | `POST /register` с `email="not-an-email"` | 422, ошибка формата email | P2 | ❌ [BUG-04](bug-reports.md#bug-04) | `test_known_bugs.py::test_register_rejects_invalid_email` |
| TC-AUTH-06 | Вход по username | Пользователь A | `POST /login` `{"username":"alice","password":"secret123"}` | 200, `token`, данные пользователя | P1 | ✅ | `test_auth.py::test_login_by_username_and_email` |
| TC-AUTH-07 | Вход по email | Пользователь A | `POST /login` `{"username":"alice@example.com","password":"secret123"}` | 200, `token` | P2 | ✅ | `test_auth.py::test_login_by_username_and_email` |
| TC-AUTH-08 | Вход с неверным паролем | Пользователь A | `POST /login` с `password="nope"` | 401, «Неверные учетные данные» | P1 | ✅ | `test_auth.py::test_login_wrong_password` |
| TC-AUTH-09 | Вход несуществующего пользователя | — | `POST /login` `{"username":"ghost",...}` | 401 (тот же ответ, что при неверном пароле) | P2 | ✅ | `test_auth.py::test_login_unknown_user` |
| TC-AUTH-10 | Профиль текущего пользователя | Пользователь A, `{token}` | `GET /me` | 200; username, email, `two_factor_enabled=false`, `created_at` | P1 | ✅ | `test_auth.py::test_me` |
| TC-AUTH-11 | Профиль без токена | — | `GET /me` без заголовка Authorization | 401, «Требуется авторизация» | P1 | ✅ | `test_auth.py::test_me_requires_auth` |
| TC-AUTH-12 | Профиль с некорректным токеном | — | `GET /me`, `Authorization: Bearer garbage` | 403, «Недействительный токен» | P1 | ✅ | `test_auth.py::test_me_requires_auth` |
| TC-AUTH-13 | Профиль с просроченным токеном | Пользователь A | Сформировать JWT с `exp` в прошлом; `GET /me` | 403 | P1 | ✅ | `test_auth.py::test_expired_token` |

## 2. Двухфакторная аутентификация (2FA)

| ID | Название | Предусловия | Шаги | Ожидаемый результат | Приор. | Статус | Автотест |
|---|---|---|---|---|---|---|---|
| TC-2FA-01 | Настройка 2FA | Пользователь A, `{token}` | `POST /2fa/setup` | 200; `secret` (base32), `qrCode` (`data:image/png;base64,...`), 10 `backupCodes` | P1 | ✅ | `test_auth.py::test_two_factor_flow` |
| TC-2FA-02 | Подтверждение неверным кодом | TC-2FA-01 выполнен | `POST /2fa/verify` `{"token":"abc"}` | 400, «Неверный код»; 2FA не включена | P1 | ✅ | `test_auth.py::test_two_factor_flow` |
| TC-2FA-03 | Подтверждение верным кодом | TC-2FA-01 выполнен | `POST /2fa/verify` с текущим TOTP-кодом | 200 `{"success":true}`; `GET /me` → `two_factor_enabled=true` | P1 | ✅ | `test_auth.py::test_two_factor_flow` |
| TC-2FA-04 | Подтверждение без настройки | Пользователь A без 2FA | `POST /2fa/verify` `{"token":"123456"}` | 400 | P2 | ✅ | `test_auth.py::test_verify_2fa_without_setup` |
| TC-2FA-05 | Вход без кода при включённой 2FA | 2FA включена | `POST /login` с верным паролем, без `twoFactorCode` | 200 `{"requiresTwoFactor":true}`, токен не выдан | P1 | ✅ | `test_auth.py::test_two_factor_flow` |
| TC-2FA-06 | Вход с неверным кодом 2FA | 2FA включена | `POST /login` с `twoFactorCode="abc"` | 401, «Неверный код 2FA» | P1 | ✅ | `test_auth.py::test_two_factor_flow` |
| TC-2FA-07 | Вход с верным TOTP-кодом | 2FA включена | `POST /login` с текущим TOTP-кодом | 200, `token` | P1 | ✅ | `test_auth.py::test_two_factor_flow` |
| TC-2FA-08 | Вход по резервному коду | 2FA включена, известны backupCodes | `POST /login` с `twoFactorCode` = резервный код | 200, `token`; использованный код больше не принимается | P1 | ❌ [BUG-01](bug-reports.md#bug-01) | `test_known_bugs.py::test_login_with_backup_code` |
| TC-2FA-09 | Повторная настройка при включённой 2FA | 2FA включена | `POST /2fa/setup` | 400/409, текущий секрет не меняется | P1 | ❌ [BUG-02](bug-reports.md#bug-02) | `test_known_bugs.py::test_setup_2fa_when_already_enabled_is_rejected` |

## 3. Портфели

| ID | Название | Предусловия | Шаги | Ожидаемый результат | Приор. | Статус | Автотест |
|---|---|---|---|---|---|---|---|
| TC-PF-01 | Портфель по умолчанию | Новый пользователь | `GET /portfolios` | 200, ровно один портфель «Мои инвестиции» с `user_id` пользователя | P1 | ✅ | `test_auth.py::test_register_returns_token_and_creates_portfolio` |
| TC-PF-02 | Пересчёт стоимости портфеля | В портфеле актив: 2 шт. × 150 | `GET /portfolios` | `total_value = 300` | P2 | ❌ [BUG-09](bug-reports.md#bug-09) | `test_known_bugs.py::test_portfolio_total_value_updates` |

## 4. Активы

| ID | Название | Предусловия | Шаги | Ожидаемый результат | Приор. | Статус | Автотест |
|---|---|---|---|---|---|---|---|
| TC-AS-01 | Создание актива | Пользователь A, id его портфеля | `POST /assets` со всеми полями (stock, AAPL, 1.5 шт., 150, 170.25, 2026-01-15) | 200; актив со всеми полями, числа — float, дата `2026-01-15` | P1 | ✅ | `test_assets.py::test_create_and_list_assets` |
| TC-AS-02 | Список активов портфеля | TC-AS-01 выполнен | `GET /assets/{portfolio_id}` | 200, массив с созданным активом | P1 | ✅ | `test_assets.py::test_create_and_list_assets` |
| TC-AS-03 | Пустая дата покупки | Пользователь A | `POST /assets` с `purchase_date=""` | 200, `purchase_date=null` | P3 | ✅ | `test_assets.py::test_empty_purchase_date` |
| TC-AS-04 | Обязательные поля | Пользователь A | `POST /assets` `{"portfolio_id":ID}` | 422, ошибки по asset_type, name, quantity, purchase_price | P2 | ✅ | `test_assets.py::test_create_asset_missing_required_fields` |
| TC-AS-05 | Отрицательные количество и цена | Пользователь A | `POST /assets` с `quantity=-5`, `purchase_price=-100` | 422 | P2 | ❌ [BUG-05](bug-reports.md#bug-05) | `test_known_bugs.py::test_negative_quantity_and_price_rejected` |
| TC-AS-06 | Создание актива в чужом портфеле | Пользователи A и B | B: `POST /assets` с `portfolio_id` портфеля A | 403, «Доступ запрещен» | P1 | ✅ | `test_assets.py::test_cannot_use_foreign_portfolio` |
| TC-AS-07 | Просмотр активов чужого портфеля | Пользователи A и B | B: `GET /assets/{portfolio_id A}` | 200, пустой массив | P1 | ✅ | `test_assets.py::test_cannot_use_foreign_portfolio` |
| TC-AS-08 | Обновление цены актива | Актив пользователя A | `PUT /assets/{id}/price` `{"current_price":200}` | 200 `{"id":..,"name":"Apple","current_price":200.0}` | P1 | ✅ | `test_assets.py::test_update_price` |
| TC-AS-09 | Обновление цены чужого актива | Актив пользователя A | B: `PUT /assets/{id}/price` | 404, цена не изменилась | P1 | ✅ | `test_assets.py::test_update_price` |
| TC-AS-10 | Массовое обновление цен | 2 актива пользователя A | `POST /assets/update-prices` с двумя id и одним несуществующим | 200, `updated=2`, несуществующий id пропущен | P2 | ✅ | `test_assets.py::test_bulk_update_prices` |
| TC-AS-11 | Массовое обновление с некорректным id | Пользователь A | `POST /assets/update-prices` `{"prices":[{"id":"abc","price":10}]}` | 422 | P2 | ❌ [BUG-06](bug-reports.md#bug-06) | `test_known_bugs.py::test_bulk_update_with_invalid_id_returns_422` |
| TC-AS-12 | Удаление своего актива | Актив пользователя A | `DELETE /assets/{id}` | 200; актив отсутствует в списке | P1 | ✅ | `test_assets.py::test_delete_asset` |
| TC-AS-13 | Удаление чужого актива | Актив пользователя A | B: `DELETE /assets/{id}` | Актив A не удалён | P1 | ✅ | `test_assets.py::test_delete_asset` |
| TC-AS-14 | Удаление несуществующего актива | Пользователь A | `DELETE /assets/999999` | 404, «Актив не найден» | P3 | ❌ [BUG-03](bug-reports.md#bug-03) | `test_known_bugs.py::test_delete_missing_asset_returns_404` |

## 5. Безопасность и конфигурация

| ID | Название | Предусловия | Шаги | Ожидаемый результат | Приор. | Статус | Автотест |
|---|---|---|---|---|---|---|---|
| TC-SEC-01 | Защищённые эндпоинты без токена | — | Вызвать без токена: `GET /me`, `GET /portfolios`, `GET/POST/PUT/DELETE /assets...`, `POST /2fa/setup`, `POST /2fa/verify` | 401 на каждом | P1 | ✅ | `test_auth.py::test_protected_endpoints_require_auth` |
| TC-SEC-02 | Хранение пароля | — | Захэшировать пароль и проверить верный/неверный | Хранится bcrypt-хэш; верный пароль проходит, неверный — нет | P1 | ✅ | `test_security.py::test_password_hash_roundtrip` |
| TC-SEC-03 | Запуск без JWT_SECRET | Переменная `JWT_SECRET` не задана | Запустить приложение | Приложение не стартует, ошибка конфигурации | P1 | ❌ [BUG-07](bug-reports.md#bug-07) | `test_known_bugs.py::test_default_jwt_secret_is_rejected` |
| TC-SEC-04 | CORS для чужого домена | — | `OPTIONS /me` с `Origin: https://evil.example.com` | Origin не разрешён (нет `Access-Control-Allow-Origin` для него) | P2 | ❌ [BUG-08](bug-reports.md#bug-08) | `test_known_bugs.py::test_cors_rejects_unknown_origin` |

## 6. Система и база данных

| ID | Название | Предусловия | Шаги | Ожидаемый результат | Приор. | Статус | Автотест |
|---|---|---|---|---|---|---|---|
| TC-SYS-01 | Health-check | Сервер запущен | `GET /health` | 200 `{"status":"ok"}` | P1 | ✅ | `test_health.py::test_health` |
| TC-DB-01 | Применение и откат миграций | Пустая БД | `alembic upgrade head` → `downgrade base` → `upgrade head` | Все шаги без ошибок | P1 | ✅ | `test_migrations.py::test_downgrade_and_upgrade` |
| TC-DB-02 | Соответствие моделей миграциям | Миграции применены | `alembic check` | «No new upgrade operations detected» | P2 | ✅ | `test_migrations.py::test_models_match_migrations` |

---

## Итоги

| Раздел | Всего | ✅ Pass | ❌ Fail |
|---|---|---|---|
| Регистрация и вход | 13 | 12 | 1 |
| 2FA | 9 | 7 | 2 |
| Портфели | 2 | 1 | 1 |
| Активы | 14 | 11 | 3 |
| Безопасность и конфигурация | 4 | 2 | 2 |
| Система и БД | 3 | 3 | 0 |
| **Итого** | **45** | **36** | **9** |

Все тест-кейсы автоматизированы. Запуск:

```bash
cd server
pytest -rxX
```

Тесты на найденные дефекты лежат в `test_known_bugs.py` и помечены `xfail(strict=True)`, поэтому в отчёте они отображаются как `XFAIL`. Когда дефект исправят, тест начнёт проходить: pytest покажет `XPASS(strict)` и упадёт, и тогда маркер нужно снять.
