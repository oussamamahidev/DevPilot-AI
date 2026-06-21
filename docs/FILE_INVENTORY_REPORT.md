# DevPilot AI — Complete File Inventory Report

Generated from the repository state on 2026-06-19. The baseline inventory contains **450 files** (excluding `.git/` internals). Every baseline file is listed below. Text/source files were inspected by content and structure; PDFs were text-extracted and identified; the ZIP was listed and compared with its extracted tree; generated artifacts and lockfiles were classified rather than reproduced. Secret values from `.env` are intentionally not shown.

## Executive summary

DevPilot AI is a full-stack private-document intelligence platform. A Next.js 15/React 19 frontend calls a FastAPI backend. PostgreSQL stores users, workspaces, documents, conversations, RAG traces, evaluations, usage, and audit records. Celery/Redis perform asynchronous document ingestion. Ollama supplies local embeddings (and optionally generation/reranking), Gemini can generate answers, and Qdrant stores/searches vectors. The product includes JWT authentication, tenant-scoped workspaces, admin RBAC, streaming chat, agentic RAG, evaluation, RAGOps, trace inspection, Prometheus/Grafana observability, and extensive tests/documentation.

Main execution flow:

1. A user uploads a PDF/TXT/Markdown document into a workspace.
2. Celery extracts and cleans text, chunks it, creates embeddings, and writes vectors to Qdrant plus chunk records to PostgreSQL.
3. Chat chooses/rephrases a query, retrieves semantically/lexically, reranks, generates a cited answer, evaluates it, optionally corrects it, and persists the full trace.
4. User and admin interfaces expose chat, document state, operational health, quality analytics, traces, users, workspaces, and audit logs.

## Important findings

- `.env` is a real configuration file and may contain live credentials. It should remain ignored, never be committed, and any previously exposed keys should be rotated.
- `bad.exe` is **not an executable binary**. It is a 15-byte plain-text file containing `bad executable`; it appears to be a stray test/junk artifact.
- The two PDFs under `backend/storage/.../pfa-av.pdf` are byte-for-byte duplicates of `phases/AVANCEMENT1.pdf`. They are uploaded runtime data, not source code.
- `rapport/pfaFinal.zip` is an archive of the nearby `rapport/pfe/` LaTeX/diagram package. Keeping both is redundant unless the ZIP is a delivery artifact.
- `backend/devpilot_backend.egg-info/`, `frontend/tsconfig.tsbuildinfo`, and both `.last-run.json` files are generated artifacts. They normally should not be treated as hand-maintained source.
- The repository contains some compatibility/re-export shims that are only one line long. These preserve old import paths while the newer feature/layout structure is used.

## Root files

- `.env` — Live local environment settings for app identity, JWT secret, PostgreSQL, Redis, Qdrant, Gemini/Ollama/OpenAI, retrieval, uploads, ports, CORS, Prometheus, and Grafana. Values are sensitive and omitted here.
- `.env.example` — Safe template documenting the same backend/infrastructure variables and defaults expected for local or Docker deployment.
- `.gitignore` — Excludes environment files, Python caches/virtualenvs, frontend dependencies/build output, test caches, local storage, and IDE/OS noise.
- `Makefile` — Developer shortcuts for Docker lifecycle/logs, full/phase-specific Pytest suites, coverage, backend/frontend dev servers, dependency installation, and Alembic migration/revision commands.
- `README.md` — Primary project guide: product goals, architecture, stack, setup, environment, Docker commands, migrations, API flows, testing, and project structure.
- `bad.exe` — Misnamed plain-text junk/test file; contains only `bad executable` and performs nothing.
- `docker-compose.yml` — Orchestrates PostgreSQL, Redis, Qdrant, FastAPI, Celery, Next.js, Prometheus, and Grafana with health checks, ports, volumes, environment wiring, and host access to Ollama.
- `package.json` — Minimal root npm manifest containing only TanStack React Query; the actual frontend manifest lives in `frontend/`.
- `package-lock.json` — npm lockfile for the minimal root dependency graph; generated for reproducible installs.
- `pytest.ini` — Root integration-test configuration and markers for live stack, ingestion, RAG, slow, and frontend tests.
- `test-results/.last-run.json` — Generated Playwright-style last-run status metadata; not application logic.

## Backend build, database migrations, and package metadata

- `backend/.dockerignore` — Prevents caches, virtualenvs, tests, local env files, storage, and build artifacts from entering the backend Docker context.
- `backend/Dockerfile` — Builds a Python 3.12 slim image, installs the editable FastAPI package, copies app/scripts/Alembic files, exposes port 8000, and starts Uvicorn.
- `backend/alembic.ini` — Alembic paths, migration naming, default async PostgreSQL URL, and logging configuration.
- `backend/alembic/README` — Marks the directory as the Alembic migration environment.
- `backend/alembic/env.py` — Loads models/settings and runs online or offline migrations using SQLAlchemy’s async engine.
- `backend/alembic/script.py.mako` — Template used by Alembic when generating new revision files.
- `backend/alembic/versions/.gitkeep` — Keeps the migration directory present in Git; no runtime behavior.
- `backend/alembic/versions/2026_05_10_1801_67cde1c99923_initial_schema.py` — Creates/drops the initial users, workspaces, memberships, documents, chunks, conversations, messages, retrieval, agent-run, usage, and related indexes/constraints.
- `backend/alembic/versions/2026_05_13_1200_phase12_answer_evaluation.py` — Adds/removes answer-evaluation persistence for RAG quality metrics.
- `backend/alembic/versions/2026_05_18_1200_admin_rbac.py` — Adds admin RBAC/user status fields and the audit-log table with supporting indexes.
- `backend/alembic/versions/2026_05_18_1300_admin_role_constraint.py` — Adds/removes a database check constraint limiting valid user roles.
- `backend/alembic/versions/2026_05_18_1400_admin_user_defaults.py` — Sets admin/user role and active-state defaults and repairs legacy null/default behavior.
- `backend/pyproject.toml` — Python package metadata, runtime/dev dependencies, Python 3.11+ requirement, Pytest async mode, setuptools discovery, and Ruff configuration.
- `backend/devpilot_backend.egg-info/PKG-INFO` — Generated installed-package metadata mirroring `pyproject.toml`.
- `backend/devpilot_backend.egg-info/SOURCES.txt` — Generated list of files included in the Python source distribution.
- `backend/devpilot_backend.egg-info/dependency_links.txt` — Generated, currently empty dependency-link metadata.
- `backend/devpilot_backend.egg-info/requires.txt` — Generated flattened runtime and optional dependency requirements.
- `backend/devpilot_backend.egg-info/top_level.txt` — Generated declaration that `app` is the package’s top-level module.

## Backend application foundation

- `backend/app/__init__.py` — Marks `app` as a Python package.
- `backend/app/main.py` — FastAPI application factory/lifespan: configures logging, validates startup settings, installs CORS/observability/exceptions, mounts all routers, and exposes metrics.
- `backend/app/core/__init__.py` — Core package marker.
- `backend/app/core/config.py` — Pydantic settings model for databases, providers, generation, embeddings, retrieval, uploads, auth, CORS, and operational defaults; provides cached and safely loggable settings.
- `backend/app/core/exceptions.py` — Defines structured application errors and FastAPI handlers for app, HTTP, and unexpected exceptions.
- `backend/app/core/logging.py` — JSON log formatter and centralized logging setup.
- `backend/app/core/metrics.py` — Declares Prometheus counters/histograms/gauges for HTTP, RAG stages, LLM usage, provider failures, ingestion, and vector operations.
- `backend/app/core/observability.py` — Request middleware that assigns request IDs, logs latency/context, updates HTTP metrics, and returns Prometheus exposition output.
- `backend/app/core/security.py` — Password hashing/verification and signed JWT access-token creation.
- `backend/app/db/__init__.py` — Database package marker.
- `backend/app/db/base.py` — SQLAlchemy declarative `Base` shared by all ORM models.
- `backend/app/db/session.py` — Async SQLAlchemy engine/session factory plus FastAPI database-session dependency.

