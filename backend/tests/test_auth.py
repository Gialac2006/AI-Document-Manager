from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _unique_email(prefix: str) -> str:
    return f"{prefix}{uuid4().hex[:8]}@example.com"


def test_register_individual():
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Nguyen Van A",
            "email": _unique_email("individual"),
            "password": "secret123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "individual"
    assert data["user"]["organization_id"] is None
    assert data["token"]["access_token"]


def test_register_organization_creates_manager():
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Tran Thi B",
            "email": _unique_email("manager"),
            "password": "secret123",
            "organization_name": f"Cong ty {uuid4().hex[:8]}",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "manager"
    assert data["user"]["organization_id"] is not None


def test_register_duplicate_email():
    email = _unique_email("dup")
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Nguyen Van A",
            "email": email,
            "password": "secret123",
        },
    )
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Nguyen Van A",
            "email": email,
            "password": "secret123",
        },
    )
    assert response.status_code == 409


def test_login_success_and_me():
    email = _unique_email("login")
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Le Van C", "email": email, "password": "secret123"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "secret123"},
    )
    assert response.status_code == 200
    token = response.json()["token"]["access_token"]

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_login_wrong_password():
    email = _unique_email("wrongpass")
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Pham Van D", "email": email, "password": "secret123"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "sai-mat-khau"},
    )
    assert response.status_code == 401


def test_me_without_token():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_forgot_password_returns_token_for_existing_email():
    email = _unique_email("forgot")
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Nguyen Van E", "email": email, "password": "secret123"},
    )
    response = client.post(
        "/api/v1/auth/forgot-password", json={"email": email}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reset_token"]
    assert data["reset_url"]


def test_forgot_password_does_not_leak_unknown_email():
    response = client.post(
        "/api/v1/auth/forgot-password", json={"email": _unique_email("ghost")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reset_token"] is None
    assert data["reset_url"] is None


def test_reset_password_flow():
    email = _unique_email("reset")
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Nguyen Van F", "email": email, "password": "secret123"},
    )
    forgot = client.post(
        "/api/v1/auth/forgot-password", json={"email": email}
    ).json()
    token = forgot["reset_token"]

    validate = client.get(
        f"/api/v1/auth/reset-password/validate?token={token}"
    )
    assert validate.status_code == 200
    assert validate.json()["valid"] is True

    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "matkhaumoi"},
    )
    assert reset.status_code == 200

    old = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    )
    assert old.status_code == 401

    new = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "matkhaumoi"}
    )
    assert new.status_code == 200


def test_reset_password_token_can_be_used_once():
    email = _unique_email("onetime")
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Nguyen Van G", "email": email, "password": "secret123"},
    )
    token = client.post(
        "/api/v1/auth/forgot-password", json={"email": email}
    ).json()["reset_token"]

    client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "matkhaumoi"},
    )
    reuse = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "lanthuhai"},
    )
    assert reuse.status_code == 400


def test_reset_password_invalid_token():
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "token-khong-ton-tai", "new_password": "matkhaumoi"},
    )
    assert response.status_code == 400
