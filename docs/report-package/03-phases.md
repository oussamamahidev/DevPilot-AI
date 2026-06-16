# 03 — Phased Engineering Progression

This document records the complete 23-phase development progression of **DevPilot AI**. Each phase is described in terms of its objective, the features implemented, the technical choices made, the engineering challenges encountered, and the results achieved.

Phases 1–19 form the documented backend-to-frontend foundation. Phases 20–23 cover the later platform, observability, design-system, and flagship-experience work.

**Cross-cutting stack.** Backend: FastAPI, PostgreSQL 16, Redis 7, Celery, Qdrant 1.12.6, Ollama (`nomic-embed-text`, 768-d), Gemini 2.5 Flash, JWT. Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, React Query, Framer Motion, React Flow. Infrastructure: Docker Compose orchestrating 8 services. Build status: green (`next build`), ESLint clean.

---

## Phase 1 — Project Foundation & Docker Base

**Objective.** Establish a reproducible, containerized development environment so that the entire stack can be brought up with a single command.

**Features implemented.**
- Monorepo layout separating backend, frontend, and infrastructure concerns.
- Docker Compose definition orchestrating all platform services.
- Base service images and shared environment configuration.

**Technical choices.**
- Docker Compose as the single orchestration entry point, enabling deterministic local startup.
- Service decomposition into independent containers (API, database, cache/broker, vector store, workers) to mirror a production topology.

**Challenges.**
- Aligning service startup ordering and inter-container networking so dependent services resolve one another by name.
- Keeping image build times reasonable while installing the full Python and Node toolchains.

**Results.** `docker compose` resolves cleanly and all services start successfully, providing the baseline on which every later phase builds.

---

## Phase 2 — FastAPI Backend Health & Configuration

**Objective.** Stand up the API process with introspection endpoints and safe configuration handling.

**Features implemented.**
- `/health` endpoint for liveness checks.
- `/system/ai-config` endpoint exposing the active AI configuration.
- Centralized settings/configuration loading.

**Technical choices.**
- FastAPI for the API layer, chosen for its typed request/response models and automatic OpenAPI documentation.
- Configuration sourced from environment variables to keep secrets out of source control.

**Challenges.**
- Surfacing useful AI-configuration metadata through `/system/ai-config` **without** leaking secret values (API keys, credentials).

**Results.** Health and configuration endpoints respond correctly, and configuration introspection is verified to contain **no secret leakage**.

---

## Phase 3 — PostgreSQL Integration

**Objective.** Provide durable relational storage with versioned, migration-driven schema management.

**Features implemented.**
- An **11-table** relational schema covering users, workspaces, documents, chat, and AI-run records.
- SQLAlchemy models mapped to all tables.
- Alembic migrations to evolve the schema reproducibly.

**Technical choices.**
- PostgreSQL 16 as the system of record.
- SQLAlchemy as the ORM for typed model access.
- Alembic for versioned, reversible migrations.

**Challenges.**
- Designing relationships across 11 tables so that downstream RAG and observability features (agent runs, retrieved chunks, evaluations) could be joined efficiently.

**Results.** The full 11-table schema is created and migrated via SQLAlchemy + Alembic, giving every later phase a stable persistence layer.

---

## Phase 4 — User Authentication with JWT

**Objective.** Secure the platform with token-based authentication and role awareness.

**Features implemented.**
- `register`, `login`, and `me` endpoints.
- Password hashing.
- Role assignment on the user record.

**Technical choices.**
- JWT for stateless authentication tokens.
- Password hashing (never storing plaintext credentials).
- Role field on the user model to enable later RBAC.

**Challenges.**
- Implementing a token issuance/verification flow that integrates cleanly with FastAPI dependency injection for protected routes.

**Results.** Users can register and log in, passwords are stored hashed, the `me` endpoint returns the authenticated identity, and roles are persisted for downstream authorization.

---

## Phase 5 — Workspace Management & Isolation

**Objective.** Enforce multi-tenant isolation so users only access their own workspaces.

