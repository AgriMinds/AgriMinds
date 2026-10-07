from fastapi import APIRouter
from app.api.v1.endpoints import health, drought, advisory, enso

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(drought.router)
api_router.include_router(advisory.router)
api_router.include_router(enso.router)
