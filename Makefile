.PHONY: up down logs build migrate revision test

up:          ## Поднять приложение и БД
	docker compose up -d --build

down:        ## Остановить контейнеры
	docker compose down

logs:        ## Логи приложения
	docker compose logs -f app

migrate:     ## Применить миграции внутри контейнера
	docker compose exec app alembic upgrade head

revision:    ## Новая миграция: make revision m="описание"
	cd server && alembic revision --autogenerate -m "$(m)"

test:        ## Запустить тесты (нужен PostgreSQL, см. README)
	cd server && pytest
