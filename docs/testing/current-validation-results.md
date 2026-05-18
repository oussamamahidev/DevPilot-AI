# Current Validation Results

Date: 2026-05-15

Environment:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3001`
- API base: `http://localhost:8000/api/v1`
- Token storage key: `devpilot_access_token`
- Ollama models observed: `qwen3:8b`, `nomic-embed-text:latest`, `qwen2.5:3b-instruct-q3_K_S`

## Commands Run

Live smoke integration:

```bash
python -m pytest tests/integration -m "not ingestion and not rag"
```

Result:

```text
19 passed, 10 deselected, 3 xfailed in 12.76s
```

The expected xfails document current gaps:
- `/documents` is a placeholder.
- `/chat` is a placeholder.
- `ChatQueryRequest` does not expose `retrieval_strategy`.

Live ingestion and retrieval:

```bash
DEVPILOT_RUN_INGESTION=1 python -m pytest tests/integration -m "ingestion and not rag"
```

Result:

```text
7 passed, 25 deselected in 18.61s
```

Live RAG, evaluation, agents, and reranking:

```bash
DEVPILOT_RUN_INGESTION=1 DEVPILOT_RUN_RAG=1 python -m pytest tests/integration -m "rag"
```

Result:

```text
3 passed, 29 deselected in 134.15s
```

Syntax check for new tests:

```bash
python -m compileall -q tests/integration
```

Result: passed.

Backend unit test attempt:

```bash
make test-backend
```

Result: failed during collection because the host Python environment does not have
backend dependencies installed, including `python-jose` and `qdrant-client`.

Fix:

```bash
make backend-install-dev
make test-backend
```

## Validated Phases

Validated by passing live integration tests:
- Phase 1: Docker Compose config and running service checks.
- Phase 2: health and safe AI config.
- Phase 3: PostgreSQL schema and count query.
- Phase 4: register, login, auth/me, duplicate, wrong password, missing/invalid token.
- Phase 5: workspace creation, listing, owner membership, isolation.
- Phase 6: document upload API, metadata persistence, invalid file, auth errors.
- Phase 7: Celery document processing.
- Phase 8: text cleaning, chunking, metadata.
- Phase 9: Ollama embeddings and Qdrant indexing.
- Phase 10: semantic retrieval and auth enforcement.
- Phase 11: RAG chat with citations.
- Phase 12: answer evaluation returned and persisted.
- Phase 13: agent runs persisted.
- Phase 14: semantic, keyword, and hybrid retrieval.
- Phase 15: reranking prefers relevant context.
- Phase 16: frontend shell and CORS smoke checks.
- Phase 17: frontend login/register route smoke checks plus backend auth integration.
- Security: user B cannot access user A workspace, documents, retrieval, or chat.

Partially validated or blocked:
- Phase 18: backend document workflow passes; top-level `/documents` is still a placeholder.
- Phase 19: backend chat workflow passes; top-level `/chat` is still a placeholder and explicit chat strategy selection is not exposed by the API.

## Current Fix List

1. Replace `/documents` placeholder with the workspace-aware documents experience or redirect users to a selected workspace documents route.
2. Replace `/chat` placeholder with a workspace selection flow or redirect to a selected workspace chat route.
3. Add `retrieval_strategy` to backend `ChatQueryRequest`, pass it through `query_chat`, and expose strategy selection in the chat UI.
4. Install backend dev dependencies before running local backend unit tests.

## Readiness Score

Current readiness: `86/100`.

Rationale:
- Live backend, DB, queue, worker, embeddings, Qdrant, retrieval, RAG, evaluation, agents, reranking, auth, workspace isolation, settings, and CORS checks pass.
- The remaining blockers are frontend route completeness for `/documents` and `/chat`, explicit chat strategy selection, and host dev dependency setup for local backend unit tests.
