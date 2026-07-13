from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jutsu_master.app import create_app


@pytest.fixture()
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(db_path=tmp_path / "test.db")
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def token(client: TestClient) -> str:
    resp = client.post("/api/register", json={"username": "naruto", "password": "rasengan123"})
    assert resp.status_code == 201
    data: str = resp.json()["token"]
    return data
