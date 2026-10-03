#!/bin/sh
set -e

# Применяем миграции перед стартом (отключается RUN_MIGRATIONS=0)
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    echo "Applying database migrations..."
    alembic upgrade head
fi

exec "$@"