## Backend models

- `backend/app/models/__init__.py` — Imports/re-exports every ORM model so Alembic discovers complete metadata.
- `backend/app/models/mixins.py` — Reusable UUID primary-key and created/updated timestamp columns.
- `backend/app/models/user.py` — `User` entity with identity, password hash, role, active state, relationships, and validation constraints.
- `backend/app/models/workspace.py` — `Workspace` and `WorkspaceMember` tenant/membership entities and role relationships.
- `backend/app/models/document.py` — `Document` upload/processing state and `Chunk` extracted-text records with metadata and relationships.
- `backend/app/models/conversation.py` — Conversation, message, retrieved-chunk trace, agent run, answer evaluation, and LLM usage entities.
- `backend/app/models/audit.py` — Immutable admin/security audit record with actor, action, target, reason, request, and metadata fields.

## Backend API dependencies and routes

- `backend/app/api/__init__.py` — API package marker.
- `backend/app/api/dependencies/__init__.py` — Re-exports authentication and authorization dependencies.
- `backend/app/api/dependencies/auth.py` — Decodes bearer JWTs, loads active users, and enforces admin/super-admin access.
- `backend/app/api/dependencies/documents.py` — Loads a document and guarantees it belongs to an accessible workspace.
- `backend/app/api/dependencies/workspaces.py` — Resolves workspace membership and enforces member/owner authorization.
- `backend/app/api/routes/__init__.py` — Collects and exposes all route modules for app registration.
- `backend/app/api/routes/health.py` — Lightweight health endpoint confirming the API is running.
- `backend/app/api/routes/auth.py` — Registration, login, and current-user endpoints with password/JWT handling and audit context.
- `backend/app/api/routes/workspaces.py` — Authenticated workspace create/list/get/update/delete endpoints with ownership checks.
- `backend/app/api/routes/documents.py` — Workspace upload/list plus document detail/status/delete endpoints; delegates storage and background ingestion.
- `backend/app/api/routes/retrieval.py` — Workspace-scoped semantic/keyword/hybrid retrieval search endpoint.
- `backend/app/api/routes/chat.py` — Synchronous and SSE streaming RAG chat, conversation history/detail, and per-message evaluation endpoints.
- `backend/app/api/routes/system.py` — Safe AI configuration plus AI, vector, Redis, Celery, Qdrant, and combined operational health endpoints.
- `backend/app/api/routes/admin.py` — Admin statistics and paginated users/workspaces/documents/audit/errors APIs; role, activation, and destructive management actions.
- `backend/app/api/routes/ragops.py` — Admin RAGOps workspace/document pipeline, chunk inspection, retry, and Qdrant health APIs.
- `backend/app/api/routes/rag_traces.py` — Admin trace list/detail, retrieval/reranking/evaluation drill-down, and quality-summary APIs.

## Backend schemas

- `backend/app/schemas/__init__.py` — Schema package exports.
- `backend/app/schemas/auth.py` — Validated registration/login inputs and token/current-user outputs.
- `backend/app/schemas/workspace.py` — Workspace create/update/member/response contracts, including name/description validation.
- `backend/app/schemas/document.py` — Document detail and processing-status response contracts.
- `backend/app/schemas/retrieval.py` — Retrieval request strategy/top-k and ranked chunk response contracts.
- `backend/app/schemas/chat.py` — Chat query, citations, answer evaluation, messages, conversation summaries, and conversation detail contracts.
- `backend/app/schemas/admin.py` — Admin mutation reasons, dashboard statistics, pagination, user/workspace/document/audit/error detail contracts.
- `backend/app/schemas/ragops.py` — RAGOps workspace health, pipeline stages, chunk inspection, retry, job/query/evaluation, and Qdrant health contracts.
- `backend/app/schemas/rag_traces.py` — Trace list/detail, citations, retrieval, reranking, evaluation, agent latency, corrector decisions, and quality-summary contracts.

## Backend AI providers and agent workflow

- `backend/app/providers/__init__.py` — Re-exports provider interfaces, errors, responses, implementations, and factory.
- `backend/app/providers/base.py` — Provider-neutral embedding/LLM response types, exceptions, abstract embedding API, and async text-stream chunk helper.
- `backend/app/providers/factory.py` — Selects Gemini or Ollama generation according to settings and rejects unsupported provider names.
- `backend/app/providers/gemini_provider.py` — Gemini REST client for normal/streamed chat with payload conversion, token usage, timeouts, retries/backoff, fallback model, thinking controls, error classification, and metrics/logging.
- `backend/app/providers/ollama_provider.py` — Ollama embedding and generation clients supporting batch embeddings, normal/streamed chat, token extraction, timeouts, and provider errors.
- `backend/app/agents/__init__.py` — Exposes the agentic RAG workflow, result type, and insufficient-context fallback.
- `backend/app/agents/rag.py` — Core multi-stage agentic workflow: routing, query rewriting, retrieval, reranking, generation, evaluation, correction, evidence/citation checks, extractive fallback, technical-term grounding, metrics, and serializable stage traces.

## Backend services and utilities

- `backend/app/services/__init__.py` — Services package marker.
- `backend/app/services/ai/__init__.py` — Legacy AI subpackage marker.
- `backend/app/services/ai/ollama.py` — Compatibility re-export of the Ollama providers from their newer location.
- `backend/app/services/workspace_service.py` — CRUD and membership queries for user-accessible workspaces.
- `backend/app/services/document_service.py` — Validates uploads, writes files, creates document rows, queues processing, lists/deletes documents, and removes vectors/storage safely.
- `backend/app/services/vector_store_service.py` — Creates/validates the Qdrant collection, embeds in retryable batches, upserts/searches/deletes vectors, and reports collection health.
- `backend/app/services/retrieval_service.py` — Semantic, keyword, and hybrid reciprocal-rank retrieval with tenant filtering and PostgreSQL text-overlap fallback when vectors fail.
- `backend/app/services/reranking_service.py` — Optional Ollama reranker with structured parsing, plus deterministic lexical/score heuristics and top-k selection.
- `backend/app/services/evaluation_service.py` — Scores answer faithfulness, relevance, and context precision through Ollama or heuristics; parses/clamps results and stores evaluations.
- `backend/app/services/chat_service.py` — Orchestrates synchronous/streaming chat, the agent workflow, SSE stage events, retrieval/reranking, prompts/context/citations, persistence, token metrics, and conversation queries.
- `backend/app/services/admin_service.py` — Admin dashboard aggregates, paginated/searchable entity queries, RBAC-safe user changes, cascading deletions, audit logging, usage/RAG/error statistics, and serialization helpers.
- `backend/app/services/ragops_service.py` — Computes workspace/ingestion/vector health, document pipeline details, chunk pages, retry eligibility/actions, Qdrant diagnostics, recent activity, and operational summaries.
- `backend/app/services/rag_traces_service.py` — Builds/filter/paginates complete RAG traces and quality summaries from messages, retrievals, evaluations, agent runs, latency, citations, and usage records.
- `backend/app/utils/__init__.py` — Utility package marker.
- `backend/app/utils/chunker.py` — Token-aware overlapping chunk creation with tiktoken fallback and boundary-sensitive splitting.
- `backend/app/utils/text_cleaner.py` — Normalizes extracted prose while preserving code fences and removing repeated page-number artifacts.

## Backend background work and scripts

- `backend/app/workers/__init__.py` — Worker package marker.
- `backend/app/workers/celery_app.py` — Configures Celery against Redis, task routing/serialization, and worker-start AI configuration logging.
- `backend/app/workers/document_tasks.py` — Retriable ingestion task: loads documents, extracts PDF/text, cleans/chunks, replaces DB chunks, embeds/upserts Qdrant vectors, updates status, and records failures/metrics.
- `backend/scripts/create_super_admin.py` — CLI that validates credentials, creates or upgrades a super-admin account, and returns useful exit codes.

