# DevPilot AI Phase 1-19 Validation Plan

This guide validates DevPilot AI as a live Agentic RAG system. It covers Docker,
FastAPI, PostgreSQL, Redis, Celery, Qdrant, Ollama embeddings, Gemini or Ollama
generation, JWT auth, workspace isolation, ingestion, retrieval, chat,
evaluation, agents, reranking, frontend pages, failure modes, and logs.

## Preconditions

Run from the repository root:

```bash
cd ~/Documents/PFAA/devpilot-ai
systemctl --user start devpilot-ollama.service
docker compose up -d postgres redis qdrant backend celery_worker frontend
docker compose ps
curl http://localhost:8000/health | jq
curl http://localhost:8000/api/v1/system/ai-config | jq
curl http://localhost:11434/api/tags | jq
```

Expected:
- `postgres` and `redis` are healthy.
- `qdrant`, `backend`, `celery_worker`, and `frontend` are running.
- `/health` returns `{"status":"ok","service":"DevPilot AI API"}`.
- `/api/v1/system/ai-config` returns provider/model configuration.
- `GEMINI_API_KEY`, `SECRET_KEY`, database passwords, and JWT values are not returned.
- Ollama lists `nomic-embed-text`.
- If `LLM_PROVIDER=ollama`, the configured generation model is present.
- If `LLM_PROVIDER=gemini`, Ollama is still available for embeddings.

Set common variables:

```bash
export BACKEND=http://localhost:8000
export API=http://localhost:8000/api/v1
export FRONTEND=http://localhost:3001
export EMAIL="phase-test-$(date +%s)@example.com"
export PASSWORD="devpilot-password-123"
```

## Phase 1 - Project Foundation And Docker Base

Objective: Docker Compose resolves and all services start.

```bash
docker compose config
docker compose up -d postgres redis qdrant backend celery_worker frontend
docker compose ps
docker compose logs backend --tail=100
docker compose logs celery_worker --tail=100
```

Expected:
- Compose has no YAML error.
- Backend is on host port `8000`.
- Frontend is on host port `3001`.
- Postgres uses host port `POSTGRES_HOST_PORT`, usually `5433` when local Postgres uses `5432`.
- Qdrant and Redis host ports match `.env`.
- Backend startup completes.
- Celery worker is ready.
- No database, Redis, Qdrant, or import failure appears.

Pass: all core containers run and logs are clean.

## Phase 2 - FastAPI Backend Health And Configuration

```bash
curl "$BACKEND/health" | jq
curl "$API/system/ai-config" | jq
docker compose logs backend --tail=100
```

Expected health:

```json
{
  "status": "ok",
  "service": "DevPilot AI API"
}
```

Expected AI config fields:
- `llm_provider`
- `embedding_provider`
- `generation_model`
- `embedding_model`
- `generation_temperature`
- `generation_max_tokens`
- `enable_reranking`
- `retrieval_candidates`
- `rerank_top_k`

Security expected:

```bash
curl -sS "$API/system/ai-config" | grep -Ei "GEMINI_API_KEY|SECRET_KEY|DATABASE_URL|Bearer|token"
```

Expected: no output.

Pass: health and config work and expose no secrets.

## Phase 3 - PostgreSQL Integration

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "\dt"
```

Expected tables include:
- `users`
- `workspaces`
- `workspace_members`
- `documents`
- `chunks`
- `conversations`
- `messages`
- `retrieved_chunks`
- `evaluations`
- `agent_runs`
- `llm_usage`

Counts:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select
  (select count(*) from users) as users,
  (select count(*) from workspaces) as workspaces,
  (select count(*) from documents) as documents,
  (select count(*) from chunks) as chunks,
  (select count(*) from conversations) as conversations,
  (select count(*) from messages) as messages,
  (select count(*) from retrieved_chunks) as retrieved_chunks,
  (select count(*) from evaluations) as evaluations,
  (select count(*) from agent_runs) as agent_runs;"
```

Expected: query succeeds and all counts are integers.

Pass: schema exists and backend health remains OK.

## Phase 4 - User Authentication With JWT

Register:

```bash
curl -i -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"full_name\":\"Phase 4 User\",\"password\":\"$PASSWORD\"}"
```

Expected: HTTP `201`, response has `id`, `email`, `full_name`, `role`, `is_active`,
and no password field.

Login:

