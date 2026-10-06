"""Endpoint tests with fresh in-memory state for every test."""

import pytest
from fastapi.testclient import TestClient

from app.main import app, reset_tasks

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_tasks():
    reset_tasks()
    yield
    reset_tasks()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_home_page_serves_task_manager():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Taskboard" in response.text


def test_create_and_list_tasks():
    created = client.post("/tasks", json={"title": "Learn Docker"})
    assert created.status_code == 201
    assert created.json() == {"id": 1, "title": "Learn Docker", "done": False}
    assert client.get("/tasks").json() == [created.json()]


def test_get_task():
    task_id = client.post("/tasks", json={"title": "Read docs"}).json()["id"]
    response = client.get(f"/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Read docs"


def test_update_task():
    task_id = client.post("/tasks", json={"title": "Old title"}).json()["id"]
    response = client.put(f"/tasks/{task_id}", json={"title": "New title", "done": True})
    assert response.status_code == 200
    assert response.json() == {"id": task_id, "title": "New title", "done": True}


def test_delete_task():
    task_id = client.post("/tasks", json={"title": "Temporary"}).json()["id"]
    assert client.delete(f"/tasks/{task_id}").status_code == 204
    assert client.get(f"/tasks/{task_id}").status_code == 404


@pytest.mark.parametrize("method,path,payload", [
    ("get", "/tasks/999", None),
    ("put", "/tasks/999", {"title": "Missing"}),
    ("delete", "/tasks/999", None),
])
def test_missing_task_returns_404(method, path, payload):
    response = getattr(client, method)(path, json=payload) if payload else getattr(client, method)(path)
    assert response.status_code == 404


def test_title_validation():
    assert client.post("/tasks", json={"title": ""}).status_code == 422
    assert client.post("/tasks", json={"title": "x" * 101}).status_code == 422