## Backend runtime storage

- `backend/storage/597bcc64-da1c-488c-a0b3-9306fad5ffea/62dd3b5f-00b5-4255-bae5-5cbb97ba4309/pfa-av.pdf` — Uploaded 39-page French DevPilot progress report through phase 8; exact duplicate of `phases/AVANCEMENT1.pdf`.
- `backend/storage/597bcc64-da1c-488c-a0b3-9306fad5ffea/cfd59ee3-36b6-40f4-bbe2-d577d7f454bb/pfa-av.pdf` — Second uploaded copy of the same 39-page phase-1-to-8 progress report.

## Backend tests

- `backend/tests/__init__.py` — Marks backend tests as a package.
- `backend/tests/conftest.py` — Shared fixtures that configure a safe test environment, build the FastAPI app/client, and provide database/provider doubles.
- `backend/tests/integration/test_admin_rbac.py` — Integration coverage for admin/super-admin roles, access rules, role changes, self-protection, audit logs, and destructive operations.
- `backend/tests/integration/test_phase_23_streaming_chat.py` — Integration coverage for the SSE chat protocol, stage ordering, persistence, citations/evaluation, failures, disconnects, and conversation reuse.
- `backend/tests/test_admin_routes.py` — Unit/API tests for every admin dashboard/list/detail/mutation endpoint and permission/error behavior.
- `backend/tests/test_agentic_rag_workflow.py` — Tests routing, rewriting, retrieval, reranking, generation, evaluation, correction, insufficient evidence, citations, and technical grounding.
- `backend/tests/test_auth.py` — Registration/login/current-user, duplicate accounts, invalid credentials, JWTs, disabled users, and validation tests.
- `backend/tests/test_chat_route.py` — Chat and streaming route contracts, authorization, SSE formatting, conversations, and message evaluation tests.
- `backend/tests/test_chat_service.py` — Chat orchestration, prompt/context/citation construction, conversation persistence, and provider interaction tests.
- `backend/tests/test_documents.py` — Upload/list/detail/status/delete tests covering file validation, tenancy, task dispatch, storage, and cleanup.
- `backend/tests/test_evaluation_service.py` — LLM/heuristic evaluation parsing, scoring, fallbacks, persistence, and missing-record tests.
- `backend/tests/test_gemini_provider.py` — Gemini payloads, normal/streamed responses, token usage, retries, fallback models, timeouts, and error classification tests.
- `backend/tests/test_health.py` — Basic health and application setup tests.
- `backend/tests/test_models.py` — Sanity checks for ORM model metadata and table registration.
- `backend/tests/test_ollama_provider.py` — Ollama embedding/chat/stream response, batching, usage, and error/timeout tests.
- `backend/tests/test_provider_factory.py` — Provider selection and invalid-provider tests.
- `backend/tests/test_reranking_service.py` — Heuristic and optional Ollama reranking behavior tests.
- `backend/tests/test_retrieval_fallback.py` — PostgreSQL text-overlap fallback and tenant-isolation tests when vector search is unavailable.
- `backend/tests/test_retrieval_route.py` — Retrieval endpoint validation, authorization, strategies, and service delegation tests.
- `backend/tests/test_retrieval_service.py` — Semantic/keyword/hybrid ranking, RRF merging, filters, result hydration, and failure behavior tests.
- `backend/tests/test_system_ai.py` — Safe AI config and AI/vector/ops health response tests with dependency failures.
- `backend/tests/test_text_processing.py` — Cleaner and token-aware chunker behavior, overlap, code fences, and artifact removal tests.
- `backend/tests/test_vector_store.py` — Qdrant collection, dimension checks, batching, retries, upsert/search/delete, and health tests.
- `backend/tests/test_workspaces.py` — Workspace CRUD, validation, membership, ownership, authorization, and deletion tests.

## Frontend build and global application files

- `frontend/.dockerignore` — Excludes dependencies, Next build output, env files, logs, and test artifacts from the frontend image context.
- `frontend/.env.example` — Template for frontend port, public backend URL, frontend URL, and backend CORS origin.
- `frontend/Dockerfile` — Node 22 Alpine image that runs `npm install`, copies the app, exposes 3000, and starts Next development mode.
- `frontend/MIGRATION.md` — Notes for migrating legacy pages/components to the Horizon shell, design tokens, providers, and route protection patterns.
- `frontend/app/globals.css` — Global reset and Horizon design-system CSS variables for light/dark themes, colors, typography, surfaces, focus, status, scrollbars, and animation.
- `frontend/app/icon.svg` — Small violet DevPilot application/favicon mark.
- `frontend/app/layout.tsx` — Root Next layout defining metadata, loading global CSS, and wrapping the app in shared providers.
- `frontend/app/page.tsx` — Public landing page that composes navigation, hero, problem, features, workflow, architecture, RAGOps, trace, differentiation, stack, CTA, and footer sections.
- `frontend/next-env.d.ts` — Generated Next.js TypeScript declarations; should not be edited manually.
- `frontend/next.config.ts` — Enables React strict mode.
- `frontend/eslint.config.mjs` — ESLint flat configuration using Next core-web-vitals and TypeScript presets with generated directories ignored.
- `frontend/postcss.config.js` — PostCSS wiring for Tailwind CSS and Autoprefixer.
- `frontend/tailwind.config.ts` — Horizon semantic theme tokens, raw data-visualization palette, fonts, radius, shadow, animation, class-based dark mode, and source scanning.
- `frontend/tsconfig.json` — Strict no-emit TypeScript/Next configuration with bundler resolution and `@/*` path alias; excludes tests from the production typecheck.
- `frontend/tsconfig.tsbuildinfo` — Generated incremental TypeScript compiler cache, not source.
- `frontend/vitest.config.mts` — Vitest jsdom setup, React transform, alias, test patterns, and exclusions.
- `frontend/vitest.setup.ts` — Adds Testing Library DOM matchers and shared browser-test setup.
- `frontend/package.json` — Frontend scripts and pinned ranges for Next/React, Query, React Flow, Framer Motion, Recharts, Tailwind, ESLint, TypeScript, Testing Library, and Vitest.
- `frontend/package-lock.json` — Generated full npm dependency lock graph for reproducible frontend installs.
- `frontend/test-results/.last-run.json` — Generated last-test-run status metadata.

## Frontend routes