```bash
export TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r .access_token)
test "${TOKEN#eyJ}" != "$TOKEN" && echo "token shape ok"
```

Expected: token starts with `eyJ`.

Auth me:

```bash
curl -sS "$API/auth/me" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: current user fields only, no password hash.

Negative tests:

```bash
curl -i "$API/auth/me" -H "Authorization: Bearer invalid_token"
curl -i "$API/auth/me"
curl -i -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"full_name\":\"Duplicate User\",\"password\":\"$PASSWORD\"}"
curl -i -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-password\"}"
```

Expected:
- Invalid token: HTTP `401`.
- Missing token: HTTP `401` or `403`.
- Duplicate register: HTTP `409` or clear validation error.
- Wrong password: HTTP `401`.

Database:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select id, email, full_name, role, is_active, created_at
from users
where email = '$EMAIL';"
```

Pass: auth works, rejects bad credentials, and never exposes passwords.

## Phase 5 - Workspace Management And Isolation

Create workspace:

```bash
export WORKSPACE_ID=$(curl -sS -X POST "$API/workspaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Phase 5 Workspace","description":"Testing workspace management"}' | jq -r .id)
echo "$WORKSPACE_ID"
```

Get and list:

```bash
curl -sS "$API/workspaces/$WORKSPACE_ID" -H "Authorization: Bearer $TOKEN" | jq
curl -sS "$API/workspaces" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: workspace is returned with owner membership.

Create second user:

```bash
export EMAIL_B="phase5-other-$(date +%s)@example.com"
curl -sS -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_B\",\"full_name\":\"Other User\",\"password\":\"$PASSWORD\"}" | jq
export TOKEN_B=$(curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\"}" | jq -r .access_token)
curl -i "$API/workspaces/$WORKSPACE_ID" -H "Authorization: Bearer $TOKEN_B"
```

Expected: HTTP `403` or `404`, no workspace data leaked.

SQL:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select w.id, w.name, wm.user_id, wm.role
from workspaces w
join workspace_members wm on wm.workspace_id = w.id
where w.id = '$WORKSPACE_ID'::uuid;"
```

Pass: user B cannot access user A workspace.

## Phase 6 - Document Upload API

```bash
cat > phase6_doc.txt <<'EOF'
DevPilot AI uses FastAPI, PostgreSQL, Redis, Celery, Qdrant, Ollama, hybrid retrieval, reranking, and evaluation.
EOF

export DOC_ID=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@phase6_doc.txt" | jq -r .id)
curl -sS "$API/documents/$DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: document UUID and status `queued`, `processing`, or `indexed`.

Negative tests:

```bash
echo "fake executable" > bad.exe
curl -i -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@bad.exe"
curl -i -X POST "$API/workspaces/$WORKSPACE_ID/documents" -F "file=@phase6_doc.txt"
curl -i -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN_B" \
  -F "file=@phase6_doc.txt"
```

Expected: invalid file is rejected, missing token is rejected, user B upload is rejected.

SQL:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select id, workspace_id, filename, file_type, file_size, status, storage_path, created_at
from documents
where id = '$DOC_ID'::uuid;"
```

Pass: metadata is persisted and storage path is safe.

## Phase 7 - Celery And Redis Async Processing

```bash
docker compose ps celery_worker
docker compose logs celery_worker --tail=200 | grep -E "ready|Task|Document|indexed|failed|ERROR|Traceback"
curl -sS "$API/documents/$DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: task is received, document becomes `indexed`, no unexpected traceback.

Failure mode:

```bash
docker compose stop celery_worker
cat > phase7_no_worker.txt <<'EOF'
This document is uploaded while worker is stopped.
EOF
export NO_WORKER_DOC_ID=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@phase7_no_worker.txt" | jq -r .id)
curl -sS "$API/documents/$NO_WORKER_DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
docker compose start celery_worker
sleep 15
curl -sS "$API/documents/$NO_WORKER_DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: queued while worker is stopped, then indexed after worker restart.

## Phase 8 - Text Extraction, Cleaning, And Chunking

