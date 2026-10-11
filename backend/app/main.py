"""CogniFleet API application entrypoint.

The original implementation was a ~1900-line module containing every route, a
hard-coded JWT secret and demo seeding. Routes now live in ``app/routers`` and
configuration/secrets are read from the environment (see ``.env.example``).
"""
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt

from . import models  # noqa: F401  (ensures models are registered)
from .config import settings
from .database import Base, SessionLocal, engine
from .seed import seed_database
from .websocket import manager

from .routers import (
    ai,
    alerts,
    auth,
    drivers,
    invoices,
    messages,
    pods,
    system,
    trips,
    vehicles,
    warehouses,
)
from .routers import settings as settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and optionally seed demo data.
    Base.metadata.create_all(bind=engine)
    if settings.seed_demo_data:
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
    else:
        print("[startup] Demo seeding disabled (SEED_DEMO_DATA=false).")
    yield


app = FastAPI(title="CogniFleet API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
def health_check():
    return {"status": "ok", "environment": settings.environment}


# --- Routers ---------------------------------------------------------------
for router in (
    auth.router,
    settings_router.router,
    vehicles.router,
    drivers.router,
    trips.router,
    warehouses.router,
    pods.router,
    invoices.router,
    alerts.router,
    messages.router,
    ai.router,
    system.router,
):
    app.include_router(router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """Realtime broadcast channel.

    FIX: the socket now requires a valid JWT so unauthenticated clients cannot
    observe fleet activity. The token may be supplied as a ``?token=`` query
    parameter (browsers cannot set headers on WebSocket handshakes).
    """
    token = websocket.query_params.get("token") or token
    authenticated = False
    if token:
        try:
            jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            authenticated = True
        except Exception:  # noqa: BLE001
            authenticated = False

    if not authenticated:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:  # noqa: BLE001
        manager.disconnect(websocket)
