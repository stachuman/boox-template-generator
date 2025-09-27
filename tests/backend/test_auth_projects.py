import importlib
import sys
from typing import Dict

import pytest
from fastapi.testclient import TestClient


MODULES_TO_RESET = [
    "backend.app.api.public",
    "backend.app.api.projects",
    "backend.app.api.auth",
    "backend.app.workspaces",
    "backend.app.auth",
    "backend.app.main",
]


@pytest.fixture()
def client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("EINK_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("EINK_JWT_SECRET", "integration-test-secret")
    monkeypatch.delenv("EINK_JWT_SECRET_FILE", raising=False)

    for module in MODULES_TO_RESET:
        if module in sys.modules:
            del sys.modules[module]

    app_module = importlib.import_module("backend.app.main")
    return TestClient(app_module.app)


def _auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client: TestClient, username: str, email: str, password: str = "Passw0rd!") -> str:
    register_resp = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert register_resp.status_code == 201, register_resp.text

    login_resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login_resp.status_code == 200, login_resp.text
    token = login_resp.json()["access_token"]
    return token


def test_auth_protects_projects(client: TestClient) -> None:
    unauthenticated = client.get("/api/projects")
    assert unauthenticated.status_code == 401

    token = _register_and_login(client, "alice", "alice@example.com")
    response = client.get("/api/projects", headers=_auth_headers(token))
    assert response.status_code == 200
    assert response.json() == []


def test_user_isolation(client: TestClient) -> None:
    token_alice = _register_and_login(client, "alice", "alice@example.com")
    create_resp = client.post(
        "/api/projects",
        headers=_auth_headers(token_alice),
        json={
            "name": "Daily Planner",
            "description": "Personal planner",
            "device_profile": "boox-note-air-4c",
            "author": "",
            "category": "planner",
        },
    )
    assert create_resp.status_code == 201
    project_id = create_resp.json()["id"]

    token_bob = _register_and_login(client, "bob", "bob@example.com")
    list_resp = client.get("/api/projects", headers=_auth_headers(token_bob))
    assert list_resp.status_code == 200
    assert list_resp.json() == []

    get_resp = client.get(f"/api/projects/{project_id}", headers=_auth_headers(token_bob))
    assert get_resp.status_code == 404


def test_public_sharing_and_gallery(client: TestClient) -> None:
    token = _register_and_login(client, "alice", "alice@example.com")
    create_resp = client.post(
        "/api/projects",
        headers=_auth_headers(token),
        json={
            "name": "Weekly Layout",
            "description": "Template",
            "device_profile": "boox-note-air-4c",
            "author": "",
            "category": "planner",
        },
    )
    project = create_resp.json()
    project_id = project["id"]

    share_resp = client.post(
        f"/api/projects/{project_id}/share",
        headers=_auth_headers(token),
        json={"is_public": True, "url_slug": "weekly-layout"},
    )
    assert share_resp.status_code == 200
    shared_project = share_resp.json()
    assert shared_project["metadata"]["is_public"] is True
    assert shared_project["metadata"]["public_url_slug"] == "weekly-layout"

    gallery_resp = client.get("/api/public/projects")
    assert gallery_resp.status_code == 200
    gallery_payload = gallery_resp.json()
    assert gallery_payload["total"] == 1
    assert gallery_payload["projects"][0]["id"] == project_id

    definition_resp = client.get(f"/api/public/projects/{project_id}/definition")
    assert definition_resp.status_code == 200
    assert definition_resp.json()["id"] == project_id

    unshare_resp = client.post(
        f"/api/projects/{project_id}/share",
        headers=_auth_headers(token),
        json={"is_public": False, "url_slug": None},
    )
    assert unshare_resp.status_code == 200
    gallery_after = client.get("/api/public/projects")
    assert gallery_after.json()["total"] == 0


def test_clone_public_project_updates_clone_count(client: TestClient) -> None:
    token_owner = _register_and_login(client, "owner", "owner@example.com")
    create_resp = client.post(
        "/api/projects",
        headers=_auth_headers(token_owner),
        json={
            "name": "Monthly Layout",
            "description": "Monthly template",
            "device_profile": "boox-note-air-4c",
            "author": "",
            "category": "planner",
        },
    )
    project_id = create_resp.json()["id"]

    share_resp = client.post(
        f"/api/projects/{project_id}/share",
        headers=_auth_headers(token_owner),
        json={"is_public": True, "url_slug": "monthly-layout"},
    )
    assert share_resp.status_code == 200

    token_clone = _register_and_login(client, "cloner", "cloner@example.com")
    clone_resp = client.post(
        f"/api/projects/public/{project_id}/clone",
        headers=_auth_headers(token_clone),
        json={"new_name": "Cloned Monthly", "new_description": "Clone"},
    )
    assert clone_resp.status_code == 201
    cloned_id = clone_resp.json()["id"]
    assert cloned_id != project_id

    clone_list_resp = client.get("/api/projects", headers=_auth_headers(token_clone))
    assert len(clone_list_resp.json()) == 1

    gallery_resp = client.get(f"/api/public/projects/{project_id}")
    assert gallery_resp.status_code == 200
    assert gallery_resp.json()["clone_count"] == 1

    owner_project_resp = client.get(f"/api/projects/{project_id}", headers=_auth_headers(token_owner))
    assert owner_project_resp.status_code == 200
    assert owner_project_resp.json()["metadata"]["clone_count"] == 1

