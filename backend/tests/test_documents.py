from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

MANAGER = {"email": "manager.alpha@example.com", "password": "demo123456"}
STAFF = {"email": "staff.a1@example.com", "password": "demo123456"}
INDIVIDUAL = {"email": "individual.z@example.com", "password": "demo123456"}


def _login(account):
    response = client.post("/api/v1/auth/login", json=account)
    assert response.status_code == 200
    return response.json()["token"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _upload(token, files, data=None):
    return client.post(
        "/api/v1/documents",
        headers=_auth(token),
        files=files,
        data=data or {},
    )


def _cleanup_folders(token):
    response = client.get("/api/v1/folders", headers=_auth(token))
    for folder in response.json():
        client.delete(
            f"/api/v1/folders/{folder['id']}", headers=_auth(token)
        )


def test_manager_creates_folder_and_lists_it():
    token = _login(MANAGER)
    _cleanup_folders(token)

    created = client.post(
        "/api/v1/folders",
        json={"name": f"Thu muc {uuid4().hex[:6]}"},
        headers=_auth(token),
    )
    assert created.status_code == 201
    assert created.json()["organization_id"] == 1

    folders = client.get("/api/v1/folders", headers=_auth(token))
    assert folders.status_code == 200
    assert any(f["id"] == created.json()["id"] for f in folders.json())


def test_individual_only_sees_own_folders():
    token = _login(INDIVIDUAL)
    _cleanup_folders(token)

    created = client.post(
        "/api/v1/folders",
        json={"name": f"Ca nhan {uuid4().hex[:6]}"},
        headers=_auth(token),
    )
    assert created.status_code == 201
    assert created.json()["owner_id"] is not None

    folders = client.get("/api/v1/folders", headers=_auth(token))
    assert all(f["owner_id"] == created.json()["owner_id"] for f in folders.json())


def test_staff_uploads_document_and_gets_versions():
    token = _login(STAFF)

    uploaded = _upload(
        token,
        files={"file": ("bao-cao.txt", b"noi dung bao cao", "text/plain")},
        data={"title": "Bao cao thuong ky"},
    )
    assert uploaded.status_code == 201
    doc = uploaded.json()
    assert doc["title"] == "Bao cao thuong ky"
    assert doc["file_type"] == ".txt"
    assert doc["organization_id"] == 1
    assert doc["current_version"] == 1

    detail = client.get(
        f"/api/v1/documents/{doc['id']}", headers=_auth(token)
    )
    assert detail.status_code == 200

    versions = client.get(
        f"/api/v1/documents/{doc['id']}/versions", headers=_auth(token)
    )
    assert versions.status_code == 200
    assert len(versions.json()) == 1
    assert versions.json()[0]["version"] == 1

    download = client.get(
        f"/api/v1/documents/{doc['id']}/download", headers=_auth(token)
    )
    assert download.status_code == 200
    assert download.content == b"noi dung bao cao"


def test_staff_does_not_see_individual_document():
    staff_token = _login(STAFF)
    individual_token = _login(INDIVIDUAL)

    uploaded = _upload(
        individual_token,
        files={"file": ("rieng-tu.txt", b"bi mat", "text/plain")},
    )
    assert uploaded.status_code == 201
    doc_id = uploaded.json()["id"]

    listed = client.get(
        "/api/v1/documents", headers=_auth(staff_token)
    )
    assert all(d["id"] != doc_id for d in listed.json())

    detail = client.get(
        f"/api/v1/documents/{doc_id}", headers=_auth(staff_token)
    )
    assert detail.status_code == 403


def test_manager_moves_document_between_folders():
    token = _login(MANAGER)

    f1 = client.post(
        "/api/v1/folders",
        json={"name": f"Folder A {uuid4().hex[:6]}"},
        headers=_auth(token),
    ).json()
    f2 = client.post(
        "/api/v1/folders",
        json={"name": f"Folder B {uuid4().hex[:6]}"},
        headers=_auth(token),
    ).json()

    uploaded = _upload(
        token,
        files={"file": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"folder_id": str(f1["id"])},
    )
    doc_id = uploaded.json()["id"]

    updated = client.put(
        f"/api/v1/documents/{doc_id}",
        json={"title": "Doi tieu de", "folder_id": f2["id"]},
        headers=_auth(token),
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Doi tieu de"
    assert updated.json()["folder_id"] == f2["id"]

    filtered = client.get(
        f"/api/v1/documents?folder_id={f2['id']}", headers=_auth(token)
    )
    assert any(d["id"] == doc_id for d in filtered.json())


def test_staff_cannot_delete_document():
    token = _login(STAFF)
    uploaded = _upload(
        token,
        files={"file": ("keep.txt", b"giu lai", "text/plain")},
    )
    doc_id = uploaded.json()["id"]

    deleted = client.delete(
        f"/api/v1/documents/{doc_id}", headers=_auth(token)
    )
    assert deleted.status_code == 403

    detail = client.get(
        f"/api/v1/documents/{doc_id}", headers=_auth(token)
    )
    assert detail.status_code == 200
