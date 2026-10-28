from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    NEBIUS_API_KEY: SecretStr = SecretStr("")
    NEBIUS_BASE_URL: str = "https://api.tokenfactory.nebius.com/v1/"
    TAVILY_API_KEY: SecretStr = SecretStr("")
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    DATABASE_URL: str = "sqlite:///./sayze.db"
    SAYZE_API_TOKEN: SecretStr = SecretStr("")
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
