from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    JWT_SECRET: str = "your_secret_key_here"
    JWT_EXPIRES_MINUTES: int = 60 * 24 * 7

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "investor_social"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"

    # Полный URL имеет приоритет над DB_* (удобно для Docker/CI)
    DATABASE_URL: str | None = None

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return URL.create(
            "postgresql+psycopg",
            username=self.DB_USER,
            password=self.DB_PASSWORD,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        ).render_as_string(hide_password=False)


settings = Settings()
