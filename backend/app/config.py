"""Application configuration.

All secrets and deployment-specific values are read from the environment so
that nothing sensitive lives in source control. See ``backend/.env.example``.
"""
import os
import secrets
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# Load variables from a local backend/.env file (if present) before anything
# reads from os.environ. Resolved relative to this file so it works regardless
# of the current working directory. Real environment variables take precedence.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _csv_env(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.environment: str = os.getenv("ENVIRONMENT", "development").strip().lower()
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./fleet.db")
        self.openai_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
        self.access_token_expire_minutes: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
        )

        # Browser origins allowed to call the API. Never fall back to "*".
        self.cors_origins: List[str] = _csv_env(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )

        # Demo data seeding is opt-in and disabled in production by default.
        self.seed_demo_data: bool = _bool_env(
            "SEED_DEMO_DATA", self.environment != "production"
        )

        # Fail closed on the JWT secret. In production it is mandatory; in
        # development we generate an ephemeral key (sessions reset on restart).
        secret = os.getenv("SECRET_KEY")
        if not secret:
            if self.environment == "production":
                raise RuntimeError(
                    "SECRET_KEY must be set when ENVIRONMENT=production. Generate "
                    'one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
                )
            secret = secrets.token_urlsafe(48)
            print(
                "[config] WARNING: SECRET_KEY is not set. Generated an ephemeral "
                "development key; tokens will be invalidated on restart. Set "
                "SECRET_KEY for stable sessions."
            )
        self.secret_key: str = secret
        self.algorithm: str = "HS256"


settings = Settings()
