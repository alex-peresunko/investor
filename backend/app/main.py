from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging(get_settings().log_level)
    app = FastAPI(title="Investor", version="0.1.0", openapi_url="/api/v1/openapi.json")
    install_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
