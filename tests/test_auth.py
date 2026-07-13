from fastapi.testclient import TestClient


def test_register_returns_token(client: TestClient) -> None:
    resp = client.post("/api/register", json={"username": "naruto", "password": "rasengan123"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "naruto"
    assert isinstance(body["token"], str) and len(body["token"]) > 20


def test_register_duplicate_username_rejected(client: TestClient) -> None:
    payload = {"username": "naruto", "password": "rasengan123"}
    assert client.post("/api/register", json=payload).status_code == 201
    assert client.post("/api/register", json=payload).status_code == 409


def test_register_short_password_rejected(client: TestClient) -> None:
    resp = client.post("/api/register", json={"username": "naruto", "password": "abc"})
    assert resp.status_code == 422


def test_login_correct_password(client: TestClient) -> None:
    client.post("/api/register", json={"username": "naruto", "password": "rasengan123"})
    resp = client.post("/api/login", json={"username": "naruto", "password": "rasengan123"})
    assert resp.status_code == 200
    assert isinstance(resp.json()["token"], str)


def test_login_wrong_password(client: TestClient) -> None:
    client.post("/api/register", json={"username": "naruto", "password": "rasengan123"})
    resp = client.post("/api/login", json={"username": "naruto", "password": "wrong-pass"})
    assert resp.status_code == 401


def test_me_requires_token(client: TestClient) -> None:
    assert client.get("/api/me").status_code == 401


def test_me_with_token(client: TestClient, token: str) -> None:
    resp = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "naruto"