- `frontend/app/auth/page.tsx` — Minimal placeholder page stating that this is the authentication module; it is not the implemented login route.
- `frontend/app/login/page.tsx` — Sign-in form with field validation, password visibility, API error handling, redirects, and links to registration/recovery.
- `frontend/app/register/page.tsx` — Account-creation form with client validation, password rules/confirmation, API registration, and login transition.
- `frontend/app/forgot-password/page.tsx` — Informational password-recovery form/page; presents a safe UX even though full reset backend support is limited.
- `frontend/app/session-expired/page.tsx` — Explains expired authentication, clears/restarts navigation, and directs users to sign in again.
- `frontend/app/dashboard/page.tsx` — Main authenticated operational dashboard with personal/workspace summaries, recent activity, charts, documents, queries, and quick actions.
- `frontend/app/chat/page.tsx` — General chat UI with workspace selection, conversation history, streaming answers/stages, citations, evaluations, errors, and composer behavior.
- `frontend/app/documents/page.tsx` — General document management UI with workspace filtering, upload, list/grid status, polling, deletion, and empty/error/loading states.
- `frontend/app/settings/page.tsx` — Protected settings route rendering the consolidated `SettingsContent` experience.
- `frontend/app/workspaces/[workspaceId]/page.tsx` — Workspace overview with details, member/owner context, and navigation to its documents and chat.
- `frontend/app/workspaces/[workspaceId]/documents/page.tsx` — Workspace-specific document page using the reusable documents panel.
- `frontend/app/workspaces/[workspaceId]/chat/page.tsx` — Workspace-specific conversation UI with SSE pipeline progress, citations, evaluation, history, retry, and responsive layout.
- `frontend/app/ai-execution-studio/page.tsx` — Protected, dynamic client-only route for visually replaying an AI pipeline execution.
- `frontend/app/architecture-explorer/page.tsx` — Interactive high-level architecture graph with legend, navigation, selected-node inspector, and React Flow canvas.
- `frontend/app/architecture-explorer/[component]/page.tsx` — Dynamic deep-link view that selects and explains one architecture component and its relationships.
- `frontend/app/admin/page.tsx` — Admin command center with platform KPIs, document status, RAG/agent health, activity, errors, and management links.
- `frontend/app/admin/users/page.tsx` — Paginated/filterable user administration with role/status actions and confirmation dialogs.
- `frontend/app/admin/users/[id]/page.tsx` — User detail, workspace/audit context, role and activation management, and deletion controls.
- `frontend/app/admin/workspaces/page.tsx` — Paginated/searchable workspace administration and destructive management.
- `frontend/app/admin/workspaces/[id]/page.tsx` — Workspace owner/member/document detail plus admin deletion action.
- `frontend/app/admin/documents/page.tsx` — Paginated/filterable platform document table with status/owner/workspace context and deletion.
- `frontend/app/admin/documents/[id]/page.tsx` — Document metadata, ingestion state, ownership, and admin deletion detail page.
- `frontend/app/admin/audit-logs/page.tsx` — Paginated/searchable audit trail with action/actor/target filters and destructive-action highlighting.
- `frontend/app/admin/quality/page.tsx` — RAG quality dashboard for faithfulness/relevance/context precision, risk counters, trends, and worst messages.
- `frontend/app/admin/settings/page.tsx` — Admin-only wrapper around settings with admin navigation context.
- `frontend/app/admin/ragops/page.tsx` — RAGOps control tower listing workspace ingestion/vector health and operational risk.
- `frontend/app/admin/ragops/workspaces/[id]/page.tsx` — Detailed workspace RAGOps view: status counts, chunking, embeddings, ingestion jobs, failures, recent queries, evaluations, and agent latency.
- `frontend/app/admin/ragops/documents/[id]/page.tsx` — Document pipeline/chunk inspector with stage status, Qdrant facts, pagination, metadata, and retry controls.
- `frontend/app/admin/rag-traces/page.tsx` — Trace observatory with server filters/pagination and trace health visualizations.
- `frontend/app/admin/rag-traces/[messageId]/page.tsx` — Full trace inspector for one answer, including flow, retrieval, reranking, generation, correction, evaluation, citations, latency, and token usage.

## Frontend legacy/shared top-level components

- `frontend/components/.gitkeep` — Keeps the component directory in Git; no behavior.
- `frontend/components/ApiStatus.tsx` — Fetches and displays backend availability.
- `frontend/components/DashboardShell.tsx` — Older dashboard wrapper providing navbar/main layout.
- `frontend/components/DocumentList.tsx` — Reusable list of workspace documents with status, dates, selection, and deletion callbacks.
- `frontend/components/DocumentUploadForm.tsx` — File picker/drop upload form with type/size validation, progress/disabled states, and error reporting.
- `frontend/components/ErrorMessage.tsx` — Small standardized error text block.
- `frontend/components/LoadingState.tsx` — Small standardized loading indicator.
- `frontend/components/Navbar.tsx` — Older authenticated navigation/header with route links and logout.
- `frontend/components/WorkspaceDocumentsPanel.tsx` — Combines workspace document loading, upload, polling/status, list, deletion, and feedback.

## Frontend admin, AI-answer, auth, and data components

- `frontend/components/admin/AdminCharts.test.ts` — Verifies chart transformation/formatting helpers and representative admin chart rendering.
- `frontend/components/admin/AdminCharts.tsx` — Recharts visualizations for admin trends, document states, usage, and performance with shared tooltip/theme behavior.
- `frontend/components/admin/AdminUI.tsx` — Admin-specific stat cards, panels, tables, badges, section headers, empty/loading/error states, and action primitives.
- `frontend/components/admin/AnalyticsUI.tsx` — Large analytics component library for KPI grids, time-series/bars/donuts, distributions, legends, tooltips, trend and quality visualizations.
- `frontend/components/admin/DataView.tsx` — Generic server-data wrapper coordinating loading, error, empty, results, and pagination states.
- `frontend/components/ai/AnswerMeta.tsx` — Displays answer timing, model/provider, tokens, pipeline status, and evaluation metadata.
- `frontend/components/ai/ChatMarkdown.tsx` — Lightweight safe markdown-like renderer for paragraphs, headings, lists, code, links, and inline citation markers.
- `frontend/components/ai/CitationCard.tsx` — Source citation card showing filename, page/chunk, score, excerpt, and interaction state.
- `frontend/components/ai/EvaluationBadge.tsx` — Compact quality score/label badge.
- `frontend/components/ai/EvaluationMetrics.tsx` — Faithfulness, relevance, and context-precision metric display.
- `frontend/components/ai/PipelineStepper.tsx` — Horizontal/vertical visualization of RAG stages and current/completed/error state.
- `frontend/components/ai/ProgressRing.tsx` — SVG circular progress/score indicator.
- `frontend/components/ai/TraceFlow.tsx` — Compact visual chain of trace stages.
- `frontend/components/ai/index.ts` — Barrel exports for the AI answer/trace components.
- `frontend/components/auth/AuthError.tsx` — Accessible authentication error alert.
- `frontend/components/auth/AuthField.tsx` — Labeled form-field wrapper with hints, errors, icons, and accessibility IDs.
- `frontend/components/auth/AuthLayout.tsx` — Shared branded split-screen/card layout for authentication routes.
- `frontend/components/auth/PasswordField.tsx` — Password input with reveal toggle and field integration.
- `frontend/components/auth/validators.ts` — Email/password/name validation and error normalization used by auth forms.
- `frontend/components/charts/index.ts` — Re-exports chart components from the admin analytics module.
- `frontend/components/data/FilterBar.tsx` — Layout wrapper for search/filter controls and result actions.
- `frontend/components/data/Pagination.tsx` — Previous/next and page-count navigation with disabled/accessibility behavior.
- `frontend/components/data/SearchInput.tsx` — Search box with icon and clear action.
- `frontend/components/data/SortableHeader.tsx` — Clickable table heading showing ascending/descending/unsorted state.
- `frontend/components/data/index.ts` — Barrel exports for filter, pagination, search, and sorting components.
- `frontend/components/documents/index.ts` — Re-exports document list, upload form, and workspace panel from legacy locations.

## Frontend landing-page components

- `frontend/components/landing/LandingNav.tsx` — Responsive public navigation, section links, mobile menu, and sign-in/get-started actions.
- `frontend/components/landing/HeroSection.tsx` — Main product proposition, animated agentic-RAG visual, calls to action, and trust indicators.
- `frontend/components/landing/ProblemSection.tsx` — Animated comparison of conventional document search problems and DevPilot solutions.
- `frontend/components/landing/FeaturesSection.tsx` — Product feature cards for private RAG, traceability, quality, operations, security, and streaming.
- `frontend/components/landing/HowItWorksSection.tsx` — Animated step-by-step ingestion-to-answer pipeline explanation.
- `frontend/components/landing/ArchitectureSection.tsx` — Layered frontend/API/data/AI architecture visualization with connectors and explanatory text.
- `frontend/components/landing/RAGOpsSection.tsx` — Marketing/visual section for workspace health, indexing, failures, and operational RAG controls.
- `frontend/components/landing/TraceSection.tsx` — Demonstrates inspectable retrieval, reranking, generation, evaluation, and latency traces.
- `frontend/components/landing/WhyDifferentSection.tsx` — Capability comparison table contrasting DevPilot with basic chat/search approaches.
- `frontend/components/landing/TechStackSection.tsx` — Displays the core technology stack and local/cloud provider choices.
- `frontend/components/landing/CTASection.tsx` — Closing conversion section with registration/demo navigation.
- `frontend/components/landing/LandingFooter.tsx` — Public footer with product identity and navigation/legal placeholders.

