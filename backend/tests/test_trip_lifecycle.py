"""End-to-end trip lifecycle tests (acceptance, POD, completion pipeline)."""


def _pick_driver_and_vehicle(client, headers, name="John Davis"):
    drivers = client.get("/api/drivers", headers=headers).json()
    driver = next(d for d in drivers if d["name"] == name)
    vehicles = client.get("/api/vehicles", headers=headers).json()
    vehicle = next(v for v in vehicles if v["id"] == driver["vehicle_id"])
    return driver, vehicle


def test_driver_accept_reject_route_is_live(client, admin_headers, driver_headers):
    """The driver accept/reject handler used to be shadowed by a duplicate route."""
    driver, vehicle = _pick_driver_and_vehicle(client, admin_headers)
    trip = client.post(
        "/api/trips",
        headers=admin_headers,
        json={"customer": "Accept Test", "pickup": "A", "destination": "B", "weight": 1.0},
    ).json()
    client.post(
        f"/api/trips/{trip['id']}/manual-assign",
        headers=admin_headers,
        json={"driver_id": driver["id"], "vehicle_id": vehicle["id"]},
    )

    accept = client.post(f"/api/trips/{trip['id']}/accept?accept=true", headers=driver_headers)
    assert accept.status_code == 200
    assert accept.json()["accepted"] is True

    reject = client.post(f"/api/trips/{trip['id']}/accept?accept=false&reason=test", headers=driver_headers)
    assert reject.status_code == 200
    updated = next(t for t in client.get("/api/trips", headers=admin_headers).json() if t["id"] == trip["id"])
    assert updated["status"] == "Unassigned"
    assert updated["driver_id"] is None


def test_driver_cannot_act_on_unassigned_trip(client, admin_headers, driver_headers):
    trip = client.post(
        "/api/trips",
        headers=admin_headers,
        json={"customer": "Not Mine", "pickup": "A", "destination": "B", "weight": 1.0},
    ).json()
    response = client.post(f"/api/trips/{trip['id']}/start", headers=driver_headers)
    assert response.status_code == 403


def test_completion_pipeline_counts_distance_once_and_is_idempotent(client, admin_headers, driver_headers):
    driver, vehicle = _pick_driver_and_vehicle(client, admin_headers)
    mileage_before = vehicle["mileage"]

    trip = client.post(
        "/api/trips",
        headers=admin_headers,
        json={
            "customer": "Pipeline Test",
            "pickup": "A",
            "destination": "B",
            "weight": 5.0,
            "distance": 100.0,
        },
    ).json()
    trip_id = trip["id"]
    assert trip["remaining_distance"] == 100.0

    client.post(
        f"/api/trips/{trip_id}/manual-assign",
        headers=admin_headers,
        json={"driver_id": driver["id"], "vehicle_id": vehicle["id"]},
    )
    client.post(f"/api/trips/{trip_id}/accept?accept=true", headers=driver_headers)
    client.post(f"/api/trips/{trip_id}/start", headers=driver_headers)
    client.post(
        f"/api/trips/{trip_id}/progress",
        headers=driver_headers,
        json={"distance_delta": 50.0, "speed": 50.0, "lat": 12.0, "lng": 77.0},
    )
    client.post(
        "/api/pods/submit",
        headers=driver_headers,
        json={"trip_id": trip_id, "signature_path": "data:sig", "photo_path": "data:photo"},
    )
    assert client.post(
        f"/api/trips/{trip_id}/end", headers=driver_headers, json={"duration": 120.0}
    ).status_code == 200

    invoices = [i for i in client.get("/api/invoices", headers=admin_headers).json() if i["trip_id"] == trip_id]
    assert len(invoices) == 1

    pods = [p for p in client.get("/api/pods", headers=admin_headers).json() if p["trip_id"] == trip_id]
    assert len(pods) == 1

    vehicle_after = next(
        v for v in client.get("/api/vehicles", headers=admin_headers).json() if v["id"] == vehicle["id"]
    )
    # Exactly the trip distance is applied, no double count.
    assert round(vehicle_after["mileage"] - mileage_before, 2) == 100.0

    # Approving the POD must not create a second invoice or extra mileage.
    client.put(f"/api/pods/{pods[0]['id']}?status=Approved", headers=admin_headers)
    invoices_after = [i for i in client.get("/api/invoices", headers=admin_headers).json() if i["trip_id"] == trip_id]
    pods_after = [p for p in client.get("/api/pods", headers=admin_headers).json() if p["trip_id"] == trip_id]
    vehicle_final = next(
        v for v in client.get("/api/vehicles", headers=admin_headers).json() if v["id"] == vehicle["id"]
    )
    assert len(invoices_after) == 1
    assert len(pods_after) == 1
    assert vehicle_final["mileage"] == vehicle_after["mileage"]


def test_invoice_numbers_are_unique(client, admin_headers, driver_headers):
    invoices = client.get("/api/invoices", headers=admin_headers).json()
    numbers = [i["invoice_number"] for i in invoices]
    assert len(numbers) == len(set(numbers))
