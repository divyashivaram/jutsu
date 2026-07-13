from fastapi.testclient import TestClient


def test_root_serves_frontend(client: TestClient) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    assert "Jutsu Master" in resp.text


def test_scripts_served(client: TestClient) -> None:
    resp = client.get("/scripts/main.js")
    assert resp.status_code == 200