## Frontend layout and shell

- `frontend/components/layout/AdminRoute.tsx` — Client guard that requires authenticated admin access and handles loading/redirect/denied states.
- `frontend/components/layout/AdminSidebar.tsx` — Legacy/admin-specific navigation links and active-route styling.
- `frontend/components/layout/AppLayout.tsx` — Simple legacy layout that renders the older navbar above page children.
- `frontend/components/layout/AppShell.tsx` — One-line re-export of the newer shell implementation.
- `frontend/components/layout/Breadcrumbs.tsx` — Legacy breadcrumb renderer based on the current pathname.
- `frontend/components/layout/DashboardShell.tsx` — One-line compatibility re-export of the older top-level dashboard shell.
- `frontend/components/layout/MainHeader.tsx` — One-line compatibility re-export of the shell top bar.
- `frontend/components/layout/Navbar.tsx` — One-line compatibility re-export of the top-level navbar.
- `frontend/components/layout/PageContainer.tsx` — Consistent responsive page-width and padding wrapper.
- `frontend/components/layout/ProtectedRoute.tsx` — Authentication guard with loading, expired-session handling, and redirect-to-login behavior.
- `frontend/components/layout/Sidebar.tsx` — Compact legacy/sidebar navigation organized by main and admin links.
- `frontend/components/layout/index.ts` — Barrel exports for layout guards, shell, breadcrumbs, sidebar, and page container.
- `frontend/components/shell/AppShell.tsx` — Current responsive application frame combining sidebar, topbar, breadcrumbs, command palette, and notification center.
- `frontend/components/shell/Breadcrumbs.tsx` — Current route-aware breadcrumb labels/links, including dynamic workspace/admin paths.
- `frontend/components/shell/CommandPalette.tsx` — Keyboard-driven navigation/action palette with fuzzy filtering, grouped commands, and shortcuts.
- `frontend/components/shell/NotificationCenter.tsx` — Dropdown list of in-app notifications with read/clear actions.
- `frontend/components/shell/Sidebar.tsx` — Primary responsive navigation with user/admin sections, active states, collapse, and branding.
- `frontend/components/shell/ThemeToggle.tsx` — Switches light/dark theme through the theme provider.
- `frontend/components/shell/Topbar.tsx` — Header containing mobile navigation, breadcrumbs, search/command trigger, theme, notifications, workspace, and user menu.
- `frontend/components/shell/UserMenu.tsx` — Profile dropdown with account, settings, admin, and logout actions.
- `frontend/components/shell/WorkspaceSwitcher.tsx` — Loads accessible workspaces and switches current workspace from a dropdown.
- `frontend/components/shell/styles.ts` — Shared shell focus-ring class constants.

## Frontend settings components

- `frontend/components/settings/SettingsContent.tsx` — Full settings hub: overview, user/workspace context, API and AI health/config, frontend/runtime config, preferences persisted in local storage, auth debug, credentials, and danger zone.
- `frontend/components/settings/SettingsCard.tsx` — Styled settings section/card primitives and rows.
- `frontend/components/settings/AiConfigCard.tsx` — Displays provider/model, embedding, retrieval, reranking, and generation configuration without exposing secrets.
- `frontend/components/settings/ApiStatusCard.tsx` — Backend connection and health details with refresh behavior.
- `frontend/components/settings/AuthDebugCard.tsx` — Development-oriented token/user/session diagnostics with sensitive data minimized.
- `frontend/components/settings/DangerZoneCard.tsx` — Placeholder/guarded destructive account/session actions.
- `frontend/components/settings/FrontendConfigCard.tsx` — Displays public API URL, app version, environment, and client runtime facts.
- `frontend/components/settings/UserCard.tsx` — Current-user identity, role, status, and account metadata.
- `frontend/components/settings/WorkspaceCard.tsx` — Current workspace identity, role, owner/member, and navigation information.
- `frontend/components/settings/settingsUtils.ts` — Safe value formatting, boolean/status mapping, environment labeling, token metadata, and copy/display helpers.

## Frontend UI design system

- `frontend/components/ui/DESIGN_SYSTEM.md` — Horizon component/token usage guide covering semantic colors, typography, spacing, states, accessibility, and composition.
- `frontend/components/ui/Avatar.tsx` — Initial/image avatar with size/status variants.
- `frontend/components/ui/Badge.tsx` — General semantic badge/pill variants.
- `frontend/components/ui/Button.tsx` — Button variants, sizes, loading state, icons, and accessible disabled behavior.
- `frontend/components/ui/Card.tsx` — Card container/header/content/footer primitives.
- `frontend/components/ui/ConfirmDialog.tsx` — Confirmation modal for destructive or consequential actions.
- `frontend/components/ui/DataCard.tsx` — Structured value/metric card with tone, icon, trend, description, and loading state.
- `frontend/components/ui/DataTable.tsx` — Generic typed table with columns, row keys/actions, loading, and empty state.
- `frontend/components/ui/Dialog.tsx` — Accessible base dialog with overlay, title, description, close behavior, and size variants.
- `frontend/components/ui/Dropdown.tsx` — Dropdown menu, trigger, alignment, items, separators, labels, and keyboard/escape/outside-click behavior.
- `frontend/components/ui/EmptyState.tsx` — Empty-result illustration/message/action primitive.
- `frontend/components/ui/ErrorState.tsx` — Error message with optional retry action.
- `frontend/components/ui/Icon.tsx` — Central inline-SVG icon catalog and typed icon-name interface.
- `frontend/components/ui/Input.tsx` — Styled input with invalid/disabled states.
- `frontend/components/ui/Kbd.tsx` — Keyboard shortcut keycap.
- `frontend/components/ui/LoadingSkeleton.tsx` — Animated skeleton block variants.
- `frontend/components/ui/LoadingState.tsx` — Spinner/skeleton/card/table loading compositions.
- `frontend/components/ui/MetricCard.tsx` — KPI value/trend card.
- `frontend/components/ui/Modal.tsx` — Portal modal with focus/escape/overlay handling and action layout.
- `frontend/components/ui/Notification.tsx` — Inline toast/notification presentation by severity.
- `frontend/components/ui/PageHeader.tsx` — Standard page title, description, breadcrumb/back, and action layout.
- `frontend/components/ui/RoleBadge.tsx` — Maps user roles to consistent badge tones/labels.
- `frontend/components/ui/Select.tsx` — Styled native select.
- `frontend/components/ui/StatCard.tsx` — Compact statistic card with icon and optional trend.
- `frontend/components/ui/StatusBadge.tsx` — Maps operational/document states to semantic badges and optional dots.
- `frontend/components/ui/StatusBadge.test.tsx` — Tests known/unknown status mapping, labels, tones, and rendering.
- `frontend/components/ui/Tabs.tsx` — Controlled tab list/buttons/panels with accessible semantics.
- `frontend/components/ui/Textarea.tsx` — Styled multiline input with invalid/disabled states.
- `frontend/components/ui/index.ts` — Barrel exports for all Horizon UI primitives.

## Frontend AI Execution Studio feature