```bash
cat > phase8_chunking.md <<'EOF'
# DevPilot AI Architecture

DevPilot AI is a multi-workspace RAG platform.

FastAPI exposes REST APIs for authentication, workspaces, documents, retrieval, and chat.
Celery processes uploaded documents in the background. Redis is the broker.
Qdrant stores embeddings for document chunks.
Hybrid retrieval combines semantic and keyword search.
Reranking reorders retrieved chunks before generation.
Evaluation measures answer quality.
EOF

export CHUNK_DOC_ID=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@phase8_chunking.md" | jq -r .id)
sleep 15
curl -sS "$API/documents/$CHUNK_DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
docker compose exec postgres psql -U devpilot -d devpilot -c "
select chunk_index, length(content) as length, left(content,120) as preview
from chunks
where document_id = '$CHUNK_DOC_ID'::uuid
order by chunk_index;"
docker compose exec postgres psql -U devpilot -d devpilot -c "
select chunk_index, metadata
from chunks
where document_id = '$CHUNK_DOC_ID'::uuid
order by chunk_index
limit 5;"
```

Expected: at least one clean chunk, chunk index starts at `0`, metadata exists.

## Phase 9 - Ollama Embeddings And Qdrant Indexing

```bash
curl http://localhost:11434/api/tags | jq
docker compose exec postgres psql -U devpilot -d devpilot -c "
select chunk_index, vector_id
from chunks
where document_id = '$DOC_ID'::uuid
order by chunk_index;"
curl http://localhost:6335/collections | jq
docker compose logs celery_worker --tail=300 | grep -E "embedding|Qdrant|indexed|failed|ERROR|Traceback"
```

Expected:
- `nomic-embed-text` exists in Ollama.
- All chunks have `vector_id`.
- Qdrant collection exists.
- Logs show indexing success.

Large PDF, if available:

```bash
export LARGE_PDF="/home/oussama/Downloads/DDIA_Python_Roadmap.pdf"
test -f "$LARGE_PDF" && export LARGE_DOC_ID=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${LARGE_PDF};type=application/pdf" | jq -r .id)
sleep 60
test -n "$LARGE_DOC_ID" && curl -sS "$API/documents/$LARGE_DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: large PDF eventually indexes or reports a clear failure reason.

## Phase 10 - Semantic Retrieval

```bash
curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/retrieval/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"How does the platform process documents in the background?","top_k":5,"strategy":"semantic"}' | jq

curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/retrieval/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"random unrelated quantum banana","top_k":5,"strategy":"semantic"}' | jq

curl -i -X POST "$API/workspaces/$WORKSPACE_ID/retrieval/search" \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"query":"test","top_k":5,"strategy":"semantic"}'
```

Expected:
- Relevant search returns chunks with content, score, filename, document_id, and chunk_id.
- Irrelevant search returns low-score results or empty list, not a server error.
- Invalid token returns HTTP `401`.

## Phase 11 - RAG Chat With Citations

```bash
export RESPONSE=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/chat/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What technologies does DevPilot AI use?"}')
echo "$RESPONSE" | jq '{answer,citations,message_id,conversation_id}'
export MESSAGE_ID=$(echo "$RESPONSE" | jq -r .message_id)
```

Expected: answer, citations, message_id, and conversation_id are present.

SQL:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select role, left(content,120) as preview
from messages
order by created_at desc
limit 5;"
docker compose exec postgres psql -U devpilot -d devpilot -c "
select message_id, retrieval_strategy, score, rank
from retrieved_chunks
where message_id = '$MESSAGE_ID'
order by rank;"
```

Expected: user and assistant messages are saved; retrieved chunks exist.

## Phase 12 - Answer Evaluation

```bash
echo "$RESPONSE" | jq '.evaluation'
curl -sS "$API/messages/$MESSAGE_ID/evaluation" -H "Authorization: Bearer $TOKEN" | jq
docker compose exec postgres psql -U devpilot -d devpilot -c "
select message_id, faithfulness, relevance, context_precision, hallucination_score, explanation
from evaluations
where message_id = '$MESSAGE_ID';"
```

Expected: evaluation fields are returned and exactly one DB row exists.

Unrelated question:

```bash
export BAD_RESPONSE=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/chat/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the CEO favorite food?"}')
echo "$BAD_RESPONSE" | jq '{answer,evaluation,message_id}'
```

Expected: answer does not invent a food and evaluation exists.