**Features implemented.**
- Workspace creation and membership.
- Per-workspace access control on protected resources.

**Technical choices.**
- Workspace-scoped authorization checks layered on top of JWT identity.
- Access decisions derived from workspace membership rather than global roles.

**Challenges.**
- Consistently applying workspace checks across every resource-bearing endpoint to avoid cross-tenant data exposure.

**Results.** Access control is enforced per workspace; requests against a workspace the caller does not belong to return **403**.

---

## Phase 6 — Document Upload API

**Objective.** Allow users to ingest source documents into a workspace.

**Features implemented.**
- Document `upload` endpoint.
- Document `list` endpoint.
- Document `status` reporting.

**Technical choices.**
- Workspace-scoped document records persisted in PostgreSQL.
- Status field to track each document through the ingestion lifecycle.

**Challenges.**
- Defining a status model that would later reflect asynchronous processing stages without blocking the upload request.

**Results.** Documents can be uploaded, listed, and queried for status within a workspace.

---

## Phase 7 — Celery & Redis Async Processing

**Objective.** Move heavy document processing off the request path into reliable background workers.

**Features implemented.**
- `process_document_task` Celery task for asynchronous document handling.
- Retry policy with `max_retries=3`.

**Technical choices.**
- Celery for distributed task execution.
- Redis 7 as the broker and result backend.
- Bounded retries to recover from transient failures without infinite loops.

**Challenges.**
- Coordinating task lifecycle with document status so the UI/API can reflect in-progress, completed, and failed states.

**Results.** Document processing runs asynchronously via `process_document_task` with up to 3 retries, keeping the upload API responsive.

---

## Phase 8 — Text Extraction, Cleaning & Chunking

**Objective.** Transform raw documents into clean, retrievable text segments.

**Features implemented.**
- Text extraction from uploaded documents.
- Text cleaning/normalization.
- Chunking using **overlapping windows**.

**Technical choices.**
- Overlapping-window chunking to preserve context across chunk boundaries and improve retrieval recall.

**Challenges.**
- Balancing chunk size and overlap to retain semantic coherence without exploding the number of embeddings.

**Results.** Documents are reliably extracted, cleaned, and split into overlapping chunks ready for embedding.

---

## Phase 9 — Ollama Embeddings & Qdrant Indexing

**Objective.** Convert chunks into vector embeddings and index them for similarity search.

**Features implemented.**
- Embedding generation via Ollama using `nomic-embed-text` (**768-dimensional** vectors).
- Vector indexing in Qdrant using an **HNSW** index with **cosine** distance.

**Technical choices.**
- Ollama `nomic-embed-text` for local embedding generation.
- Qdrant 1.12.6 HNSW + cosine for approximate nearest-neighbor search.
- Containers reach the host Ollama instance via `host.docker.internal`.

**Challenges.**
- Networking: enabling Dockerized services to reach an Ollama instance running on the host, solved with `host.docker.internal`.

**Results.** Chunks are embedded as 768-d vectors and indexed in Qdrant with HNSW/cosine, enabling semantic retrieval.

---

## Phase 10 — Semantic Retrieval

**Objective.** Retrieve the most relevant chunks for a given query.

**Features implemented.**
- Cosine nearest-neighbor retrieval over the Qdrant index.

**Technical choices.**
- Cosine similarity search against the HNSW index built in Phase 9.

**Challenges.**
- Tuning retrieval parameters to return relevant chunks while keeping latency low.

**Results.** Queries return their nearest chunks by cosine similarity from Qdrant.

---

## Phase 11 — RAG Chat with Citations

**Objective.** Generate grounded answers that cite their supporting context.

**Features implemented.**
- Retrieval-augmented generation that produces answers with `[n]` citation markers.
- Citation markers grounded in the retrieved context.

**Technical choices.**
- Gemini 2.5 Flash as the generation model.
- Prompt construction that injects retrieved chunks and instructs the model to cite them with `[n]` markers.