- `frontend/features/ai-execution-studio/types.ts` — Stage IDs, run state, retrieved chunks, evaluation, agent, timing, and transport type definitions.
- `frontend/features/ai-execution-studio/constants.ts` — Ordered stage metadata, labels, colors, durations, examples, and initial execution state.
- `frontend/features/ai-execution-studio/useExecutionRun.ts` — Simulation controller that advances a question through staged synthetic execution data and supports reset/cancel.
- `frontend/features/ai-execution-studio/usePlayer.ts` — Play/pause/step/seek timing hook for replaying a completed run.
- `frontend/features/ai-execution-studio/components/Studio.tsx` — Feature orchestrator combining empty hero, composer, pipeline rail, agent stage, details, and playback controls.
- `frontend/features/ai-execution-studio/components/AgentAvatar.tsx` — Animated SVG agent character with mood-specific eyes/motion.
- `frontend/features/ai-execution-studio/components/AgentStage.tsx` — Central animated visualization and typewriter narration for the active pipeline agent.
- `frontend/features/ai-execution-studio/components/Composer.tsx` — Question input with examples, submission, and disabled/running states.
- `frontend/features/ai-execution-studio/components/Gauge.tsx` — Small circular metric gauge.
- `frontend/features/ai-execution-studio/components/PipelineRail.tsx` — Clickable ordered stage nodes/connectors showing pending, active, and completed progress.
- `frontend/features/ai-execution-studio/components/StageDetail.tsx` — Chooses and renders the detail panel matching the selected stage.
- `frontend/features/ai-execution-studio/components/TransportBar.tsx` — Replay controls, elapsed time, progress slider, speed, step, and reset.
- `frontend/features/ai-execution-studio/components/stages/QuestionPanel.tsx` — Displays submitted question and initial request interpretation.
- `frontend/features/ai-execution-studio/components/stages/EmbeddingPanel.tsx` — Animated embedding vector/grid and dimension/model details.
- `frontend/features/ai-execution-studio/components/stages/SearchPanel.tsx` — Visualizes vector search across candidate document chunks.
- `frontend/features/ai-execution-studio/components/stages/RetrievalPanel.tsx` — Shows retrieved chunks, ranks, source metadata, and similarity scores.
- `frontend/features/ai-execution-studio/components/stages/RerankPanel.tsx` — Shows candidates moving to new ranks and adjusted relevance.
- `frontend/features/ai-execution-studio/components/stages/ContextPanel.tsx` — Displays selected chunks assembled into a context window.
- `frontend/features/ai-execution-studio/components/stages/PromptPanel.tsx` — Visualizes system instructions, user question, and grounded context prompt sections.
- `frontend/features/ai-execution-studio/components/stages/GenerationPanel.tsx` — Streams/displays the generated cited answer and token facts.
- `frontend/features/ai-execution-studio/components/stages/EvaluationPanel.tsx` — Displays faithfulness, relevance, and context precision gauges plus decision.
- `frontend/features/ai-execution-studio/components/stages/PersistencePanel.tsx` — Shows which conversation, trace, evaluation, citation, and usage records are saved.

## Frontend Architecture Explorer feature

- `frontend/features/architecture-explorer/architecture.ts` — Canonical nodes, layers, positions, descriptions, technologies, connections, and colors for the system architecture graph.
- `frontend/features/architecture-explorer/useArchitectureFlow.ts` — Converts architecture data to React Flow nodes/edges and manages selection/highlighting.
- `frontend/features/architecture-explorer/ArchNode.tsx` — Custom architecture node card with layer/type/status styling and connection handles.
- `frontend/features/architecture-explorer/FlowEdge.tsx` — Animated/labeled custom graph edge.
- `frontend/features/architecture-explorer/FlowMap.tsx` — Configured React Flow canvas with controls, background, fit, and selection events.
- `frontend/features/architecture-explorer/NodeInspector.tsx` — Side panel explaining selected component purpose, stack, inputs/outputs, relations, and deep link.

## Frontend dashboard and RAGOps features

- `frontend/features/dashboard/PersonalDashboard.tsx` — User-focused dashboard alternative with greeting, workspaces/documents, quick actions, activity, and account/session information.
- `frontend/features/ragops/types.ts` — Client types for RAGOps overview component inputs and severity/status values.
- `frontend/features/ragops/hooks.ts` — React Query hooks for RAGOps workspaces, details, pipelines, chunks, retries, and Qdrant health.
- `frontend/features/ragops/metrics.ts` — Derives executive, retrieval, embedding, agent, evaluation, pipeline, failure, and workspace-health metrics from API data.
- `frontend/features/ragops/components/primitives.tsx` — RAGOps panel, KPI, chart, status, progress, table, and formatting primitives.
- `frontend/features/ragops/components/ExecutiveOverview.tsx` — High-level health, workload, quality, latency, and risk KPIs for leadership/operations.
- `frontend/features/ragops/components/PipelineObservatory.tsx` — Ingestion/RAG stage throughput, duration, status, and bottleneck visualization.
- `frontend/features/ragops/components/RetrievalIntelligence.tsx` — Retrieval strategy, scores, candidate behavior, and source effectiveness analysis.
- `frontend/features/ragops/components/EmbeddingAnalytics.tsx` — Embedding/indexing coverage, model/dimension, chunk/vector counts, and Qdrant status.
- `frontend/features/ragops/components/AgentPerformance.tsx` — Per-agent latency/contribution visualization and slow-stage identification.
- `frontend/features/ragops/components/EvaluationIntelligence.tsx` — Quality metric distributions, thresholds, trends, and weak-answer indicators.
- `frontend/features/ragops/components/FailureCenter.tsx` — Failed/stuck document and operational alert presentation with recovery links.
- `frontend/features/ragops/components/WorkspaceHealthCenter.tsx` — Cross-workspace health scoring, ranking, statuses, and drill-down navigation.
- `frontend/features/ragops/components/OperationsCenter.tsx` — Service availability, queue/vector status, incidents, and operational actions.
- `frontend/features/ragops/components/AiInsight.tsx` — Generated-looking narrative synthesis of current RAGOps signals and recommended attention areas.

## Frontend trace inspector feature

- `frontend/features/trace-inspector/helpers.ts` — Normalizes trace data, scores/tones, ranks, latencies, citations, agent steps, and display-safe values.
- `frontend/features/trace-inspector/helpers.test.ts` — Tests trace normalization, score/tone decisions, rankings, latency summaries, and edge cases.
- `frontend/features/trace-inspector/hooks.ts` — React Query hooks that load trace detail and its retrieval/reranking/evaluation subresources.
- `frontend/features/trace-inspector/components/primitives.tsx` — Trace-specific panels, key/value rows, score bars, chips, code/text blocks, and empty states.
- `frontend/features/trace-inspector/components/FlowSections.tsx` — Question/router/rewriter/generation/correction/persistence flow and agent timeline sections.
- `frontend/features/trace-inspector/components/RetrievalSections.tsx` — Retrieved/reranked chunk lists, score/rank comparisons, source metadata, and context inspection.
- `frontend/features/trace-inspector/components/AnalysisSections.tsx` — Evaluation, latency, tokens/cost, citations, answer, errors, and diagnostic analysis sections.

## Frontend trace observatory feature

- `frontend/features/trace-observatory/helpers.ts` — Builds filter options, distributions, alerts, summary values, tones, and display models from trace-list data.
- `frontend/features/trace-observatory/helpers.test.ts` — Tests distributions, filters, alerts, formatting, and observatory edge cases.
- `frontend/features/trace-observatory/hooks.ts` — React Query hooks for trace pages and quality summary with URL/filter parameters.
- `frontend/features/trace-observatory/components/ObservatoryFilterBar.tsx` — Workspace/provider/status/date/search filter controls and active-filter management.
- `frontend/features/trace-observatory/components/TraceCard.tsx` — One trace summary with question, outcome, quality, latency, provider, workspace, and inspector link.
- `frontend/features/trace-observatory/components/Distributions.tsx` — Quality, latency, provider, status, and corrector-decision distribution charts.
- `frontend/features/trace-observatory/components/AlertsRail.tsx` — Prioritized quality/performance alerts and worst-message shortcuts.

## Frontend contexts, providers, and hooks

