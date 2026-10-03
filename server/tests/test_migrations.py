from alembic import command


def test_models_match_migrations(migrated_db):
    """Падает, если модели изменены без новой миграции."""
    command.check(migrated_db)


def test_downgrade_and_upgrade(migrated_db):
    command.downgrade(migrated_db, "base")
    command.upgrade(migrated_db, "head")
