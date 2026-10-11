"""Realtime channel authentication tests."""
import pytest
from starlette.websockets import WebSocketDisconnect


def test_websocket_rejects_missing_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws") as websocket:
            websocket.receive_text()


def test_websocket_rejects_invalid_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws?token=not-a-real-token") as websocket:
            websocket.receive_text()


def test_websocket_accepts_valid_token(client, admin_headers):
    token = admin_headers["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws?token={token}") as websocket:
        websocket.send_text("ping")