- `frontend/contexts/AuthContext.tsx` — Central authentication state: restore token/user, login/register/logout, expired sessions, persistence, refresh, and context API.
- `frontend/providers/Providers.tsx` — Root provider composition for Query, auth, theme, workspace, notifications, and command menu.
- `frontend/providers/QueryProvider.tsx` — Configures a stable TanStack Query client with retry/staleness defaults.
- `frontend/providers/ThemeProvider.tsx` — Persists light/dark/system choice, listens for system changes, and updates the document class/color scheme.
- `frontend/providers/WorkspaceProvider.tsx` — Loads workspaces, persists current selection, validates it, and exposes switching/refresh context.
- `frontend/providers/NotificationsProvider.tsx` — Manages in-memory notifications, unread state, add/read/remove/clear operations, and context access.
- `frontend/providers/CommandMenuProvider.tsx` — Controls command-palette open state and global keyboard shortcut.
- `frontend/providers/command-menu-context.ts` — Typed command-menu context and consumer hook separated to avoid component refresh/export issues.
- `frontend/hooks/useAuth.ts` — Compatibility re-export of the auth-context hook.
- `frontend/hooks/useAuthUser.ts` — Convenience hook exposing normalized user/loading/authenticated/role fields.
- `frontend/hooks/useAdminAccess.ts` — Returns whether the current authenticated user is admin or super-admin.
- `frontend/hooks/useApi.ts` — Generic request hook with loading/data/error state and execute/reset functions.
- `frontend/hooks/useApiStatus.ts` — Polls/checks backend health and exposes online/loading/error/refresh state.
- `frontend/hooks/useChatStream.ts` — Robust SSE client/parser and state machine for streamed RAG events, stage progress, partial/final answer, citations, evaluation, abort, and error recovery.

## Frontend API/domain libraries and types

- `frontend/lib/api-client.ts` — Primary fetch client with base URL, JSON/multipart handling, bearer token injection, typed errors, unauthorized/session-expired handling, and convenience methods.
- `frontend/lib/api.ts` — One-line compatibility re-export of `api-client`.
- `frontend/lib/api/client.ts` — One-line compatibility re-export preserving a nested legacy import path.
- `frontend/lib/auth.ts` — Auth token storage plus register/login/me API functions and response typing.
- `frontend/lib/auth/.gitkeep` — Keeps the legacy auth directory present; no behavior.
- `frontend/lib/admin.ts` — Typed client functions and query-string builders for all admin users, workspaces, documents, audit, RAG, usage, errors, mutations, RAGOps, and trace endpoints.
- `frontend/lib/chat.ts` — Non-stream chat, conversation list/detail, and message-evaluation API functions.
- `frontend/lib/documents.ts` — Upload/list/get/status/delete document API functions.
- `frontend/lib/workspaces.ts` — Workspace create/list/get/update/delete API functions.
- `frontend/lib/constants.ts` — Public API URL and shared application/storage constants.
- `frontend/lib/errors.ts` — Converts unknown/fetch/API errors into user-friendly messages, status information, and validation field errors.
- `frontend/lib/formatters.ts` — Reusable dates, numbers, percentages, bytes, duration, relative time, and truncated-text formatting.
- `frontend/lib/navigation.ts` — Route-to-title/breadcrumb/navigation metadata and helpers for dynamic paths.
- `frontend/lib/permissions.ts` — Small role and workspace ownership/admin permission predicates.
- `frontend/types/index.ts` — Main shared TypeScript domain model: users, workspaces, documents, chat/SSE, admin pages/stats, RAGOps, traces, health, API errors, and UI support types.
- `frontend/types/admin.ts` — Compatibility re-exports of admin types from the central type module.
- `frontend/types/auth.ts` — One-line compatibility re-export for auth types.
- `frontend/types/chat.ts` — Chat-specific aliases/re-exports plus stream event typing.
- `frontend/types/document.ts` — One-line compatibility re-export for document types.
- `frontend/types/workspace.ts` — One-line compatibility re-export for workspace types.
- `frontend/types/ragops.ts` — RAGOps-specific type re-exports and aliases.
- `frontend/types/traces.ts` — Trace-specific type re-exports and filter definitions.

## Project documentation

- `docs/TECHNICAL_REPORT.md` — Large end-to-end technical report covering requirements, architecture, phases, database, APIs, RAG algorithms, frontend/admin/RAGOps/traces, security, testing, deployment, limitations, and roadmap.
- `docs/architecture.md` — Concise system diagram/text describing service boundaries and the ingestion/query flows.
- `docs/observability.md` — Prometheus/Grafana guide: metrics, labels, request IDs, dashboards, startup, queries, troubleshooting, and multiprocess behavior.
- `docs/phase9-ollama-connectivity.md` — Phase-9 runbook for making Dockerized backend/Celery reach host Ollama and diagnosing model/connectivity failures.
- `docs/presentation/index.html` — Self-contained presentation/slideshow with styled project narrative, architecture, phase progress, capabilities, results, and speaker navigation.
- `docs/report-package/00-INDEX.md` — Index and suggested reading/order for the modular final-report package.
- `docs/report-package/01-project-overview.md` — Context, problem, objectives, stakeholders, scope, functional/non-functional requirements, and project positioning.
- `docs/report-package/02-system-architecture.md` — Detailed logical/deployment/component architecture, ingestion/query sequences, trust boundaries, and design decisions.
- `docs/report-package/03-phases.md` — Chronological implementation narrative for project phases and delivered capabilities.
- `docs/report-package/04-database-design.md` — Entity/relationship, table, field, constraint, index, lifecycle, isolation, and data-retention documentation.
- `docs/report-package/05-api-specification.md` — Endpoint catalog with authentication, request/response patterns, SSE events, errors, and administrative APIs.
- `docs/report-package/06-uml-package.md` — Collection of PlantUML-ready use-case, class, component, deployment, activity, and sequence diagrams with explanations.
- `docs/report-package/07-screenshots-package.md` — Screenshot capture checklist, naming/caption plan, routes, states, and evidence requirements for the final report.
- `docs/report-package/08-technology-stack.md` — Rationale and roles for backend, frontend, databases, queues, AI providers, testing, containers, and monitoring tools.
- `docs/report-package/09-testing-results.md` — Test strategy, suite breakdown, commands, phase/security coverage, evidence format, and known limitations.
- `docs/report-package/10-ai-execution-studio.md` — Describes the studio’s educational pipeline visualization, stages, interactions, architecture, and limitations (simulation vs live trace).
- `docs/report-package/11-ragops.md` — RAGOps control-tower goals, metrics, views, APIs, operational uses, and business value.
- `docs/report-package/12-rag-traces.md` — Trace observatory/inspector purpose, stored evidence, filters, quality analysis, and debugging workflow.
- `docs/report-package/13-business-value.md` — Stakeholder benefits, differentiation, KPIs, risks, adoption path, and future commercialization/extension value.
- `docs/testing/current-validation-results.md` — Snapshot of recently executed validation commands, results, failures/warnings, environment constraints, and interpretation.
- `docs/testing/phase-01-19-validation.md` — Detailed phase-by-phase validation matrix and manual/automated evidence for stack, backend, RAG, security, and frontend phases 1–19.

## Monitoring

- `monitoring/README.md` — Minimal instructions for starting and reaching Prometheus/Grafana and locating the provisioned dashboard.
- `monitoring/prometheus.yml` — Scrapes the backend `/metrics` endpoint every 15 seconds.
- `monitoring/grafana/provisioning/datasources/prometheus.yml` — Automatically provisions Prometheus as Grafana’s default datasource.
- `monitoring/grafana/provisioning/dashboards/dashboards.yml` — Tells Grafana to load JSON dashboards from its mounted dashboard directory.
- `monitoring/grafana/dashboards/devpilot-observability.json` — Provisioned dashboard panels/queries for request rate/latency/errors, RAG stages, LLM tokens/provider failures, ingestion, and vector operations.

## Progress-report PDFs

- `phases/AVANCEMENT1.pdf` — 39-page French progress report for phases 1–8: project vision, technology choices, Docker/backend/database/auth/workspace/document ingestion architecture, APIs, tests, and next steps.
- `phases/AVANCEMENT2.pdf` — 26-page French progress report for phases 9–11: Ollama embeddings, Qdrant semantic search, vector indexing, RAG chat, architecture, validation, and limitations.
- `phases/AVANCEMENT3.pdf` — 32-page French technical report for phases 12–15: answer evaluation, agentic workflow, hybrid retrieval, reranking, metrics, tests, and outcomes.
- `phases/devpilot_prompts_implementation_guide.pdf` — 57-page implementation/test prompt guide for phases 1–14, organized by phase objectives, prompts, manual tests, and expected results.

