from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    JWT_SECRET: str = "your_secret_key_here"
    JWT_EXPIRES_MINUTES: int = 60 * 24 * 7

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "investor_social"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()