**Challenges.**
- Ensuring citation markers actually correspond to the retrieved context rather than being fabricated by the model.

**Results.** Chat answers include `[n]` markers grounded in the retrieved context, making responses traceable to source material.

---

## Phase 12 — Answer Evaluation

**Objective.** Quantitatively assess answer quality.

**Features implemented.**
- Evaluation metrics: **faithfulness**, **relevance**, **context precision**, and **hallucination**.

**Technical choices.**
- Automated metric computation over the generated answer, the query, and the retrieved context.

**Challenges.**
- Defining metrics that capture grounding quality (faithfulness, hallucination) alongside relevance to the user's question.

**Results.** Each answer can be scored for faithfulness, relevance, context precision, and hallucination.

---

## Phase 13 — Agentic Workflow

**Objective.** Replace single-shot RAG with a multi-step agentic pipeline that can self-correct.

**Features implemented.**
- `AgenticRAGWorkflow` with the stage sequence: **router → query_rewriter → retrieval → reranker → generator → evaluator → corrector**.
- Persistence of each run to the `agent_runs` table.

**Technical choices.**
- A staged workflow where routing and query rewriting precede retrieval, and an evaluator/corrector loop closes the quality gap after generation.
- Run records persisted to `agent_runs` for later observability.

**Challenges.**
- Orchestrating the stage handoffs and ensuring intermediate state is captured for inspection.

**Results.** The agentic workflow executes the full router-to-corrector pipeline and persists every run to `agent_runs`.

---

## Phase 14 — Hybrid Retrieval

**Objective.** Improve recall by combining vector and lexical search.

**Features implemented.**
- Hybrid retrieval blending **semantic** (vector) and **keyword** search.

**Technical choices.**
- Combining cosine vector similarity with keyword matching to capture both semantic and exact-term relevance.

**Challenges.**
- Merging and ranking results from two retrieval strategies into a single candidate set.

**Results.** Retrieval combines semantic and keyword signals, improving coverage over vector-only search.

---

## Phase 15 — Reranking

**Objective.** Sharpen retrieval precision by reordering candidates.

**Features implemented.**
- Reranking that takes **15 candidates** and selects the **top 5**.

**Technical choices.**
- A reranking step inserted after retrieval to promote the most relevant chunks before generation.

**Challenges.**
- Choosing a candidate pool size (15) large enough to surface the best chunks while keeping reranking cost bounded.

**Results.** The pipeline narrows 15 retrieved candidates down to the 5 most relevant chunks for generation.

---

## Phase 16 — Frontend Shell & Backend Connectivity

**Objective.** Establish the web application foundation and confirm it can talk to the API.

**Features implemented.**
- Next.js App Router application shell.
- Backend connectivity from the frontend.

**Technical choices.**
- Next.js 15 with the App Router and React 19.
- TypeScript and Tailwind CSS for the UI foundation.

**Challenges.**
- Wiring the frontend to the backend across the Docker network and confirming end-to-end connectivity.

**Results.** The Next.js App Router shell renders and successfully communicates with the backend.

---

## Phase 17 — Frontend Auth Integration

**Objective.** Bring authentication into the UI.

**Features implemented.**
- Login and register UI.
- JWT storage on the client.
- Route guards for protected pages.

**Technical choices.**
- Client-side JWT storage paired with guards that gate protected routes.

**Challenges.**
- Synchronizing client auth state with guard logic so unauthenticated users are reliably redirected.

**Results.** Users can log in and register through the UI; the JWT is stored client-side and guards protect authenticated routes.

---

## Phase 18 — Documents UI Integration

**Objective.** Provide a full document-management experience in the UI.

**Features implemented.**
- Document upload with **drag-and-drop**.
- Document listing with **status** display.
- **Batch** upload support.

**Technical choices.**
- React Query for fetching and synchronizing document state with the backend.

**Challenges.**
- Reflecting asynchronous processing status (from the Celery pipeline) in the UI as documents move through ingestion.