## Final PFE LaTeX report

- `rapport/pfe/main.tex` — Master LaTeX document: packages, typography, colors, geometry, headers/footers, metadata, chapter inclusion, bibliography placeholders, and PDF structure.
- `rapport/pfe/chapters/front-matter.tex` — Cover, jury/academic metadata, dedication, acknowledgements, abstract/résumé, keywords, contents, figure/table lists, and acronyms.
- `rapport/pfe/chapters/chapter1.tex` — General context, organization/problem analysis, objectives, scope, methodology, requirements, actors, constraints, and chapter conclusion.
- `rapport/pfe/chapters/chapter2.tex` — State of the art and conceptual foundations: document intelligence, RAG, embeddings, retrieval, reranking, agents, quality, observability, security, and technology comparison.
- `rapport/pfe/chapters/chapter3.tex` — Requirements and system design: use cases, architecture, components, deployment, data model, API/contracts, workflows, security, and design choices.
- `rapport/pfe/chapters/chapter4.tex` — Implementation details for backend, ingestion, providers, retrieval, agentic pipeline, streaming/persistence, frontend, RAGOps, traces, and monitoring.
- `rapport/pfe/chapters/chapter5.tex` — Validation and results: strategy, unit/integration/security/UI tests, performance/quality observations, screenshots/evidence plan, limitations, and discussion.
- `rapport/pfe/chapters/conclusion.tex` — Final synthesis, contributions, lessons, limits, future work, and professional/academic perspective.

## PlantUML diagrams in the PFE report

- `rapport/pfe/diagrams/diagram-01.puml` — User/admin/super-admin use cases, including workspace, upload, RAG chat, history, administration, RAGOps, and traces.
- `rapport/pfe/diagrams/diagram-02.puml` — Conceptual class relationships among users, workspaces, memberships, documents/chunks, conversations/messages, and traces.
- `rapport/pfe/diagrams/diagram-03.puml` — Physical database-style class diagram for core chat/RAG entities and their cardinalities.
- `rapport/pfe/diagrams/diagram-04.puml` — Agentic workflow class diagram connecting the seven agents to retrieval, reranking, evaluation, and trace services.
- `rapport/pfe/diagrams/diagram-05.puml` — Document-upload/ingestion sequence from API and storage through Celery embeddings and Qdrant indexing.
- `rapport/pfe/diagrams/diagram-06.puml` — Streaming RAG sequence covering rewrite, Qdrant candidates, reranking, Gemini tokens, evaluation/correction, and SSE events.
- `rapport/pfe/diagrams/diagram-07.puml` — Admin trace-inspection sequence between frontend, admin API, and PostgreSQL lineage records.
- `rapport/pfe/diagrams/diagram-08.puml` — Entity-relationship diagram for core database tables and cardinalities.
- `rapport/pfe/diagrams/diagram-09.puml` — Backend and frontend package/module dependency diagram.
- `rapport/pfe/diagrams/diagram-10.puml` — Compact object sequence from client question to workflow, Qdrant, Gemini, and streamed cited response.

## Eraser diagram sources in the PFE report

- `rapport/pfe/diagrams/eraser/README.md` — Explains how to import/edit/export the Eraser diagram source files and map them to report figures.
- `rapport/pfe/diagrams/eraser/01-global-architecture.eraser` — Eraser DSL for the global layered architecture.
- `rapport/pfe/diagrams/eraser/02-deployment.eraser` — Eraser DSL for Docker/services/external-provider deployment.
- `rapport/pfe/diagrams/eraser/03-rag-pipeline.eraser` — Eraser DSL for ingestion and query RAG stages.
- `rapport/pfe/diagrams/eraser/04-ragops.eraser` — Eraser DSL for RAGOps dashboards, signals, and backing services.
- `rapport/pfe/diagrams/eraser/05-traceability.eraser` — Eraser DSL for trace persistence and observatory/inspector views.
- `rapport/pfe/diagrams/eraser/06-ai-execution-studio.eraser` — Eraser DSL for the execution-studio simulation/replay components.
- `rapport/pfe/diagrams/eraser/07-backend-layers.eraser` — Eraser DSL for backend route/dependency/service/provider/data layering.
- `rapport/pfe/diagrams/eraser/08-component.eraser` — Eraser DSL for the principal system component relationships.
- `rapport/pfaFinal.zip` — Delivery archive containing the `rapport/pfe` LaTeX chapters plus PlantUML and Eraser diagram sources (31 archive entries, about 108 KB uncompressed).

## Root live integration and acceptance tests

- `tests/integration/conftest.py` — Live-stack fixtures/helpers for environment gates, HTTP clients, unique users, auth headers, workspace/document creation, polling, cleanup, and provider/service availability.
- `tests/integration/test_phase_01_02_stack.py` — Validates repository/container foundation, health, configuration safety, and required service definitions for phases 1–2.
- `tests/integration/test_phase_03_database.py` — Validates PostgreSQL connectivity, migrations, expected tables, constraints, and basic persistence.
- `tests/integration/test_phase_04_auth.py` — Live registration, login, current-user, duplicate/invalid credential, and protected-route validation.
- `tests/integration/test_phase_05_security_workspaces.py` — Workspace CRUD, JWT protection, membership/owner permissions, and cross-tenant isolation checks.
- `tests/integration/test_phase_06_documents_api.py` — Live document upload/list/detail/status/delete validation including invalid files and tenant access.
- `tests/integration/test_phase_07_08_09_ingestion.py` — Gated end-to-end Celery extraction/cleaning/chunking/Ollama embedding/Qdrant indexing and failure validation.
- `tests/integration/test_phase_10_14_retrieval.py` — Live semantic, keyword, and hybrid retrieval, ranking, isolation, and fallback-oriented checks.
- `tests/integration/test_phase_11_12_13_15_rag.py` — Gated RAG generation, citations, evaluation, agent stages, correction, hybrid retrieval, and reranking validation.
- `tests/integration/test_phase_17_18_19_frontend_routes.py` — Verifies frontend auth, document, chat, and related routes render from the running stack.
- `tests/integration/test_phase_23_streaming_chat.py` — Live SSE event contract, ordering, token/final payload, persistence, and authenticated streaming checks.
- `tests/integration/test_security_acceptance.py` — Acceptance tests for unauthenticated denial, malformed tokens, tenant isolation, admin boundaries, upload constraints, and safe responses.

## Manual UI test specifications

- `tests/ui/test_phase_17_frontend_auth.md` — Manual checklist for registration/login, validation, redirects, persistence, logout, expiration, responsive states, and accessibility.
- `tests/ui/test_phase_18_documents_ui.md` — Manual checklist for workspace document listing/upload/status polling/errors/deletion and tenant behavior.
- `tests/ui/test_phase_19_chat_ui.md` — Manual checklist for chat composition, streaming stages, answers, citations, evaluations, conversation history, failures, and responsive/accessibility behavior.

## Classification notes

- **Hand-maintained application source:** `backend/app`, `frontend/app`, `frontend/components`, `frontend/features`, `frontend/hooks`, `frontend/lib`, `frontend/providers`, `frontend/contexts`, and `frontend/types`.
- **Hand-maintained support source:** migrations, scripts, Docker/monitoring configuration, tests, documentation, LaTeX, PlantUML, and Eraser files.
- **Generated/reproducibility artifacts:** npm lockfiles, Python `egg-info`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, and test-run status JSON.
- **Runtime/delivery artifacts:** uploaded storage PDFs, phase PDFs, presentation HTML, and the final-report ZIP.
- **No behavior:** package markers, `.gitkeep` placeholders, and the stray `bad.exe` text file.
