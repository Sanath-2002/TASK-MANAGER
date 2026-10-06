"""A small in-memory task API for learning and portfolio demonstrations."""

from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel, Field

app = FastAPI(title="DevOps Task API", version="1.0.0")


class TaskCreate(BaseModel):
    """Fields accepted when creating a task."""

    title: str = Field(min_length=1, max_length=100)
    done: bool = False


class Task(TaskCreate):
    """Task returned by the API."""

    id: int


_tasks: dict[int, Task] = {}
_next_id = 1


def reset_tasks() -> None:
    """Reset in-memory state; useful for isolated tests."""

    global _next_id
    _tasks.clear()
    _next_id = 1


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/tasks", response_model=list[Task])
def list_tasks() -> list[Task]:
    return list(_tasks.values())


@app.post("/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate) -> Task:
    global _next_id
    created = Task(id=_next_id, **task.model_dump())
    _tasks[_next_id] = created
    _next_id += 1
    return created


@app.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: int) -> Task:
    if task_id not in _tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _tasks[task_id]


@app.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: int, task: TaskCreate) -> Task:
    if task_id not in _tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    updated = Task(id=task_id, **task.model_dump())
    _tasks[task_id] = updated
    return updated


@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> Response:
    if task_id not in _tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    del _tasks[task_id]
    return Response(status_code=status.HTTP_204_NO_CONTENT)
