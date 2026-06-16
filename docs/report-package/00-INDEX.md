# DevPilot AI — Report Knowledge Package

This package is the single, real-data source of truth for the DevPilot AI
engineering report. Every file is grounded in the actual codebase (real tables,
routes, config, agents, phases and features) — no invented metrics. Diagrams are
authored in **Mermaid**; screenshot slots are clearly marked placeholders.

**Project:** DevPilot AI — a production-grade, multi-workspace **Agentic RAG
platform** for engineering teams, with enterprise observability (RAGOps),
full traceability (Trace Explorer/Inspector), automatic evaluation, and flagship
visualizations (AI Execution Studio + Architecture Explorer).

## Files

| # | File | Contents |
|---|---|---|
| 01 | [01-project-overview.md](01-project-overview.md) | Project, goal, problem, value/differentiator, innovations |
| 02 | [02-system-architecture.md](02-system-architecture.md) | High-level, backend, frontend, RAG, RAGOps, traceability, studio — with Mermaid diagrams |
| 03 | [03-phases.md](03-phases.md) | The 23-phase progression (objective / features / choices / challenges / results) |
| 04 | [04-database-design.md](04-database-design.md) | ERD, SQL DDL, constraints, cardinalities (11 tables) |
| 05 | [05-api-specification.md](05-api-specification.md) | Auth, Workspace, Document, RAG, Chat, Streaming, Admin, RAGOps, Trace APIs |
| 06 | [06-uml-package.md](06-uml-package.md) | Use cases, sequence, class, component, deployment, traceability diagrams |
| 07 | [07-screenshots-package.md](07-screenshots-package.md) | Per-page objective / actions / expected result + screenshot placeholders |
| 08 | [08-technology-stack.md](08-technology-stack.md) | Full stack by tier, with rationale and versions |
| 09 | [09-testing-results.md](09-testing-results.md) | Backend, frontend (39 Vitest), API, streaming, performance, evaluation, manual tests |
| 10 | [10-ai-execution-studio.md](10-ai-execution-studio.md) | Purpose, architecture, workflow, innovation, visualization engine |
| 11 | [11-ragops.md](11-ragops.md) | Health, embedding coverage, retrieval quality, faithfulness, hallucination, workspace health, agents, failures |
| 12 | [12-rag-traces.md](12-rag-traces.md) | Trace lifecycle, message tracking, chunks, citations, evaluations, auditability, reproducibility |
| 13 | [13-business-value.md](13-business-value.md) | Problem, users, limitations, competitive advantage, future, impact |

## How to use

1. Feed these files (in order) to the report generator, or paste section-by-section into the LaTeX report at [`rapport/rapport_devpilot_ai.tex`](../../rapport/rapport_devpilot_ai.tex).
2. Replace every `📸 [SCREENSHOT PLACEHOLDER]` with a real capture from the running app (`docker compose up`, then the routes in File 07).
3. Mermaid diagrams render on GitHub and in most Markdown/LaTeX toolchains; for the LaTeX report, export them to images or re-draw as TikZ.

## Quick facts (real)

- **Stack:** FastAPI · PostgreSQL 16 · Redis 7 · Celery · Qdrant 1.12.6 · Ollama (nomic-embed-text, 768-d) · Gemini 2.5 Flash · JWT · Next.js 15 · React 19 · TypeScript · Tailwind · React Query · Framer Motion · React Flow · Docker Compose (8 services) · Prometheus + Grafana.
- **Pipeline:** 7-agent `AgenticRAGWorkflow` — router → query_rewriter → retrieval → reranker → generator → evaluator → corrector.
- **Data model:** 11 tables; traceability chain `message → agent_runs → retrieved_chunks → evaluations`.
- **Retrieval:** hybrid (semantic + keyword), 15 candidates → rerank → top 5; Qdrant HNSW + cosine.
- **Streaming:** real SSE token streaming; events start/trace/token/citations/evaluation/correction/message/done/error.
