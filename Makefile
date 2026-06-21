.PHONY: help up down logs build backend-install-dev test test-backend test-integration test-ingestion test-rag test-cov backend-test backend-dev frontend-dev frontend-install migrate revision

POSTGRES_USER ?= devpilot
POSTGRES_PASSWORD ?= devpilot
POSTGRES_DB ?= devpilot
POSTGRES_PORT ?= 5432
LOCAL_DATABASE_URL ?= postgresql+asyncpg://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(POSTGRES_PORT)/$(POSTGRES_DB)

help:
	@echo "DevPilot AI commands"
	@echo "  make up                Start all Docker Compose services"
	@echo "  make down              Stop Docker Compose services"
	@echo "  make logs              Follow Docker Compose logs"
	@echo "  make build             Build Docker Compose services"
	@echo "  make backend-install-dev  Install backend package with dev test dependencies"
	@echo "  make test              Run backend unit tests and live integration smoke tests"
	@echo "  make test-backend      Run backend tests locally"
	@echo "  make test-integration  Run live-stack integration tests that do not require ingestion/RAG"
	@echo "  make test-ingestion    Run live-stack document ingestion, Ollama, and Qdrant tests"
	@echo "  make test-rag          Run live-stack RAG, evaluation, agents, and reranking tests"
	@echo "  make test-cov          Run backend tests with coverage"
	@echo "  make backend-test      Run backend tests locally"
	@echo "  make backend-dev       Run backend locally"
	@echo "  make frontend-install  Install frontend dependencies"
	@echo "  make frontend-dev      Run frontend locally"
	@echo "  make migrate           Apply Alembic migrations"
	@echo "  make revision message=\"...\"  Create an Alembic autogenerate revision"

up:
	docker compose up

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

backend-install-dev:
	cd backend && python -m pip install -e ".[dev]"

test: test-backend test-integration

test-backend:
	cd backend && pytest

test-integration:
	python -m pytest tests/integration -m "not ingestion and not rag"

test-ingestion:
	DEVPILOT_RUN_INGESTION=1 python -m pytest tests/integration -m "ingestion and not rag"

test-rag:
	DEVPILOT_RUN_INGESTION=1 DEVPILOT_RUN_RAG=1 python -m pytest tests/integration -m "rag"

test-cov:
	cd backend && pytest --cov=app --cov-report=term-missing

backend-test:
	cd backend && pytest

backend-dev:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

migrate:
	cd backend && if [ -x .venv/bin/alembic ]; then ALEMBIC=.venv/bin/alembic; else ALEMBIC=alembic; fi; DATABASE_URL="$(LOCAL_DATABASE_URL)" $$ALEMBIC upgrade head

revision:
	@test -n "$(message)" || (echo 'Usage: make revision message="describe change"' && exit 1)
	cd backend && if [ -x .venv/bin/alembic ]; then ALEMBIC=.venv/bin/alembic; else ALEMBIC=alembic; fi; DATABASE_URL="$(LOCAL_DATABASE_URL)" $$ALEMBIC revision --autogenerate -m "$(message)"
