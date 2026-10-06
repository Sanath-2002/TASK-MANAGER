.PHONY: install test run docker-build docker-run lint

install:
	python -m pip install -r requirements.txt

test:
	python -m pytest -q

run:
	python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

docker-build:
	docker build -t devops-task-api:local .

docker-run:
	docker compose up --build

lint:
	python -m ruff check app tests
