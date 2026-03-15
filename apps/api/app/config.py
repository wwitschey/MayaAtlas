import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

LOCAL_API_ORIGIN = "http://localhost:8000"
LOCAL_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
LOCAL_DATABASE_URL = "postgresql+psycopg://maya_user:maya_password@localhost:5432/maya_atlas"


def _is_production() -> bool:
    return os.getenv("ENV", os.getenv("PYTHON_ENV", "")).strip().lower() == "production"


def _validate_origin_list(name: str, value: str) -> list[str]:
    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    if not origins:
        raise RuntimeError(f"{name} must include at least one origin.")

    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise RuntimeError(
                f"{name} contains an invalid origin: {origin!r}. Use full origins like https://example.com."
            )

    return origins


def _validate_origin(name: str, value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise RuntimeError(
            f"{name} must be a full origin like https://api.example.com, got {value!r}."
        )
    return value


def _validate_database_url(value: str) -> str:
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.hostname:
        raise RuntimeError("DATABASE_URL must be a valid SQLAlchemy connection URL.")
    return value


def _normalize_database_url(value: str) -> str:
    if value.startswith("postgresql+psycopg://"):
        return value
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value.removeprefix("postgresql://")
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value.removeprefix("postgres://")
    return value


def get_database_url() -> str:
    configured = os.getenv("DATABASE_URL", "").strip()
    if configured:
        return _normalize_database_url(_validate_database_url(configured))

    if _is_production():
        raise RuntimeError("DATABASE_URL is required in production.")

    return _normalize_database_url(LOCAL_DATABASE_URL)


def get_allowed_origins() -> list[str]:
    configured = os.getenv("API_CORS_ORIGINS", "").strip()
    if configured:
        return _validate_origin_list("API_CORS_ORIGINS", configured)

    if _is_production():
        raise RuntimeError("API_CORS_ORIGINS is required in production.")

    return LOCAL_CORS_ORIGINS


def get_api_public_origin() -> str:
    configured = os.getenv("API_PUBLIC_ORIGIN", "").strip()
    if configured:
        return _validate_origin("API_PUBLIC_ORIGIN", configured)

    if _is_production():
        raise RuntimeError("API_PUBLIC_ORIGIN is required in production.")

    return LOCAL_API_ORIGIN
