from fastapi.testclient import TestClient


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_progress_starts_empty(client: TestClient, token: str) -> None:
    resp = client.get("/api/progress", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"xp": 0, "rank": "academy", "seals": {}, "jutsus": {}}


def test_progress_roundtrip(client: TestClient, token: str) -> None:
    payload = {
        "xp": 150,
        "rank": "genin",
        "seals": {"tiger": {"best": 0.92, "attempts": 4}},
        "jutsus": {"fireball": {"grade": "B", "attempts": 2}},
    }
    put = client.put("/api/progress", json=payload, headers=_auth(token))
    assert put.status_code == 200
    got = client.get("/api/progress", headers=_auth(token)).json()
    assert got == payload


def test_progress_requires_auth(client: TestClient) -> None:
    assert client.get("/api/progress").status_code == 401
    assert client.put("/api/progress", json={"xp": 1}).status_code == 401


def test_leaderboard_public_and_sorted(client: TestClient) -> None:
    for name, xp in [("naruto", 300), ("sasuke", 500), ("sakura", 400)]:
        reg = client.post("/api/register", json={"username": name, "password": "password1"})
        tok = reg.json()["token"]
        client.put(
            "/api/progress",
            json={"xp": xp, "rank": "genin", "seals": {}, "jutsus": {}},
            headers=_auth(tok),
        )
    resp = client.get("/api/leaderboard")
    assert resp.status_code == 200
    rows = resp.json()
    assert [r["username"] for r in rows] == ["sasuke", "sakura", "naruto"]
    assert rows[0]["xp"] == 500