## Phase 13 - Agentic Workflow

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select agent_type, status, latency_ms
from agent_runs
where message_id = '$MESSAGE_ID'
order by created_at;"
docker compose exec postgres psql -U devpilot -d devpilot -c "
select agent_type, input, output
from agent_runs
where message_id = '$MESSAGE_ID'
order by created_at;"
```

Expected agents:
- `router`
- `query_rewriter`
- `retrieval`
- `reranker` when reranking is enabled
- `generator`
- `evaluator`
- `corrector`

Expected: status `completed`, latency tracked, no secrets in input/output.

## Phase 14 - Hybrid Retrieval

```bash
curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/retrieval/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"document processing system","top_k":5,"strategy":"semantic"}' | jq

curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/retrieval/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Celery Redis Qdrant","top_k":5,"strategy":"keyword"}' | jq

curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/retrieval/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"How does DevPilot use Qdrant and Celery?","top_k":5,"strategy":"hybrid"}' | jq
```

Expected:
- Semantic results have `retrieval_strategy=semantic`.
- Keyword results have `retrieval_strategy=keyword`.
- Hybrid results have `retrieval_strategy=hybrid`.
- Hybrid metadata includes `source_scores`.

Current note: chat strategy is agent-selected by `RouterAgent`. The backend
`ChatQueryRequest` currently does not expose a user-selected `retrieval_strategy`.

## Phase 15 - Reranking

```bash
cat > rerank_relevant.txt <<'EOF'
DevPilot AI uses Celery for asynchronous document processing.
Redis is used as the queue broker for background jobs.
Qdrant stores vector embeddings and enables semantic search over document chunks.
EOF

cat > rerank_irrelevant.txt <<'EOF'
This document talks about football, training schedules, match analysis, and player performance.
It does not explain DevPilot AI architecture or document processing.
EOF

export RELEVANT_DOC_ID=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@rerank_relevant.txt" | jq -r .id)
export IRRELEVANT_DOC_ID=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@rerank_irrelevant.txt" | jq -r .id)
sleep 20

