# DevPilot AI — Technical Report & Reproduction Guide

> A production-grade, self-hosted **Agentic RAG platform** with built-in observability, traceability, evaluation and governance.
> This document is an engineering report **and** a from-zero build guide. Anyone — junior developer, new engineer, recruiter, jury, or open-source contributor — should be able to understand *and rebuild* the system from this file alone.

**Version:** 0.1.0 · **Audience:** developers, engineers, jury, contributors · **Status:** reproducible

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [System Overview](#2-system-overview)
3. [Architecture Diagram & Explanation](#3-architecture-diagram--explanation)
4. [Technology Stack](#4-technology-stack)
5. [Core Concepts (with video resources)](#5-core-concepts-explained)
6. [Module Breakdown](#6-module-breakdown)
7. [Implementation Details (code-level)](#7-implementation-details-code-level)
8. [Data Flow](#8-data-flow)
9. [API Design](#9-api-design)
10. [Database Design (ERD)](#10-database-design-erd)
11. [Security & Governance](#11-security--governance)
12. [Observability](#12-observability)
13. [Testing Strategy](#13-testing-strategy)
14. [Step-by-Step Deployment Guide (zero → running)](#14-step-by-step-deployment-guide)
15. [Reproduce From Scratch (greenfield build order)](#15-reproduce-from-scratch)
16. [Configuration Reference](#16-configuration-reference)
17. [Conclusion](#17-conclusion)
18. [Appendix: Learning Resources](#18-appendix--learning-resources)

---

## 1. Abstract

**DevPilot AI** turns the most common AI project — a document chatbot — into a *production AI platform*. A generic chatbot answers from the model's parametric memory: no sources, no audit trail, no way to know *why* an answer was produced or whether it is correct. DevPilot solves this by combining four things rarely shipped together:

1. **Agentic Retrieval-Augmented Generation (RAG)** — a 7-agent pipeline (router → rewriter → retrieval → reranker → generator → evaluator → corrector) that grounds every answer in the user's own documents and **refuses rather than hallucinates** when confidence is low.
2. **Observability (RAGOps)** — a live "control tower" that measures ingestion, embedding coverage, retrieval latency, and AI-quality metrics (faithfulness, hallucination).
3. **Traceability** — every answer is persisted as a structured, queryable execution trace and can be *replayed* months later (which chunks, which scores, which agent decisions).
4. **Governance** — JWT auth, multi-tenant workspace isolation, role-based access, and an audit log.

The platform is **self-hosted**: LLM inference runs locally via Ollama (`qwen3:8b` / `nomic-embed-text`), with a cloud provider (Gemini) behind the same interface for benchmarking. Backend is **FastAPI + Celery + PostgreSQL + Qdrant + Redis**; frontend is **Next.js 15 + React 19**. The full system runs with a single `docker compose up`.

---

## 2. System Overview

DevPilot is a **modular monolith API + async worker tier**, not microservices. This is deliberate: it gives clean module boundaries without distributed-systems overhead for a single-team project.

| Capability | What it does |
|---|---|
| **Knowledge management** | Upload PDF/TXT/Markdown into isolated *workspaces*; documents are extracted, chunked, embedded and indexed. |
| **Agentic RAG** | Answers questions grounded in workspace documents, with enforced citations. |
| **Streaming** | The *entire pipeline* (agent traces, tokens, citations, evaluation) streams to the client over SSE. |
| **Evaluation** | Every answer is scored on faithfulness, relevance, context precision, and hallucination. |
| **Observability (RAGOps)** | Aggregate health/quality dashboards across ingestion, retrieval, embeddings, agents, failures. |
| **Traceability** | Per-message forensic replay: retrieved chunks, reranking deltas, citations, agent runs, evaluation. |
| **Governance** | JWT auth, workspace isolation (app layer + Qdrant payload filter), RBAC, audit log. |

**Two request lifecycles** define the system:
- **Ingestion** (async, off-request): `upload → Celery → extract → clean → chunk → embed → index`.
- **Query** (real-time, streamed): `question → 7 agents → grounded, scored, cited answer → persisted trace`.

---

## 3. Architecture Diagram & Explanation

### 3.1 Layered architecture

```mermaid
flowchart TB
  subgraph Client["① Client — Next.js 15 / React 19"]
    UI[Chat · AI Studio · RAGOps · Trace Explorer · Architecture Map]
  end
  subgraph Gateway["② Gateway — FastAPI (REST + SSE)"]
    MW[JWT middleware · request-ID · Prometheus]
  end
  subgraph Sec["③ Security"]
    AUTH[JWT / RBAC] --- ISO[Workspace isolation] --- AUD[Audit log]
  end
  subgraph Data["④ Data & Ingestion"]
    CEL[Celery workers] --- PG[(PostgreSQL 16)] --- QD[(Qdrant)] --- RD[(Redis)]
  end
  subgraph Orch["⑤ Orchestration — Agentic RAG"]
    A1[Router]-->A2[Rewriter]-->A3[Retrieval]-->A4[Reranker]-->A5[Generator]-->A6[Evaluator]-->A7[Corrector]
  end
  subgraph AI["⑥ AI / Inference"]
    OLL[Ollama qwen3:8b] --- EMB[nomic-embed-text 768-d] --- GEM[Gemini 2.5 fallback]
  end
  subgraph Obs["⑦ Observability"]
    TR[Trace engine] --- EV[Evaluation store] --- PRM[Prometheus + Grafana] --- RO[RAGOps API]
  end

  Client --> Gateway --> Sec --> Orch
  Orch --> Data
  Orch --> AI
  Orch -. emits traces/metrics .-> Obs
  Data -. metrics .-> Obs
```

**Why this shape:**
- **Observability is a peer layer**, not an afterthought. Every agent emits a trace + metric as it runs.
- **Orchestration is separate from inference** so the LLM provider is swappable (Ollama ↔ Gemini ↔ OpenAI) via a single config change — both implement the same provider interface.
- **Ingestion is async** (Celery + Redis) because embedding a large PDF takes seconds-to-minutes and must never block the API.

### 3.2 Physical topology (Docker Compose)

```mermaid
flowchart LR
  FE[frontend :3000] --> BE[backend :8000]
  BE --> PG[(postgres :5432)]
  BE --> RD[(redis :6379)]
  BE --> QD[(qdrant :6333)]
  CW[celery_worker] --> PG
  CW --> RD
  CW --> QD
  BE -- host.docker.internal:11434 --> OL[Ollama on host]
  CW --> OL
  PROM[prometheus :9090] --> BE
  GRAF[grafana :3002] --> PROM
```

> **Note:** Ollama runs **on the host**, not in a container, and is reached via `host.docker.internal:11434`. Host ports are remapped (e.g. Redis host `6380`→container `6379`, Qdrant host `6335`→`6333`) to avoid local collisions — see [§16](#16-configuration-reference).

---

## 4. Technology Stack

| Layer | Technology | Version | Why |
|---|---|---|---|
| **Backend framework** | FastAPI | ≥0.115 | Async-first, automatic OpenAPI, native SSE via `StreamingResponse`. |
| **Language** | Python | ≥3.11 | Async/await, modern typing. |
| **ORM / DB driver** | SQLAlchemy 2.0 (async) + asyncpg | ≥2.0.36 | Async ORM with typed models. |
| **Migrations** | Alembic | ≥1.14 | Versioned, autogenerated schema migrations. |
| **Task queue** | Celery | ≥5.4 | Off-request ingestion; scales by adding workers. |
| **Broker / cache** | Redis | 7-alpine | Celery broker + result backend. |
| **Relational DB** | PostgreSQL | 16-alpine | Documents, chunks, conversations, **traces**. |
| **Vector DB** | Qdrant | v1.12.6 | HNSW + cosine ANN search, payload filtering per workspace. |
| **Local LLM runtime** | Ollama | — | On-prem generation (`qwen3:8b`) + embeddings (`nomic-embed-text`). |
| **Cloud LLM (fallback)** | Google Gemini | 2.5-flash | Benchmark/fallback behind same interface. |
| **Tokenization** | tiktoken | ≥0.8 | `cl100k_base` token counting for chunking. |
| **PDF parsing** | pypdf | ≥5.1 | Text extraction. |
| **Auth** | python-jose + passlib[bcrypt] | — | JWT (HS256), bcrypt password hashing. |
| **Frontend** | Next.js (App Router) + React | 15 / 19 | Server components, feature-sliced UI. |
| **Server state** | TanStack React Query | v5 | Caching, parallel fetches, background refetch. |
| **Styling / viz** | Tailwind 3.4 · Framer Motion · Recharts · XYFlow | — | Design system, animation, charts, node graph. |
| **Metrics** | prometheus-client + Grafana | — | Infra + AI metrics. |
| **Tests** | pytest / pytest-asyncio · Vitest | — | Backend + frontend. |
| **Lint** | Ruff · ESLint | — | line-length 100, py311 target. |

---

## 5. Core Concepts Explained

> Each concept lists **what it is**, **how DevPilot uses it**, and a **learning resource**. Video links point to reputable channels/canonical talks; treat them as *searchable references* and verify the exact upload before relying on it.

### 5.1 Retrieval-Augmented Generation (RAG)
**What:** Instead of answering from the model's memory, you *retrieve* relevant text chunks from a knowledge base and put them in the prompt so the model answers from grounded sources.
**Here:** documents → chunks → embeddings → Qdrant; at query time the top chunks are injected into the prompt and the answer must cite them.
**Learn:** *"What is Retrieval-Augmented Generation?"* — IBM Technology (YouTube). Also Pinecone's RAG handbook (web).

### 5.2 Embeddings & Vector Search
**What:** An *embedding* maps text to a high-dimensional vector (here **768-d** via `nomic-embed-text`) so that semantically similar text is geometrically close. *Vector search* finds nearest neighbors by **cosine** distance.
**Here:** Qdrant stores one vector per chunk in the `devpilot_chunks` collection and filters by `workspace_id`.
**Learn:** *"Word Embeddings"* — StatQuest with Josh Starmer; *"Vector Databases simply explained"* — Qdrant / Pinecone channels.

### 5.3 Chunking
**What:** Splitting long documents into overlapping windows small enough to retrieve precisely yet large enough to stay coherent.
**Here:** **800-token windows, 150-token overlap**, token-accurate via tiktoken `cl100k_base`.
**Learn:** *"Chunking Strategies for RAG"* — Greg Kamradt / LlamaIndex channel.

### 5.4 Hybrid Retrieval & Reciprocal Rank Fusion (RRF)
**What:** Combine **semantic** (vector) and **keyword** (full-text) search. RRF merges two ranked lists with `score = Σ 1/(k + rank)` — robust because it needs no score calibration.
**Here:** `RRF_K = 60`; the router picks `semantic` / `keyword` / `hybrid` per question.
**Learn:** *"Hybrid Search"* — Qdrant / Weaviate channels; search "Reciprocal Rank Fusion explained".

### 5.5 Reranking
**What:** Re-score the retrieved candidates against the query to keep only the most relevant before generation.
**Here:** default **heuristic** reranker (weighted: overlap 50%, exact-match 10%, original score 30%, rank prior 10%); optional LLM reranker. Cuts 15 candidates → top 5.
**Learn:** *"Rerankers and Two-Stage Retrieval"* — Cohere / James Briggs (YouTube).

### 5.6 Agentic Workflows
**What:** Decompose a task into specialized "agents," each with one responsibility, chained into a pipeline (vs. one monolithic prompt).
**Here:** 7 agents; the last two (evaluator, corrector) exist purely to make answers *trustworthy*.
**Learn:** *"Building Effective Agents"* (Anthropic engineering blog/talk); *"LLM Agents"* — DeepLearning.AI short courses.

### 5.7 LLM Evaluation (faithfulness / hallucination)
**What:** Automatically scoring an answer: is it supported by the context (faithfulness)? does it answer the question (relevance)? are retrieved contexts relevant (context precision)? is it fabricated (hallucination)?
**Here:** LLM-as-judge **plus** deterministic heuristics so there is always a non-circular baseline.
**Learn:** *"RAG Evaluation"* / RAGAS framework talks (YouTube); search "LLM as a judge".

### 5.8 Server-Sent Events (SSE)
**What:** A one-directional HTTP streaming protocol (server → client) — simpler than WebSockets, auto-reconnecting.
**Here:** the `/chat/stream` endpoint streams *structured* events (`start`, `trace`, `token`, `citations`, `evaluation`, `correction`, `complete`) — this powers both the chat and the AI Execution Studio.
**Learn:** *"Server-Sent Events vs WebSockets"* — Hussein Nasser (YouTube).

### 5.9 Async task queues (Celery)
**What:** Offload slow work to background workers so the API stays responsive.
**Here:** document ingestion runs as a Celery task brokered by Redis, with retries and idempotency.
**Learn:** *"Celery Tutorial"* — search "Celery + Redis FastAPI" (e.g. Patrick Loeber / ArjanCodes).

### 5.10 Observability for AI (RAGOps)
**What:** Applying DevOps/SRE practices (dashboards, metrics, incident triage) to a RAG system — including AI-specific quality metrics generic dashboards don't have.
**Here:** RAGOps aggregates trace/evaluation tables + Prometheus into 11 live panels.
**Learn:** *"Prometheus & Grafana crash course"* — TechWorld with Nana (YouTube); LangSmith intro videos for LLM tracing concepts.

---

## 6. Module Breakdown

### Backend (`backend/app/`)

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app factory (`create_app`), CORS, observability middleware, lifespan startup. |
| `core/config.py` | Pydantic `Settings` — the full config surface with validation. |
| `core/security.py` | JWT create/verify, bcrypt hashing, token expiry. |
| `core/metrics.py` | Prometheus metric definitions. |
| `api/routes/*` | HTTP routers grouped by domain (auth, documents, chat, retrieval, workspaces, admin, ragops, rag_traces, system, health). |
| `api/dependencies/auth.py` | `get_current_user`, `require_active_user`, `require_role` / `require_admin` / `require_super_admin`. |
| `api/dependencies/workspaces.py` | `get_workspace_or_403`, `require_workspace_role`. |
| `models/*` | SQLAlchemy models (user, workspace, document, conversation, audit). |
| `services/vector_store_service.py` | Qdrant collection mgmt, upsert, search. |
| `services/retrieval_service.py` | semantic / keyword / hybrid retrieval + Postgres fallback. |
| `services/reranking_service.py` | heuristic + optional LLM reranking. |
| `services/evaluation_service.py` | 4-metric answer evaluation (LLM + heuristic). |
| `services/chat_service.py` | RAG orchestration entry points: `query_chat`, `stream_chat_events`; trace persistence. |
| `agents/rag.py` | `AgenticRAGWorkflow` + the 7 agent classes. |
| `providers/{base,ollama_provider,gemini_provider,factory}.py` | LLM/embedding provider interface + implementations + factory. |
| `workers/{celery_app,document_tasks}.py` | Celery app + `process_document_task`. |
| `utils/{chunker,text_cleaner}.py` | Tokenized chunking + text normalization. |

### Frontend (`frontend/`) — feature-sliced

| Feature (`features/*`) | What it renders |
|---|---|
| `ai-execution-studio` | **Flagship.** Live 10-stage pipeline visualization driven by the SSE stream; chunk/rerank/generation/evaluation panels; 1×/2×/5× scrubber. |
| `architecture-explorer` | XYFlow node graph of the 7-layer system; nodes glow live as a query flows. |
| `dashboard` | Admin + personal dashboards (health, hero metrics, charts via Recharts). |
| `trace-observatory` | Filterable grid of *all* RAG queries + alerts. |
| `trace-inspector` | 9-section forensic replay of a single message. |
| `ragops` | 11-section control tower (auto-refresh 60s). |
| `hooks/useChatStream.ts` | Custom SSE parser + fallback to non-streaming. |

---

## 7. Implementation Details (code-level)

This section gives **real signatures, algorithms, and constants** so the behavior can be reproduced exactly.

### 7.1 Chunking — `utils/chunker.py`

```python
def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[dict[str, Any]]:
    ...
def count_tokens(text: str) -> int: ...          # tiktoken cl100k_base, fallback = \S+ word count
def _find_overlap_start(start_word, end_word, overlap, word_token_counts) -> int: ...
```

**Algorithm:**
1. Tokenize into words with regex `\S+`, keeping each word's char span.
2. Count tokens per word (tiktoken; fallback ≥1).
3. Greedily accumulate words until adding the next would exceed `chunk_size`; emit the chunk using the char spans of the first/last words.
4. Compute the next `start_word` by backtracking `overlap` tokens (`_find_overlap_start`).
5. Emit dicts: `{content, chunk_index, token_count, metadata:{start_char,end_char}}`.

**Why:** 800/150 (~19% overlap) keeps a coherent idea per chunk while preventing facts that straddle a boundary from being lost; token-accuracy ensures the top-5 fit the 6 000-char context budget.

### 7.2 Text cleaning — `utils/text_cleaner.py`
`clean_text(text)` normalizes line endings / NBSP / null bytes, **preserves fenced code blocks** (regex on ```` ``` ````), strips page artifacts (`page N`, `1 of 5`, divider lines), collapses whitespace, and reduces 3+ newlines to 2.

### 7.3 Vector store — `services/vector_store_service.py`

```python
COLLECTION_NAME = "devpilot_chunks"
# VectorParams(size=settings.embedding_dimension /*768*/, distance=Distance.COSINE)

async def ensure_collection(client) -> CollectionInfo
async def upsert_chunk_vector(chunk, embedding, *, filename, client=None) -> str
async def upsert_chunks(document_id, db, provider, client) -> int   # batches of EMBEDDING_BATCH_SIZE=4
async def search(workspace_id, query_vector, top_k, client) -> list[ScoredPoint]
```

**Payload per point:** `{workspace_id, document_id, chunk_id, chunk_index, filename}`.
**Resilience:** embedding calls retry up to **3×** with exponential backoff (1s, 2s, 4s). `search()` applies a `workspace_id` equality filter — this is the **vector-level tenant isolation**.

### 7.4 Retrieval — `services/retrieval_service.py`

```python
RETRIEVAL_STRATEGIES = {"semantic", "keyword", "hybrid"}
RRF_K = 60
TEXT_FALLBACK_SCAN_LIMIT = 1000
```

- **Semantic:** embed query → Qdrant `search` → hydrate chunks from Postgres. On failure → text fallback.
- **Keyword:** Postgres `to_tsvector('english', content)` vs `plainto_tsquery`, ranked by `ts_rank_cd`.
- **Hybrid (RRF):** run both, fuse with `score = Σ 1/(60 + rank_in_source)`, sort desc, return `top_k` with `source_scores` metadata.
- **Text fallback:** scans ≤1000 recent chunks; score = term-overlap ratio + filename overlap (×0.05) + phrase bonus (0.35) + quoted-phrase bonus (≤0.3).

### 7.5 Reranking — `services/reranking_service.py`

```python
async def rerank(query, contexts, top_k: int = 5) -> list[dict]
```

**Heuristic score (default):**
```
rerank_score = overlap*0.5 + min(exact_matches,5)*0.1 + original_score*0.3 + rank_prior*0.1
rank_prior   = 1/(60 + original_rank)
```
Optional **Ollama reranker** asks the LLM for strict JSON `{"ranked_chunk_ids":[...]}` and assigns `1/(pos+1)`; on any error it falls back to the heuristic.

### 7.6 Evaluation — `services/evaluation_service.py`

```python
class EvaluationResult(TypedDict):
    faithfulness: float          # 0..1  supported by context?
    relevance: float             # 0..1  answers the question?
    context_precision: float     # 0..1  retrieved contexts relevant?
    hallucination_score: float   # 0..1  higher = worse
    explanation: str

async def evaluate_answer(question, answer, contexts) -> EvaluationResult
```
**LLM mode:** Ollama `/api/chat` with JSON output, clamped to [0,1]. **Heuristic mode** (fallback) is deterministic: e.g. *faithfulness* = 0.8 if "information not found", else citation-aware overlap; *context_precision* = `useful_contexts / total_contexts`; *hallucination* = inverse of overlap with a citation bonus. Always one of the two runs, so a non-circular signal always exists.

### 7.7 Agentic workflow — `agents/rag.py`

```python
@dataclass
class AgenticRAGResult: query_type; retrieval_strategy; rewritten_query;
    candidate_chunks; retrieved_chunks; generated_answer; final_answer;
    llm_response; evaluation; correction_applied

class AgenticRAGWorkflow:
    async def run(self, *, db, workspace_id: UUID, question: str,
                  retrieval_strategy: str | None = None) -> AgenticRAGResult
```

| Agent | `run(...)` returns | Decision logic |
|---|---|---|
| **RouterAgent** | `{query_type, retrieval_strategy}` | keyword detection → summary/comparison/technical/factual; quoted/short → keyword; else semantic. |
| **QueryRewriterAgent** | `{query, changed}` | expand ≤2-word queries; "Summarize…" for summaries; append "?". |
| **RetrievalAgent** | `{retrieval_strategy, chunks}` | calls `retrieve_chunks(strategy, top_k)`. |
| **RerankerAgent** | `{chunks, input_count, top_k}` | calls `rerank()`. |
| **GeneratorAgent** | `{answer, llm_response}` | builds grounded prompt; calls provider `.generate()`; **enforces `[1]` citation**. |
| **EvaluatorAgent** | `EvaluationResult` | calls `evaluate_answer()`. |
| **CorrectorAgent** | `{answer, correction_applied, reason, evaluation}` | refuse/replace if faithfulness<0.5 / hallucination>0.6 / context_precision<0.5; keep if strong support. |

Each agent is wrapped by `_run_agent()` which **times, logs, and catches exceptions** — that wrapper is what produces the `AgentRun` trace rows.

### 7.8 Streaming & trace persistence — `services/chat_service.py`

```python
async def query_chat(db, workspace, user, question,
                     conversation_id=None, retrieval_strategy="hybrid") -> dict
async def stream_chat_events(db, workspace, user, question,
                     conversation_id=None, retrieval_strategy="hybrid") -> AsyncIterator[StreamEvent]
# StreamEvent = tuple[str, dict]  →  start | trace | token | correction | citations | evaluation | message | done | error
```
`_stream_chat_impl` creates the conversation + user/assistant messages, runs each agent emitting `trace` events, streams tokens (`stream_generate` if available, else chunks `generate()` output at `chunk_size=24`), then **persists the full trace**: `RetrievedChunk` (score, rank, strategy), `AgentRun` (input/output/latency), `LLMUsage` (tokens, latency), `Evaluation` (4 metrics). Client disconnect aborts and rolls back.

### 7.9 Ingestion task — `workers/document_tasks.py`

```python
@celery_app.task(bind=True, name="process_document_task", max_retries=3)
def process_document_task(self, document_id: str) -> dict
```
Steps: fetch doc → status `processing` → `extract_text` (pypdf / utf-8) → `clean_text` → `chunk_text(800,150)` → replace chunk rows → `upsert_chunks` (embed in batches of 4, retry on timeout) → status `indexed`. Provider/vector errors fail fast; other errors retry up to 3× with backoff `2^attempt` (≤30s). Idempotent via unique `(document_id, chunk_index)`.

### 7.10 Provider interface — `providers/`

```python
class BaseEmbeddingProvider(ABC):
    async def embed(self, text) -> list[float]
    async def embed_batch(self, texts) -> list[list[float]]

@dataclass(frozen=True)
class LLMResponse: content; model; prompt_tokens=0; completion_tokens=0; total_tokens=0; latency_ms=None

def get_llm_provider() -> Any   # "gemini" → GeminiLLMProvider, "ollama" → OllamaLLMProvider
```
`OllamaLLMProvider.generate/stream_generate` call `/api/chat`; `OllamaEmbeddingProvider.embed_batch` calls `/api/embed`. `GeminiLLMProvider` calls `:generateContent` / `:streamGenerateContent?alt=sse` with retry on 429/5xx and a fallback model. **System prompt** (`DEFAULT_RAG_SYSTEM_PROMPT`) forces context-only answers, the "I could not find this information…" refusal, and `[n]` citations.

### 7.11 Security — `core/security.py`, `api/dependencies/`
`ALGORITHM="HS256"`, `ACCESS_TOKEN_EXPIRE_MINUTES=30`. JWT payload `{sub:user_id, email, role, exp}` signed with `secret_key`. `hash_password`/`verify_password` use passlib bcrypt. `get_current_user` decodes + loads the user; `require_admin`/`require_super_admin` gate admin tooling; `get_workspace_or_403` enforces membership; admins bypass per-workspace role checks.

---

## 8. Data Flow

### 8.1 Ingestion (async)

```mermaid
sequenceDiagram
  participant U as User
  participant API as FastAPI
  participant R as Redis
  participant W as Celery Worker
  participant PG as PostgreSQL
  participant OL as Ollama (embed)
  participant QD as Qdrant
  U->>API: POST /workspaces/{id}/upload (file)
  API->>PG: insert Document(status=uploaded)
  API->>R: enqueue process_document_task(doc_id)
  API-->>U: 202 accepted (non-blocking)
  W->>PG: status=processing
  W->>W: extract → clean → chunk(800/150)
  W->>PG: replace Chunk rows
  W->>OL: embed_batch (size 4, retry×3)
  W->>QD: upsert vectors (cosine, payload=workspace_id…)
  W->>PG: status=indexed, processed_at
```

### 8.2 Query (real-time, streamed)

```mermaid
sequenceDiagram
  participant U as Client
  participant API as /chat/stream (SSE)
  participant WF as AgenticRAGWorkflow
  participant QD as Qdrant
  participant LLM as Provider
  participant PG as PostgreSQL
  U->>API: POST question
  API-->>U: event: start
  API->>WF: run()
  WF->>WF: Router → Rewriter
  API-->>U: event: trace (router/rewriter)
  WF->>QD: Retrieval (15 candidates)
  WF->>WF: Rerank → top 5
  API-->>U: event: trace (retrieval/rerank)
  WF->>LLM: Generate (grounded prompt)
  LLM-->>API: tokens
  API-->>U: event: token (live)
  WF->>WF: Evaluate → Correct
  API-->>U: event: citations / evaluation / correction
  WF->>PG: persist AgentRun, RetrievedChunk, Evaluation, LLMUsage
  API-->>U: event: complete (message_id)
```

---

## 9. API Design

Base path: **`/api/v1`**. Interactive docs at `/docs` (Swagger) and `/redoc`.

| Group | Key endpoints |
|---|---|
| **auth** | `POST /auth/register` · `POST /auth/login` (JWT) · `GET /auth/me` |
| **documents** | `POST /workspaces/{id}/upload` · `GET/DELETE /workspaces/{id}/documents[/{doc}]` |
| **chat** | `POST /workspaces/{id}/chat/query` · `POST /workspaces/{id}/chat/stream` (SSE) · conversations + messages + per-message evaluation |
| **retrieval** | `POST /workspace/{id}/{semantic\|keyword\|hybrid}` (direct retrieval testing) |
| **workspaces** | `GET/POST /workspaces` · `GET/PATCH /workspaces/{id}` · `GET /workspaces/{id}/members` |
| **admin** | stats, users (list/role/delete), workspaces, documents, audit-logs, errors |
| **admin/ragops** | workspace summaries, document pipeline, chunks, retry, `health/qdrant` |
| **admin/rag-traces** | list (filtered) · `quality/summary` · `{message_id}` detail · `{message_id}/feedback` |
| **system / health** | `GET /system/ai-config` · `ai-health` · `GET /health` · `GET /metrics` (Prometheus) |

**SSE contract** (`/chat/stream`): events `start → trace* → token* → citations → evaluation → correction? → complete` (or `error`), each as `event: <name>\ndata: <json>\n\n`.

---

## 10. Database Design (ERD)

~14 entities, UUID PKs, JSONB for agent payloads, cascade deletes, Alembic-migrated, async SQLAlchemy 2.0. **The execution trace is first-class** (RetrievedChunk / AgentRun / Evaluation / LLMUsage) so any answer can be reconstructed later.

```mermaid
erDiagram
  USER ||--o{ WORKSPACE : owns
  USER ||--o{ WORKSPACE_MEMBER : "is"
  WORKSPACE ||--o{ WORKSPACE_MEMBER : has
  WORKSPACE ||--o{ DOCUMENT : contains
  WORKSPACE ||--o{ CONVERSATION : contains
  DOCUMENT ||--o{ CHUNK : "split into"
  CONVERSATION ||--o{ MESSAGE : has
  MESSAGE ||--o{ RETRIEVED_CHUNK : retrieved
  MESSAGE ||--o{ AGENT_RUN : traced
  MESSAGE ||--|| EVALUATION : scored
  MESSAGE ||--o{ LLM_USAGE : costed
  CHUNK ||--o{ RETRIEVED_CHUNK : referenced
  USER ||--o{ AUDIT_LOG : actor

  CHUNK { uuid id; uuid document_id; uuid workspace_id; text content; int chunk_index; int token_count; jsonb metadata_; string vector_id }
  RETRIEVED_CHUNK { uuid id; uuid message_id; uuid chunk_id; float score; int rank; string retrieval_strategy }
  AGENT_RUN { uuid id; uuid message_id; string agent_type; string status; jsonb input; jsonb output; int latency_ms }
  EVALUATION { uuid id; uuid message_id; float faithfulness; float relevance; float context_precision; float hallucination_score; text explanation }
  LLM_USAGE { uuid id; uuid message_id; string provider; string model; int prompt_tokens; int completion_tokens; int total_tokens; int latency_ms }
```

Migrations (5, under `backend/alembic/versions/`): initial schema → answer evaluation → admin RBAC → role constraint → user defaults.

---

## 11. Security & Governance

- **Authentication:** JWT HS256, 30-min expiry; bcrypt password hashing; deactivated/deleted users can't authenticate.
- **Workspace isolation (defense in depth):** every query is scoped by `workspace_id` **both** at the service layer **and** as a Qdrant payload filter — cross-tenant leakage is impossible at the vector level.
- **RBAC:** DB-enforced roles `user` / `admin` / `super_admin` + per-workspace roles. RAGOps, traces and user management are admin-only; **full chunk content is super-admin-only** (safe previews by default).
- **Audit log:** sensitive actions (admin login, deletions) → `audit_logs` with actor, action, target, IP, user-agent.
- **CORS:** restricted to configured origins.

> **Production hardening (documented next steps):** move `GEMINI_API_KEY` out of plaintext `.env` into a secret manager; add refresh-token rotation; consider RS256 if the API splits into multiple services.

---

## 12. Observability

- **Structured logs:** every HTTP request logs `request_id, method, path, status, latency_ms, user_id, workspace_id` (request-ID correlation via `X-Request-ID`).
- **Prometheus metrics** (`GET /metrics`): `http_requests_total`, `http_request_duration_seconds`, `documents_uploaded_total`, `document_processing_duration_seconds`, `rag_queries_total`, `rag_query_duration_seconds`, `retrieval_latency_seconds{strategy}`, `evaluation_latency_seconds`, `llm_tokens_total{provider,model,type}`.
- **Grafana** (`:3002`, admin/admin) auto-provisioned with the *DevPilot AI Observability* dashboard; Prometheus scrapes `backend:8000/metrics` every 15s.
- **RAGOps API + UI:** aggregates the trace/evaluation tables into health, embedding, retrieval, evaluation, agent, and failure panels; per-workspace health score (0–100); LLM-synthesized risk summary.
- **Trace Explorer:** filterable observatory of all queries → 9-section forensic replay of any message.

---

## 13. Testing Strategy

~4 500 lines of backend tests across 20+ modules; frontend via Vitest + jsdom.

```bash
# backend unit tests (needs local Postgres/Redis/Qdrant or mocks)
cd backend && pytest
make test-cov                     # coverage: pytest --cov=app --cov-report=term-missing

# integration (live docker stack), markers gate heavy suites:
make test-integration             # -m "not ingestion and not rag"
make test-ingestion               # DEVPILOT_RUN_INGESTION=1 ... -m "ingestion and not rag"
make test-rag                     # DEVPILOT_RUN_INGESTION=1 DEVPILOT_RUN_RAG=1 ... -m "rag"

# frontend
cd frontend && npm test           # vitest run
```

Pytest markers (`pytest.ini`): `live`, `ingestion`, `rag`, `slow`, `frontend`. Non-deterministic LLM output is handled by **mocking providers** and testing the deterministic orchestration (routing, fallback, citation enforcement, corrector policy) + the deterministic pieces (chunking, RRF, heuristics).

---

## 14. Step-by-Step Deployment Guide

### Prerequisites
- Docker + Docker Compose
- **Ollama on the host** (for local inference) *or* a Gemini API key (cloud)
- ~8 GB RAM free (more if running `qwen3:8b` locally)

### 14.1 Fastest path — full stack with Docker

```bash
# 1. Clone & configure
git clone <repo-url> devpilot-ai && cd devpilot-ai
cp .env.example .env
#    edit .env: set SECRET_KEY (32+ chars). For cloud LLM set LLM_PROVIDER=gemini + GEMINI_API_KEY.

# 2. (Local LLM path) start Ollama on the HOST and pull models
OLLAMA_HOST=0.0.0.0:11434 ollama serve &
ollama pull qwen3:8b
ollama pull nomic-embed-text
curl http://localhost:11434/api/tags          # verify

# 3. Bring up the platform
docker compose up --build

# 4. Verify
curl http://localhost:8000/health             # {"status":"ready"}
open http://localhost:8000/docs               # Swagger
open http://localhost:3000                     # Frontend
open http://localhost:9090                     # Prometheus
open http://localhost:3002                     # Grafana (admin/admin)
```

> **Port collisions?** Override at launch:
> ```bash
> BACKEND_HOST_PORT=8001 FRONTEND_HOST_PORT=3001 \
> FRONTEND_URL=http://localhost:3001 BACKEND_CORS_ORIGINS=http://localhost:3001 \
> docker compose up --build
> ```

### 14.2 Database migrations

```bash
docker compose up -d postgres
make migrate                                   # alembic upgrade head
make revision message="describe schema change" # autogenerate a new migration
```

### 14.3 First run (smoke test)
1. `POST /api/v1/auth/register` then `POST /api/v1/auth/login` → copy the JWT.
2. `POST /api/v1/workspaces` (Bearer token) → workspace id.
3. `POST /api/v1/workspaces/{id}/upload` a PDF → wait for status `indexed` (watch the celery_worker logs or RAGOps).
4. `POST /api/v1/workspaces/{id}/chat/stream` with a question → observe streamed events.
5. Open **AI Studio** (`/ai-execution-studio`) and run the same question to watch the pipeline live.

### 14.4 Local backend (no container)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export DATABASE_URL="postgresql+asyncpg://devpilot:devpilot@localhost:5432/devpilot"
export REDIS_URL="redis://localhost:6380/0"
export QDRANT_URL="http://localhost:6335"
export SECRET_KEY="local-development-secret-32-characters"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# in another shell — the worker:
celery -A app.workers.celery_app worker --loglevel=INFO
```

### 14.5 Frontend dev

```bash
cd frontend
cp .env.example .env          # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                    # http://localhost:3000
```

---

## 15. Reproduce From Scratch

Greenfield build order (what to implement first → last) so a new engineer can rebuild the whole system incrementally:

1. **Skeleton & config** — FastAPI app factory + Pydantic `Settings` + Docker Compose with Postgres/Redis/Qdrant. Health endpoint green.
2. **Data model & migrations** — SQLAlchemy models (User, Workspace, Document, Chunk, Conversation, Message + trace tables) + Alembic initial migration.
3. **Auth & tenancy** — JWT, bcrypt, `get_current_user`, workspaces + membership, `get_workspace_or_403`.
4. **Providers** — `BaseEmbeddingProvider` / LLM interface + Ollama implementation + factory. Test `embed`/`generate` in isolation.
5. **Ingestion** — `chunker` (800/150) + `text_cleaner` + `vector_store_service` (Qdrant collection, upsert) + Celery `process_document_task`. Upload → indexed works.
6. **Retrieval** — semantic, then keyword, then hybrid (RRF k=60) + Postgres fallback.
7. **Reranking** — heuristic weights (0.5/0.1/0.3/0.1); optional LLM reranker later.
8. **Agentic workflow** — the 7 agents + `AgenticRAGWorkflow` + `query_chat`. Non-streaming answer with citations works.
9. **Evaluation & correction** — 4 metrics (heuristic first, LLM second) + corrector policy.
10. **Streaming** — `stream_chat_events` SSE + structured trace persistence (AgentRun/RetrievedChunk/Evaluation/LLMUsage).
11. **Observability** — Prometheus metrics + RAGOps aggregation endpoints + rag-traces endpoints.
12. **Frontend** — Next.js app, `useChatStream`, chat UI → then RAGOps, Trace Explorer, and the AI Execution Studio.
13. **Governance & polish** — RBAC, audit log, admin tooling, Grafana dashboard, tests.

---

## 16. Configuration Reference

Key environment variables (full list in `.env.example`). Validated by `core/config.py`.

| Variable | Default | Notes |
|---|---|---|
| `SECRET_KEY` | — | **32+ chars**, JWT signing. |
| `DATABASE_URL` | `postgresql+asyncpg://devpilot:devpilot@postgres:5432/devpilot` | async driver required. |
| `REDIS_URL` | `redis://redis:6379/0` | Celery broker. Host port **6380**. |
| `QDRANT_URL` | `http://qdrant:6333` | Host port **6335**. |
| `LLM_PROVIDER` | `ollama` (compose) / `gemini` (.env.example) | `ollama`\|`openai`\|`gemini`. |
| `EMBEDDING_PROVIDER` | `ollama` | `ollama`\|`openai`. |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama on host. |
| `OLLAMA_GENERATION_MODEL` | `qwen3:8b` (compose) / `qwen2.5:3b-instruct-q3_K_S` (.env) | — |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | 768-d. |
| `EMBEDDING_DIMENSION` | `768` | must match the model. |
| `EMBEDDING_BATCH_SIZE` | `4` | embed throughput vs GPU mem. |
| `GENERATION_TEMPERATURE` | `0.2` | — |
| `GENERATION_MAX_TOKENS` | `1000` | — |
| `RAG_TOP_K` | `5` | final chunks used. |
| `RAG_MAX_CONTEXT_CHARS` | `6000` | context budget. |
| `ENABLE_RERANKING` | `true` | — |
| `ENABLE_OLLAMA_RERANKER` | `false` | heuristic by default. |
| `RETRIEVAL_CANDIDATES` | `15` | before rerank. |
| `RERANK_TOP_K` | `5` | after rerank. |
| `MAX_UPLOAD_SIZE` | `10485760` | 10 MB. |
| `GEMINI_API_KEY` | — | required if `LLM_PROVIDER=gemini`. |
| `BACKEND_CORS_ORIGINS` | `http://localhost:3000` | comma-separated. |

**Default ports:** backend `8000`, frontend `3000`, postgres `5432`, redis host `6380`, qdrant host `6335`, prometheus `9090`, grafana `3002`, ollama `11434`.

---

## 17. Conclusion

DevPilot AI demonstrates that the hard part of production AI is **not the model call** — it is everything around it: ingestion, evaluation, isolation, observability and traceability. By treating the execution trace as first-class data and shipping a real ops layer (RAGOps) and a live execution visualization (AI Execution Studio), the project turns a black-box chatbot into a **glass-box, auditable system** that an enterprise could operate.

The architecture was built for extension: the provider abstraction, the agent interface, and the trace schema are the seams along which GraphRAG, multi-agent teams, MCP tool-use, enterprise connectors, and advanced RAGOps (eval datasets, SLOs, A/B testing) can be added **without rewrites**.

**In one line:** DevPilot answers the question the industry is actually asking — *not "can the model answer?", but "can you trust, measure and operate the answer in production?"*

---

## 18. Appendix — Learning Resources

> Reputable, searchable references per concept. Verify the exact upload before depending on it.

| Concept | Channel / Source | Search title |
|---|---|---|
| RAG fundamentals | IBM Technology | "What is Retrieval-Augmented Generation (RAG)?" |
| Embeddings | StatQuest (Josh Starmer) | "Word Embeddings, Clearly Explained" |
| Vector databases | Qdrant / Pinecone | "Vector Databases simply explained" |
| Chunking | Greg Kamradt / LlamaIndex | "5 Levels of Chunking Strategies for RAG" |
| Hybrid search + RRF | Weaviate / Qdrant | "Hybrid search & Reciprocal Rank Fusion" |
| Rerankers | Cohere / James Briggs | "Rerankers and Two-Stage Retrieval" |
| LLM agents | DeepLearning.AI · Anthropic | "Building Effective Agents" |
| RAG evaluation | RAGAS / community | "Evaluating RAG with faithfulness & hallucination" |
| SSE vs WebSockets | Hussein Nasser | "Server-Sent Events vs WebSockets" |
| Celery + Redis | ArjanCodes / Patrick Loeber | "Background tasks with Celery and Redis" |
| FastAPI | FastAPI official docs · ArjanCodes | "FastAPI full course" |
| Next.js App Router | Next.js official (Vercel) | "Next.js App Router course" |
| React Query | TanStack / Jack Herrington | "React Query in 100 seconds / deep dive" |
| Prometheus + Grafana | TechWorld with Nana | "Prometheus & Grafana crash course" |
| Qdrant in depth | Qdrant official | "Qdrant tutorial" |
| LLM tracing | LangSmith (LangChain) | "Tracing LLM applications" |

---

*Document generated from the DevPilot AI source tree. All numbers, signatures, ports, and commands are quoted from the codebase (`backend/app/`, `frontend/`, `docker-compose.yml`, `Makefile`, `pyproject.toml`, `.env.example`).*
