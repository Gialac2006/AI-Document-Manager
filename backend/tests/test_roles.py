from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SUPER_ADMIN = {"email": "admin@example.com", "password": "admin123456"}
MANAGER = {"email": "manager.alpha@example.com", "password": "demo123456"}
STAFF = {"email": "staff.a1@example.com", "password": "demo123456"}


def _login(account):
    response = client.post("/api/v1/auth/login", json=account)
    assert response.status_code == 200
    return response.json()["token"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_super_admin_manages_organizations():
    token = _login(SUPER_ADMIN)

    orgs = client.get(
        "/api/v1/admin/organizations", headers=_auth(token)
    )
    assert orgs.status_code == 200
    assert len(orgs.json()) >= 2

    created = client.post(
        "/api/v1/admin/organizations",
        json={"name": f"Test Org {uuid4().hex[:8]}"},
        headers=_auth(token),
    )
    assert created.status_code == 201

    all_users = client.get("/api/v1/admin/users", headers=_auth(token))
    assert all_users.status_code == 200
    assert any(u["role"] == "super_admin" for u in all_users.json())


def test_manager_creates_and_lists_staff_in_own_org():
    token = _login(MANAGER)

    members = client.get("/api/v1/users", headers=_auth(token))
    assert members.status_code == 200
    assert all(u["organization_id"] == 1 for u in members.json())

    created = client.post(
        "/api/v1/users",
        json={
            "full_name": "Nhan vien moi",
            "email": f"staff.new{uuid4().hex[:8]}@example.com",
            "password": "demo123456",
        },
        headers=_auth(token),
    )
    assert created.status_code == 201
    assert created.json()["role"] == "staff"
    assert created.json()["organization_id"] == 1


def test_staff_cannot_manage_users():
    token = _login(STAFF)
    response = client.get("/api/v1/users", headers=_auth(token))
    assert response.status_code == 403
