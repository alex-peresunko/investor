from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INVESTOR_")

    db_host: str = "db"
    db_port: int = 5432
    db_name: str = "investor"
    db_user: str = "investor"
    db_password_file: Path = Path("/run/secrets/investor_db_password")
    # Overrides every db_* field when set; used by tests.
    database_url: str | None = None
    log_level: str = "INFO"
    nbu_base_url: str = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange"

    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        password = self.db_password_file.read_text().strip()
        return (
            f"postgresql+psycopg://{self.db_user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
