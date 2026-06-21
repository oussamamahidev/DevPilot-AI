# 05 — API Specification

This chapter specifies the REST and streaming API exposed by the DevPilot AI
backend (FastAPI). All routes are mounted under the common prefix **`/api/v1`**.
Authentication uses JWT bearer tokens passed in the `Authorization: Bearer <token>`
header. Administrative domains (`/admin`, `/admin/ragops`, `/admin/rag-traces`)
require the caller to hold the `admin` role.

> Base URL: `/api/v1`
> Auth header (where required): `Authorization: Bearer <JWT>`

---

## 1. Auth — `/auth`

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/auth/register` | None | `{ email, password, full_name }` | Created user profile |
| POST | `/auth/login` | None | `{ email, password }` | `{ access_token (JWT), token_type }` |
| GET | `/auth/me` | Bearer JWT | — | Current authenticated user profile |

---

## 2. Workspaces — `/workspaces`

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | `/workspaces` | Bearer JWT | — | List of workspaces owned by / shared with the caller |
| POST | `/workspaces` | Bearer JWT | `{ name, description? }` | Created workspace |
| GET | `/workspaces/{id}` | Bearer JWT | — | Single workspace detail |
| PATCH | `/workspaces/{id}` | Bearer JWT (owner) | `{ name?, description? }` | Updated workspace |
| DELETE | `/workspaces/{id}` | Bearer JWT (owner) | — | Deletion confirmation |

---

## 3. Documents

Documents are uploaded and listed under a workspace; individual document
operations use a top-level `/documents` path.

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/workspaces/{workspace_id}/documents` | Bearer JWT | `multipart/form-data` (file) | Created document (status `queued`) |
| GET | `/workspaces/{workspace_id}/documents` | Bearer JWT | — | List of documents in the workspace |
| GET | `/documents/{id}` | Bearer JWT | — | Document detail |
| DELETE | `/documents/{id}` | Bearer JWT | — | Deletion confirmation |
| GET | `/documents/{id}/status` | Bearer JWT | — | Ingestion status (`queued`/`processing`/`indexed`/`failed`/`deleted`) |
| GET | `/documents/{id}/chunks` | Bearer JWT | — | List of chunks produced for the document |

---

## 4. Chat / Streaming

The chat endpoint streams responses over **Server-Sent Events** (SSE,
`text/event-stream`). The stream uses a **Bearer JWT in the `Authorization`
header**. Conversation and message resources are read through dedicated GET
routes.

### 4.1 Streaming chat

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | `/workspaces/{workspace_id}/chat/stream` | Bearer JWT | `{ query, conversation_id? }` | SSE stream (`text/event-stream`) |

**SSE event types (in flow order):**

| Event | Meaning |
|-------|---------|
| `start` | Stream opened; processing begun |
| `trace` | Per-agent trace updates from the pipeline |
| `token` | Incremental answer tokens (streamed generation) |
| `citations` | Source citations / retrieved references |
| `evaluation` | Quality evaluation scores for the answer |
| `correction` | Self-correction applied to the answer |
| `message` | Final persisted assistant message |
| `done` | Stream completed successfully |
| `error` | Error during processing |

### 4.2 Conversations & message evaluation

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | `/workspaces/{workspace_id}/chat/conversations` | Bearer JWT | — | List of conversations |
| GET | `/workspaces/{workspace_id}/chat/conversations/{id}` | Bearer JWT | — | Conversation with messages |
| GET | `/workspaces/{workspace_id}/chat/messages/{message_id}/evaluation` | Bearer JWT | — | Evaluation record for a message |

---

## 5. System — `/system`

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | `/system/ai-config` | Bearer JWT | — | Active AI configuration (models, strategies) |
| GET | `/system/ai-health` | Bearer JWT | — | Health of AI providers/services |

---

## 6. Health

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| GET | `/health` | None | — | Liveness/readiness status |

---

## 7. Admin — `/admin` (admin role)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/stats` | Admin | Global platform statistics |
| GET | `/admin/usage/stats` | Admin | LLM usage / token statistics |
| GET | `/admin/rag/stats` | Admin | RAG pipeline statistics |
| GET | `/admin/errors` | Admin | Recent system errors |
| GET | `/admin/audit-logs` | Admin | Audit log entries |
| GET | `/admin/documents` | Admin | All documents across workspaces |
| GET | `/admin/documents/stats` | Admin | Document ingestion statistics |
| GET | `/admin/users` | Admin | List all users |
| GET | `/admin/users/{id}` | Admin | User detail |
| PATCH | `/admin/users/{id}/role` | Admin | Change a user's role |
| PATCH | `/admin/users/{id}/deactivate` | Admin | Deactivate a user |
| PATCH | `/admin/users/{id}/reactivate` | Admin | Reactivate a user |
| DELETE | `/admin/users/{id}` | Admin | Delete a user |

---

## 8. RAGOps — `/admin/ragops` (admin role)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/ragops/workspaces` | Admin | RAG-operational view of workspaces |
| GET | `/admin/ragops/workspaces/{id}` | Admin | RAGOps detail for a workspace |
| GET | `/admin/ragops/qdrant/health` | Admin | Qdrant vector store health |
| GET | `/admin/ragops/ops-health` | Admin | Overall RAG operations health |
| GET | `/admin/ragops/vector-health` | Admin | Vector indexing health |
| GET | `/admin/ragops/documents/{id}/pipeline` | Admin | Ingestion pipeline state for a document |
| POST | `/admin/ragops/documents/{id}/retry` | Admin | Retry a failed document ingestion |

---

## 9. RAG Traces — `/admin/rag-traces` (admin role)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/rag-traces` | Admin | List traces (paginated, filterable) |
| GET | `/admin/rag-traces/{message_id}` | Admin | Full trace for a message |
| GET | `/admin/rag-traces/{message_id}/retrieval` | Admin | Retrieval stage detail |
| GET | `/admin/rag-traces/{message_id}/reranking` | Admin | Reranking stage detail |
| GET | `/admin/rag-traces/{message_id}/evaluation` | Admin | Evaluation stage detail |
| GET | `/admin/rag-traces/quality/summary` | Admin | Aggregate quality summary |

**Filters / query parameters for `GET /admin/rag-traces`:**

`search`, `workspace_id`, `retrieval_strategy`, `min_faithfulness`,
`max_hallucination_score`, `has_citations`, `corrected`, `date_from`,
`date_to`, `page`, `page_size`.

---

## 10. Access-Control Summary

| Domain | Required role |
|--------|---------------|
| `/auth/register`, `/auth/login`, `/health` | Public |
| `/auth/me`, `/workspaces`, `/documents`, `/chat`, `/system` | Authenticated (Bearer JWT) |
| `/admin/**` | `admin` |
| `/admin/ragops/**` | `admin` |
| `/admin/rag-traces/**` | `admin` |