export RERANK_RESPONSE=$(curl -sS -X POST "$API/workspaces/$WORKSPACE_ID/chat/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"How do Celery and Qdrant work in DevPilot AI?"}')
echo "$RERANK_RESPONSE" | jq '{answer,citations,evaluation,message_id}'
export RERANK_MESSAGE_ID=$(echo "$RERANK_RESPONSE" | jq -r .message_id)
docker compose exec postgres psql -U devpilot -d devpilot -c "
select agent_type, status, output
from agent_runs
where message_id = '$RERANK_MESSAGE_ID'
  and agent_type='reranker';"
```

Expected:
- Relevant citation appears before irrelevant citation when both are cited.
- Reranker agent completed.
- Reranker output includes scores/features.
- Final answer is not replaced by an insufficient-context answer when relevant citations exist.

Bug detector: if answer says information was not found while citations contain
`rerank_relevant.txt`, investigate `CorrectorAgent`.

## Phase 16 - Frontend Shell And Backend Connectivity

```bash
curl -i "$FRONTEND" | sed -n '1,30p'
curl -i -H "Origin: $FRONTEND" "$BACKEND/health" | sed -n '1,30p'
docker compose logs backend --tail=200 | grep -E "health|OPTIONS"
```

Browser:
- Open `http://localhost:3001`.
- Open `http://localhost:3001/dashboard`.
- Open DevTools Network and confirm `GET /health` returns `200`.
- Console should have no CORS error.

Pass: frontend shell loads and API status works.

## Phase 17 - Frontend Auth Integration

Browser:
1. Open `http://localhost:3001/register`.
2. Register `phase17-ui-<timestamp>@example.com` with password `devpilot-password-123`.
3. Open `http://localhost:3001/login`.
4. Log in.
5. Confirm redirect to dashboard.
6. In console:

```js
localStorage.getItem("devpilot_access_token")
```

Expected: non-null JWT. Do not print it in screenshots or logs.

Protected route checks:

```text
http://localhost:3001/dashboard
http://localhost:3001/documents
http://localhost:3001/chat
http://localhost:3001/settings
```

Expected: protected pages redirect to `/login` when token is missing or invalid.

```js
localStorage.removeItem("devpilot_access_token")
window.location.href = "/dashboard"
```

Expected: redirect to `/login`.

Logs:

```bash
docker compose logs backend --tail=300 | grep -E "auth/register|auth/login|auth/me"
```

## Phase 18 - Documents UI Integration

Current implementation note: `/documents` is currently a placeholder. The
functional documents UI lives at `/workspaces/{workspaceId}/documents`.

Browser:
1. Log in.
2. Open dashboard.
3. Open an existing workspace.
4. Open the workspace documents page.
5. Upload `phase6_doc.txt`.
6. Upload a valid PDF if available.
7. Upload `bad.exe`.

Expected:
- Valid uploads appear in document list.
- Status changes from queued/processing to indexed.
- Invalid file shows a clear error.
- No stale error remains after a later success.

Logs:

```bash
docker compose logs backend --tail=300 | grep -E "documents|POST|GET"
docker compose logs celery_worker --tail=300 | grep -E "Document|chunk|embedding|indexed|failed|ERROR|Traceback"
```

SQL:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select filename, file_type, status, created_at
from documents
order by created_at desc
limit 10;"
```

## Phase 19 - Chat UI With Citations And Evaluation

Current implementation notes:
- `/chat` is currently a placeholder.
- Functional chat UI lives at `/workspaces/{workspaceId}/chat`.
- The backend chat request currently does not accept `retrieval_strategy`; the
agent router selects the strategy.

Browser:
1. Log in.
2. Open a workspace with indexed documents.
3. Open `/workspaces/{workspaceId}/chat`.
4. Ask: `What technologies does DevPilot AI use?`
5. Ask: `How does the platform process documents in the background?`
6. Ask: `Celery Redis Qdrant`
7. Ask: `How does DevPilot use Qdrant and Celery?`
8. Ask: `What is the CEO favorite food?`

Expected:
- Assistant answer appears.
- Citations appear.
- Evaluation metrics appear.
- No hallucination for unrelated question.
- Send button disables while loading.
- No duplicate requests on fast repeated clicks.
- Missing or invalid token redirects to `/login`.

Backend verification:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select id, left(content,120) as preview, created_at
from messages
where role='assistant'
order by created_at desc
limit 1;"

export MESSAGE_ID="<latest assistant message id>"
curl -sS "$API/messages/$MESSAGE_ID/evaluation" -H "Authorization: Bearer $TOKEN" | jq

docker compose exec postgres psql -U devpilot -d devpilot -c "
select retrieval_strategy, score, rank
from retrieved_chunks
where message_id = '$MESSAGE_ID'
order by rank;"

docker compose exec postgres psql -U devpilot -d devpilot -c "
select agent_type, status, latency_ms
from agent_runs
where message_id = '$MESSAGE_ID'
order by created_at;"
```

Expected: retrieved chunks, evaluation, and agent runs are saved.

## Final End-To-End Scenario

1. Start services.
2. Register a new user from frontend.
3. Login from frontend.
4. Open dashboard and verify API status OK.
5. Create or open a workspace.
6. Upload a TXT document from workspace documents UI.
7. Wait until status is indexed.
8. Open workspace chat.
9. Ask: `What technologies does DevPilot AI use?`
10. Verify answer, citations, evaluation.
11. Ask: `How does DevPilot use Qdrant and Celery?`
12. Verify answer, citations, evaluation.
13. Ask: `What is the CEO favorite food?`
14. Verify no hallucination.
15. Open settings.
16. Verify user, API status, AI config, workspace, frontend runtime, auth debug, and logout.
17. Logout.
18. Verify protected pages redirect to login.

Expected:
- No CORS errors.
- No frontend crash.
- No backend 500.
- Database traces saved.

## Final Database Summary

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select
  (select count(*) from users) as users,
  (select count(*) from workspaces) as workspaces,
  (select count(*) from documents) as documents,
  (select count(*) from chunks) as chunks,
  (select count(*) from conversations) as conversations,
  (select count(*) from messages) as messages,
  (select count(*) from retrieved_chunks) as retrieved_chunks,
  (select count(*) from evaluations) as evaluations,
  (select count(*) from agent_runs) as agent_runs;"
```

Expected after full E2E: all counts are greater than zero.

## Final Backend Log Check

```bash
docker compose logs backend --tail=1000 | \
  grep -E "auth/register|auth/login|auth/me|workspaces|documents|retrieval/search|chat/query|evaluation|ai-config|health"
```

Expected:
- Register `201`.
- Login `200`.
- Auth me `200`.
- Workspaces `200/201`.
- Documents `201`.
- Retrieval search `200`.
- Chat query `200`.
- Evaluation `200`.
- AI config `200`.
- Health `200`.
- No repeated `500`.

## Final Celery Log Check

```bash
docker compose logs celery_worker --tail=1000 | \
  grep -E "Document text extracted|Document chunks saved|embedding|Document chunk vectors indexed|status=indexed|status=failed|Traceback|ERROR"
```

Expected:
- Extraction succeeded.
- Chunks saved.
- Embedding batches ran.
- Qdrant indexing succeeded.
- No unexpected traceback.

## Security Acceptance Checklist

Pass only if:
- Invalid token returns `401`.
- Missing token returns `401` or `403`.
- User B cannot access user A workspace.
- User B cannot upload to user A workspace.
- User B cannot search/chat in user A workspace.
- User B cannot access user A evaluation.
- Frontend does not display JWT token values.
- Frontend does not display `GEMINI_API_KEY`.
- Backend `/ai-config` does not return API keys or secrets.
- `.env` is ignored by Git.
- No secrets appear in backend/frontend/Celery logs.

## Automated Test Commands

Fast backend unit tests:

```bash
make backend-install-dev
make test-backend
```

Live integration smoke tests, no ingestion or generation:

```bash
make test-integration
```

Live ingestion, Celery, Ollama embedding, and Qdrant tests:

```bash
DEVPILOT_RUN_INGESTION=1 make test-ingestion
```

Live RAG, evaluation, agents, and reranking tests:

```bash
DEVPILOT_RUN_INGESTION=1 DEVPILOT_RUN_RAG=1 make test-rag
```

Coverage:

```bash
make test-cov
```

Direct pytest:

```bash
python -m pytest tests/integration -m "not ingestion and not rag"
DEVPILOT_RUN_INGESTION=1 python -m pytest tests/integration -m "ingestion and not rag"
DEVPILOT_RUN_INGESTION=1 DEVPILOT_RUN_RAG=1 python -m pytest tests/integration -m "rag"
```

## Debugging Failures

Backend unreachable:

```bash
docker compose ps
curl -i http://localhost:8000/health
docker compose logs backend --tail=200
```

Login says backend unreachable:

```bash
curl -i -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  -X POST "$API/auth/login" \
  -d '{"email":"missing@example.com","password":"bad"}'
docker compose ps postgres
docker compose logs backend --tail=200 | grep -E "auth/login|postgres|500|Traceback"
```

Document stuck queued:

```bash
docker compose ps celery_worker redis
docker compose logs celery_worker --tail=300
docker compose logs redis --tail=100
```

Document failed:

```bash
curl -sS "$API/documents/$DOC_ID/status" -H "Authorization: Bearer $TOKEN" | jq
docker compose logs celery_worker --tail=500 | grep -E "failed|ERROR|Traceback|Ollama|Qdrant"
curl http://localhost:11434/api/tags | jq
curl http://localhost:6335/collections | jq
```

Retrieval empty:

```bash
docker compose exec postgres psql -U devpilot -d devpilot -c "
select d.filename, d.status, count(c.id) chunks, count(c.vector_id) vectors
from documents d
left join chunks c on c.document_id = d.id
group by d.filename, d.status
order by d.filename;"
```

Chat failure:

```bash
curl -sS "$API/system/ai-config" | jq
docker compose logs backend --tail=300 | grep -E "chat/query|Gemini|Ollama|LLM|ERROR|Traceback"
```

CORS failure:

```bash
curl -i -X OPTIONS "$API/auth/login" \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
docker compose exec backend printenv BACKEND_CORS_ORIGINS FRONTEND_URL
```

## Current Readiness Notes

Fully automatable now:
- Phase 1 through Phase 6.
- Phase 16 and Phase 17 smoke checks.
- Security isolation for auth/workspaces/documents/retrieval/chat access.

Automatable when live dependencies are available:
- Phase 7 through Phase 15 with `DEVPILOT_RUN_INGESTION=1` and
  `DEVPILOT_RUN_RAG=1`.

Known current gaps to fix before claiming full Phase 18/19 completion:
- `/documents` route is a placeholder.
- `/chat` route is a placeholder.
- Backend chat request schema does not expose `retrieval_strategy`, so a frontend
  strategy selector cannot control chat strategy yet.

Suggested current readiness score: `82/100`.

Reasoning:
- Backend foundations, auth, workspaces, system config, ingestion pipeline, retrieval,
  agent workflow, evaluation, and settings page are substantially testable.
- Full score is blocked by top-level `/documents` and `/chat` placeholders and by
  missing explicit chat strategy selection support.
