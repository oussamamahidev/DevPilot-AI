# 08 — Technology Stack

## 1. Overview

DevPilot AI is built on a deliberately chosen, production-oriented stack. Every technology was selected to satisfy three constraints: it must be **async/streaming-capable** (the platform streams answers token-by-token and ingests documents asynchronously), it must be **self-hostable** (the privacy differentiator requires the organization's data to stay under its control), and it must be **observable** (RAGOps treats RAG as a production system). This document lists the full stack by tier, with each technology's role and the rationale — including trade-offs — behind its selection.

---

## 2. Backend Tier

| Technology | Version | Role | Why chosen (trade-offs) |
|---|---|---|---|
| **FastAPI** | — | Web framework; REST API and SSE streaming endpoints | Native async support is essential for streaming answers and concurrent I/O to Qdrant/Ollama/Gemini. First-class Pydantic integration and automatic OpenAPI. Trade-off: less batteries-included than Django, so persistence/migrations are assembled explicitly (SQLAlchemy + Alembic). |
| **Python** | — | Backend language | The lingua franca of the AI/ML ecosystem; the richest set of clients for vector stores, embedding/LLM providers, and async tooling. Trade-off: not the fastest runtime, mitigated by an async I/O-bound design where the cost is dominated by network calls to AI providers, not CPU. |
| **SQLAlchemy (async)** | — | ORM over PostgreSQL, async mode | Mature, expressive ORM with a robust async layer. Lets the relational trace chain (11 tables) be modeled cleanly. Trade-off: async SQLAlchemy has sharper edges than the sync API, but is necessary to keep the event loop unblocked. |
| **asyncpg** | — | PostgreSQL async driver | High-performance async PostgreSQL driver; pairs with async SQLAlchemy to avoid blocking the event loop on DB calls. Trade-off: PostgreSQL-specific. |
| **Alembic** | — | Database migrations | The standard migration tool for SQLAlchemy; gives versioned, reproducible schema evolution across the 11 tables. |
| **PostgreSQL** | 16 | Primary relational store; holds all relational state and the full trace chain | Battle-tested, reliable RDBMS with strong consistency and JSON support. Holds users, workspaces, documents, the full `messages → agent_runs → retrieved_chunks → evaluations` chain, and `llm_usage`. Trade-off: not a vector store, hence Qdrant is used alongside it. |
| **Redis** | 7 | Celery broker and result backend | Fast, simple, ubiquitous message broker for the async ingestion queue. Trade-off: in-memory durability characteristics, acceptable for a task queue. |
| **Celery** | — | Distributed task queue; runs async document ingestion (`process_document_task`, `max_retries=3`) | Lets heavy document processing (parse → chunk → embed → index) run off the request path so uploads never block users. Built-in retry semantics provide resilience for ingestion. Trade-off: operational overhead of a separate worker service, accepted for the decoupling it provides. |
| **Pydantic** | — | Request/response schemas and validation | Enforces typed contracts at the API boundary; integrates natively with FastAPI. Trade-off: validation has a cost, negligible relative to network/AI latency. |
| **JWT** | — | Authentication; roles `user`/`admin`/`super_admin` | Stateless, standard auth that scales horizontally without server-side session storage; carries the RBAC role. Trade-off: token revocation requires extra handling, standard for JWT systems. |
| **prometheus-client** | — | Exposes the `/metrics` endpoint scraped by Prometheus | The canonical way to instrument a Python service for Prometheus; the foundation of the RAGOps metrics backbone. |

---

## 3. AI Tier

| Technology | Version / config | Role | Why chosen (trade-offs) |
|---|---|---|---|
| **Ollama (`nomic-embed-text`)** | 768-d, batch 4 | Embedding generation for documents and queries | Self-hosted embeddings keep document content private — never sent to a third-party embedding API — directly serving the privacy differentiator. `nomic-embed-text` is a strong, compact 768-dimensional model. Trade-off: requires hosting the embedding runtime locally, accepted for data privacy. |
| **Qdrant** | 1.12.6 | Vector store; HNSW index, cosine distance | Purpose-built, self-hostable vector database with high-performance HNSW indexing and cosine similarity. Supports the hybrid (semantic + keyword) retrieval the platform uses. Trade-off: another service to operate, justified because PostgreSQL alone is not a first-class vector engine at this scale. |
| **Gemini 2.5 Flash** | fallback 2.0 Flash; temp 0.2, max 1000 tokens | Answer generation; real token streaming | Fast, capable generation model with native SSE token streaming via `streamGenerateContent?alt=sse`, which the live AI Execution Studio depends on. Low temperature (0.2) favors grounded, deterministic answers; a 2.0 Flash fallback adds resilience. Trade-off: generation is a hosted provider call (the generation step, unlike embeddings, is external), accepted in exchange for quality and low latency. |

> **Privacy architecture note:** document **embedding** is performed locally via Ollama, keeping document content private at index time; only the final **generation** step calls a hosted model with the assembled, retrieved context. This split is a deliberate privacy/quality trade-off.

---

## 4. Frontend Tier

| Technology | Version | Role | Why chosen (trade-offs) |
|---|---|---|---|
| **Next.js** | 15 (App Router) | Application framework; routing for all surfaces | The App Router provides modern routing and server/client component composition; mature ecosystem. Trade-off: App Router has a learning curve, accepted for its capabilities and longevity. |
| **React** | 19 | UI library | Latest React, pairing with Next.js 15; the foundation for the interactive, streaming-driven UI. |
| **TypeScript** | strict, 0 `any` | Language; static typing across the frontend | Strict mode with **zero `any`** enforces a fully typed codebase — critical for a complex app with streaming events, trace structures, and graph data. Trade-off: stricter typing slows initial authoring but eliminates whole classes of runtime errors. |
| **Tailwind CSS** | 3.4 | Styling foundation | Utility-first CSS enabling fast, consistent styling; the base layer beneath the Horizon design system. Trade-off: verbose markup, mitigated by component abstraction. |
| **Horizon design system** | custom | Token-based, shadcn-style component system (e.g., `StatusBadge`) | A custom design system ensures visual consistency across the many surfaces (dashboard, RAGOps, trace views, studio, explorer) and produces a polished, report-grade UI. Trade-off: building a design system is effort, repaid by consistency and velocity. |
| **TanStack React Query** | v5 | Server state management (fetching, caching, sync) | Purpose-built for server state: caching, invalidation, background refetch. Removes hand-rolled fetching logic and keeps the UI in sync with the backend. Trade-off: a mental model to learn, standard for modern React apps. |
| **Recharts** | — | Charts and metrics visualization | Declarative, React-native charting for dashboards and RAGOps/metrics surfaces. Trade-off: less customizable than low-level chart libraries, sufficient for the dashboards needed. |
| **Framer Motion** | 12 | Animation engine | Powers the AI Execution Studio's ten-stage animated pipeline and animated AI avatar, plus general motion. Trade-off: animation bundle cost, justified by the flagship visual experience. |
| **React Flow (`@xyflow/react`)** | 12 | Interactive node-graph for the Architecture Explorer | The standard for interactive, pannable, clickable node graphs — exactly what the Architecture Explorer's live request flow and node inspector require. Trade-off: a specialized dependency, but no simpler tool delivers the same interactive graph. |
| **Vitest + Testing Library** | — | Unit/component testing | Fast, Vite-native test runner with Testing Library's user-centric assertions; co-located tests (e.g., `helpers.test.ts`, `StatusBadge.test.tsx`). Trade-off: a newer ecosystem than Jest, chosen for speed and Vite alignment. |

---

## 5. Data Tier (Summary)

| Store | Version | Holds | Why |
|---|---|---|---|
| **PostgreSQL** | 16 | Relational state + full trace chain (11 tables) | Strong consistency for the auditable trace chain and accounting (`llm_usage`). |
| **Redis** | 7 | Celery broker + result backend | Fast queue for async ingestion. |
| **Qdrant** | 1.12.6 | Vector embeddings (HNSW + cosine) | Self-hosted, high-performance semantic + keyword retrieval. |

The three stores are specialized by purpose: a relational engine for state and traceability, an in-memory broker for task queuing, and a vector engine for retrieval. This separation lets each component be operated and scaled according to its own characteristics.

---

## 6. DevOps Tier

| Technology | Role | Why chosen (trade-offs) |
|---|---|---|
| **Docker** | Containerization of every service | Reproducible, isolated runtime for each of the eight services; the same image runs anywhere. Trade-off: image/build management overhead. |
| **Docker Compose** | Orchestration of the eight-service topology | Declares and wires the full system (postgres, redis, qdrant, backend, celery_worker, frontend, prometheus, grafana) for one-command local/dev deployment. Trade-off: Compose is single-host; production scale would graduate to Kubernetes (see future evolution). |

### The eight Docker services

| Service | Image / runtime |
|---|---|
| `postgres` | postgres:16 |
| `redis` | redis:7 |
| `qdrant` | qdrant 1.12.6 |
| `backend` | uvicorn serving FastAPI |
| `celery_worker` | Celery worker |
| `frontend` | Next.js |
| `prometheus` | Prometheus |
| `grafana` | Grafana |

---

## 7. Observability Tier

| Technology | Role | Why chosen (trade-offs) |
|---|---|---|
| **Prometheus** | Scrapes and stores backend metrics from the `prometheus-client` `/metrics` endpoint | The de-facto standard for time-series metrics; pull-based scraping fits the containerized topology. The metrics backbone for RAGOps. Trade-off: not optimized for high-cardinality data, standard for metrics. |
| **Grafana** | Dashboards and visualization over Prometheus data | The standard visualization layer for Prometheus; turns raw metrics into operational dashboards. Trade-off: an additional service, justified by the observability the RAGOps story requires. |

Together, `prometheus-client` → Prometheus → Grafana form the metrics pipeline that underpins the **RAGOps Control Tower**, complemented by the relational trace data (`agent_runs`, `evaluations`, `llm_usage`) for per-execution insight.

---

## 8. Cross-Cutting Themes in the Stack

- **Async everywhere.** FastAPI (async), SQLAlchemy (async) + asyncpg, and SSE streaming combine so the platform can stream tokens and ingest documents without blocking.
- **Self-hosting for privacy.** PostgreSQL, Redis, Qdrant, and Ollama embeddings are all self-hostable, keeping the organization's data under its control — the foundation of the differentiator vs. generic assistants.
- **Streaming as a first-class concern.** Gemini's `streamGenerateContent?alt=sse`, FastAPI's `StreamingResponse`, and the frontend's `fetch` + `ReadableStream` form an end-to-end real token-streaming path that drives the AI Execution Studio.
- **Observability by design.** prometheus-client, Prometheus, Grafana, and the persisted trace chain make the platform measurable and auditable, not a black box.
- **Type safety end to end.** Pydantic on the backend and strict TypeScript (zero `any`) on the frontend enforce typed contracts across the boundary.

---

## 9. Summary

DevPilot AI's stack is a coherent, production-grade selection: an async FastAPI/Python backend over PostgreSQL 16, Redis 7, and Qdrant 1.12.6; self-hosted Ollama embeddings with Gemini 2.5 Flash generation; a Next.js 15 / React 19 / strict-TypeScript frontend with the Horizon design system, React Query v5, Recharts, Framer Motion 12, and React Flow 12; all containerized with Docker Compose across eight services and observed with Prometheus + Grafana. Each choice is justified by the platform's three pillars — async streaming, self-hosted privacy, and observability.
