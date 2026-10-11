"""Authentication and authorization regression tests."""
import pytest
from jose import jwt

# Endpoints that must reject anonymous callers. Each previously returned 200.
PROTECTED_ENDPOINTS = [
    ("GET", "/api/drivers"),
    ("GET", "/api/trips"),
    ("GET", "/api/vehicles"),
    ("GET", "/api/warehouses"),
    ("GET", "/api/invoices"),
    ("GET", "/api/alerts"),
    ("GET", "/api/pods"),
    ("GET", "/api/automation-logs"),
    ("GET", "/api/settings"),
    ("GET", "/api/ai/intelligence"),
    ("POST", "/api/ai-assistant"),
    ("GET", "/api/trips/1/ai-assign"),
    ("POST", "/api/trips/1/start"),
    ("POST", "/api/trips/1/sos"),
    ("POST", "/api/trips/1/accept"),
    ("POST", "/api/trips/1/simulate-event?event_type=traffic"),
    ("POST", "/api/system/reset"),
]


@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
def test_protected_endpoints_require_auth(client, method, path):
    body = {"query": "hi"} if path == "/api/ai-assistant" else None
    response = client.request(method, path, json=body)
    assert response.status_code == 401, f"{method} {path} returned {response.status_code}"


def test_forged_token_with_old_hardcoded_secret_is_rejected(client):
    forged = jwt.encode(
        {"sub": "admin", "role": "manager"},
        "cognifleet-super-secret-security-key",  # the old committed secret
        algorithm="HS256",
    )
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert response.status_code == 401


def test_login_then_me(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin", "role": "manager"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"
    assert me.json()["role"] == "manager"


def test_login_rejects_wrong_role(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin", "role": "driver"},
    )
    assert response.status_code == 401


def test_register_only_allows_managers(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "sneaky_driver", "password": "password123", "role": "driver"},
    )
    assert response.status_code == 400


def test_register_enforces_password_length(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "short_pw_manager", "password": "abc", "role": "manager"},
    )
    assert response.status_code == 400
