from fastapi import APIRouter

from app.api import (
    fx,
    health,
    instruments,
    lots,
    market,
    payments,
    preferences,
    reports,
    sales,
    securities,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(instruments.router)
api_router.include_router(securities.router)
api_router.include_router(lots.router)
api_router.include_router(sales.router)
api_router.include_router(payments.router)
api_router.include_router(fx.router)
api_router.include_router(market.router)
api_router.include_router(reports.router)
api_router.include_router(preferences.router)