**Results.** Users can upload documents (including via drag-and-drop and in batches) and track their processing status in the UI.

---

## Phase 19 — Chat UI with Citations & Evaluation

**Objective.** Deliver the end-user RAG chat experience.

**Features implemented.**
- Streaming chat interface.
- Inline citations.
- Source display.

**Technical choices.**
- Streaming responses surfaced progressively in the UI.
- Citation and source rendering tied to the `[n]` markers and retrieved context.

**Challenges.**
- Rendering streamed content while keeping citations and sources aligned with the answer.

**Results.** The chat UI streams answers, renders citations, and displays the supporting sources and evaluation context.

---

## Phase 20 — Admin Console, RBAC & RAGOps Control Tower

**Objective.** Provide administrative oversight and operational control over the RAG platform.

**Features implemented.**
- Admin statistics overview.
- User management (CRUD).
- Audit logs.
- RAGOps Control Tower with health and pipeline views.

**Technical choices.**
- Role-based access control (RBAC) gating admin surfaces.
- A dedicated RAGOps surface for pipeline/health monitoring.

**Challenges.**
- Exposing administrative and operational data while enforcing role-based authorization on every admin route.

**Results.** Administrators have a console for stats, user CRUD, and audit logs, plus a RAGOps Control Tower for pipeline and health monitoring.

---

## Phase 21 — Trace Observability

**Objective.** Make every RAG interaction inspectable end to end.

**Features implemented.**
- **RAG Trace Observatory** list view.
- **AI Trace Inspector** with a 9-section detail view.
- Drill-down across the data chain: `message → agent_runs → retrieved_chunks → evaluations`.

**Technical choices.**
- A list-plus-detail observability pattern, joining the persisted run, chunk, and evaluation records produced by earlier phases.

**Challenges.**
- Assembling a coherent trace by joining messages, agent runs, retrieved chunks, and evaluations into a single inspectable view.

**Results.** Operators can browse traces in the Observatory and drill into a 9-section Inspector that follows each message through its agent run, retrieved chunks, and evaluations.

---

## Phase 22 — Design System, Frontend Hardening, Test Foundation & Real Token Streaming

**Objective.** Mature the frontend into a polished, tested, and correctly-streaming product.

**Features implemented.**
- **Horizon** design system plus a documented MIGRATION plan.
- Vitest test foundation with **39 tests**.
- Fix converting Gemini **fake-streaming** into **real SSE token streaming**.
- Role-aware dashboard and RBAC fixes.

**Technical choices.**
- A unified Horizon design system to standardize UI components and tokens.
- Vitest + Testing Library for the unit-test foundation.
- Server-Sent Events (SSE) to stream real tokens from Gemini 2.5 Flash.

**Challenges.**
- Replacing the previous fake-streaming behavior with genuine progressive token delivery over SSE.
- Reconciling role-aware dashboard rendering with corrected RBAC rules.

**Results.** The Horizon design system and migration plan are in place, 39 Vitest tests pass, streaming delivers real SSE tokens, and dashboard/RBAC behavior is role-aware and corrected.

---

## Phase 23 — AI Execution Studio & Architecture Explorer

**Objective.** Deliver the flagship, demonstrative experiences that showcase the platform's internals.

**Features implemented.**
- **AI Execution Studio**: a 10-stage animated pipeline driven by **real SSE**, with an animated avatar.
- **Architecture Explorer**: a React Flow architecture map with live flow, a node inspector, and per-component pages.

**Technical choices.**
- Framer Motion for the animated pipeline and avatar.
- Real SSE events driving the 10-stage visualization rather than scripted timing.
- React Flow for the interactive architecture map with selectable nodes and dedicated component pages.

**Challenges.**
- Synchronizing rich animation with real streaming events so the visualization reflects actual backend execution.

**Results.** The AI Execution Studio renders a 10-stage animated pipeline driven by real SSE with an animated avatar, and the Architecture Explorer presents a live React Flow map with a node inspector and per-component pages.
