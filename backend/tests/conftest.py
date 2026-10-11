"""Shared pytest fixtures.

A throwaway SQLite database is configured before the app is imported so tests
never touch the development database. The app's lifespan event seeds the demo
data once for the whole session.
"""
import os
import tempfile

os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-production")
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix="_test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient, username: str, password: str, role: str) -> dict:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "role": role},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def admin_headers(client):
    return _login(client, "admin", "admin", "manager")


@pytest.fixture
def manager_headers(client):
    return _login(client, "manager", "admin", "manager")


@pytest.fixture
def driver_headers(client):
    return _login(client, "driver1", "driver", "driver")


@pytest.fixture
def login():
    return _login
