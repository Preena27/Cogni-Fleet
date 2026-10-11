"""Multi-tenant isolation regression tests."""
import uuid


def _new_manager(login, client):
    username = f"mgr_{uuid.uuid4().hex[:8]}"
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "password": "password123",
            "role": "manager",
            "email": f"{username}@example.com",
            "company_name": "Isolated Co",
        },
    )
    assert response.status_code == 200, response.text
    return login(client, username, "password123", "manager")


def test_manager_only_sees_own_drivers(client, admin_headers, manager_headers):
    admin_drivers = {d["name"] for d in client.get("/api/drivers", headers=admin_headers).json()}
    manager_drivers = {d["name"] for d in client.get("/api/drivers", headers=manager_headers).json()}

    assert admin_drivers == {"John Davis", "Marcus Rodriguez"}
    assert manager_drivers == {"Emily Wong", "Robert Taylor", "Lisa Miller"}
    # No overlap between tenants.
    assert admin_drivers.isdisjoint(manager_drivers)


def test_admin_cannot_access_other_tenants_trip(client, admin_headers):
    # Trip #3 belongs to the "manager" account, not admin.
    response = client.put(
        "/api/trips/3",
        headers=admin_headers,
        json={"customer": "Hijack", "pickup": "a", "destination": "b", "status": "Completed"},
    )
    assert response.status_code == 404


def test_admin_cannot_assign_other_tenants_driver(client, admin_headers, manager_headers):
    other_driver = client.get("/api/drivers", headers=manager_headers).json()[0]
    trip = client.post(
        "/api/trips",
        headers=admin_headers,
        json={"customer": "Tenant Check", "pickup": "A", "destination": "B", "weight": 1.0},
    ).json()

    response = client.post(
        f"/api/trips/{trip['id']}/manual-assign",
        headers=admin_headers,
        json={"driver_id": other_driver["id"], "vehicle_id": 1},
    )
    assert response.status_code == 400


def test_system_reset_is_tenant_scoped(client, admin_headers, login):
    isolated = _new_manager(login, client)

    # Give the isolated manager some data.
    client.post(
        "/api/vehicles",
        headers=isolated,
        json={"vehicle_number": "ISO-1", "type": "Box Truck", "capacity": 5.0},
    )
    client.post(
        "/api/trips",
        headers=isolated,
        json={"customer": "ISO Co", "pickup": "A", "destination": "B", "weight": 1.0},
    )
    client.post(
        "/api/drivers",
        headers=isolated,
        json={
            "name": "Iso Driver",
            "username": f"isodriver_{uuid.uuid4().hex[:8]}",
            "password": "password123",
            "license": "DL-ISO-1",
            "phone": "+91 00000 00000",
        },
    )
    assert len(client.get("/api/trips", headers=isolated).json()) == 1
    assert len(client.get("/api/drivers", headers=isolated).json()) == 1

    # Admin's own data snapshot.
    admin_drivers_before = len(client.get("/api/drivers", headers=admin_headers).json())

    # The isolated manager resets *their* data.
    assert client.post("/api/system/reset", headers=isolated).status_code == 200
    assert client.get("/api/trips", headers=isolated).json() == []
    assert client.get("/api/drivers", headers=isolated).json() == []

    # Admin's tenant is untouched.
    assert len(client.get("/api/drivers", headers=admin_headers).json()) == admin_drivers_before


def test_alert_acknowledge_is_scoped(client, admin_headers, manager_headers):
    manager_alerts = client.get("/api/alerts", headers=manager_headers).json()
    assert manager_alerts, "expected the manager tenant to have seeded alerts"
    other_alert_id = manager_alerts[0]["id"]

    response = client.post(f"/api/alerts/{other_alert_id}/acknowledge", headers=admin_headers)
    assert response.status_code == 404
