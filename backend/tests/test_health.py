from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["database"] == "ok"


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "running" in response.json()["message"]
