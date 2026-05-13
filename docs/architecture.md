# Architecture

DevPilot AI follows a modular monorepo structure with a FastAPI backend, a Next.js frontend, and infrastructure services managed by Docker Compose.

The backend is organized around clean boundaries:

- `api`: HTTP routes and request/response integration.
- `core`: configuration, security helpers, and exception handling.
- `db`: database session and model base setup.
- `models`: SQLAlchemy models.
- `schemas`: Pydantic schemas.
- `services`: application services and use-case logic.
- `agents`: future custom agent orchestration.
- `workers`: future Celery worker setup and tasks.
- `utils`: shared utility functions.

The first implementation phase intentionally avoids business features. Authentication, workspace isolation, document ingestion, async processing, retrieval, generation, conversation storage, evaluation, and monitoring will be introduced incrementally.
