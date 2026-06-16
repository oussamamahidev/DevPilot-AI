# 09 — Testing & Results

This document records the testing strategy and results for DevPilot AI across backend, frontend, API, streaming, performance, evaluation, and manual validation. It also states the current limits of automated testing honestly.

**Build status.** The frontend build is green (`next build`) and ESLint is clean.

---

## Backend Tests (pytest)

**Scope.** The backend is exercised by a pytest suite covering API behavior and core RAG/service logic built up across the documented phases (authentication, workspace isolation, document ingestion, retrieval, generation, and evaluation).

**How to run.**

```bash
# from the backend service
pytest
```

**Acceptance criteria.**

| Area | Criterion |
|---|---|
| Health & config | `/health` responds; `/system/ai-config` exposes config with no secret leakage |
| Auth | register / login / me work; passwords stored hashed; roles persisted |
| Workspace isolation | cross-workspace access returns 403 |
| Documents | upload / list / status behave correctly |
| Retrieval | semantic and hybrid retrieval return relevant chunks |
| Evaluation | faithfulness / relevance / context precision / hallucination computed |

> 📸 [SCREENSHOT PLACEHOLDER: test run — pytest backend suite]

---

## Frontend Tests (Vitest + Testing Library)

**Result.** **39 passing tests.**

**Coverage.** The frontend unit tests focus on pure logic and component rendering:

- **Word-level LCS diff** — longest-common-subsequence diffing at the word level.
- **Trace health score** — health score computation for traces.
- **Tone mapping** — mapping of values to UI tone/state.
- **Observatory filter-param building** — construction of filter parameters for the Trace Observatory.
- **Score bucketizing** — bucketization of scores into bands.
- **StatusBadge / Badge render** — rendering tests for the badge components.

**How to run.**

```bash
# from the frontend
npx vitest run
```

**Acceptance criteria.**

| Test group | Criterion |
|---|---|
| Word-level LCS diff | diff output matches expected aligned word sequences |
| Trace health score | score computed correctly from inputs |
| Tone mapping | inputs map to the correct tone values |
| Observatory filter-param building | filter params assembled correctly |
| Score bucketizing | scores fall into the correct buckets |
| StatusBadge / Badge render | components render with expected output |
| **Total** | **39 / 39 passing** |

> 📸 [SCREENSHOT PLACEHOLDER: test run — Vitest 39 passing]

---

## API Tests (curl)

**Scope.** Endpoints are validated with `curl` against the real running backend to confirm live behavior beyond unit tests.

**Representative checks.**

```bash
# liveness
curl -s http://localhost:8000/health

# AI configuration (must not leak secrets)
curl -s http://localhost:8000/system/ai-config
```

**Acceptance criteria.**

| Endpoint | Criterion |
|---|---|
| `/health` | returns a healthy liveness response |
| `/system/ai-config` | returns config with no secret values exposed |
| Auth flow | register → login returns a usable JWT; `me` returns identity |
| Protected routes | requests without/with wrong workspace are rejected (403) |

> 📸 [SCREENSHOT PLACEHOLDER: test run — curl API checks]

---

## Streaming Tests (curl SSE)

**Scope.** The chat streaming path is validated with `curl` to confirm that responses arrive as progressive Server-Sent Events rather than a single buffered payload.

**What was verified.**
- The SSE stream emits **progressive token events**.
- **Real token cadence** was observed (tokens arrive incrementally over time), confirming the Phase 22 fix that replaced Gemini fake-streaming with real SSE token streaming.

**Acceptance criteria.**

| Criterion | Expected |
|---|---|
| Event delivery | SSE events arrive incrementally |
| Token cadence | tokens stream progressively (real cadence, not a single dump) |
| Citations | answer contains `[n]` markers grounded in retrieved context |

> 📸 [SCREENSHOT PLACEHOLDER: test run — SSE streaming cadence]

---

## Performance Notes

- **Route bundles.** Route JavaScript bundles are approximately **110–175 kB**.
- **Lazy loading.** Heavy visualizations (e.g., the AI Execution Studio pipeline and the React Flow architecture map) are lazy-loaded to keep initial route weight down.
- **Animation performance.** Animations target **60fps** by animating `transform`/`opacity` only, avoiding layout-thrashing properties.

**Acceptance criteria.**

| Aspect | Criterion |
|---|---|
| Route bundle size | within ~110–175 kB range |
| Heavy viz | lazy-loaded, not in the initial bundle |
| Animation | 60fps via transform/opacity |

---

## Evaluation Tests

**Scope.** Answer-quality evaluation is exercised to confirm the metrics introduced in Phase 12 produce scores.

**Metrics validated.**
- **Faithfulness** — answer grounded in the retrieved context.
- **Relevance** — answer relevance to the user's query.
- **Hallucination** — detection of unsupported content.

**Acceptance criteria.**

| Metric | Criterion |
|---|---|
| Faithfulness | scored against retrieved context |
| Relevance | scored against the query |
| Hallucination | unsupported content reflected in the score |

> 📸 [SCREENSHOT PLACEHOLDER: test run — evaluation scoring]

---

## Manual Tests

**Scope.** Manual validation is documented through phase validation guides covering **phases 1–19**, with dedicated UI manual-test documents for **phases 17, 18, and 19**.

- **Phase validation guides (1–19).** Step-by-step checks confirming each phase's acceptance behavior end to end.
- **Phase 17 UI manual test.** Login/register UI, JWT storage, and route guards.
- **Phase 18 UI manual test.** Document upload, drag-and-drop, status, and batch upload.
- **Phase 19 UI manual test.** Streaming chat with citations and sources.

> 📸 [SCREENSHOT PLACEHOLDER: test run — manual phase validation]

---

## Test Coverage Summary

| Layer | Tooling | Status |
|---|---|---|
| Backend | pytest | Suite covering auth, isolation, documents, retrieval, evaluation |
| Frontend | Vitest + Testing Library | 39 / 39 passing |
| API | curl (live endpoints) | Verified against running backend |
| Streaming | curl SSE | Real progressive token cadence verified |
| Evaluation | metric scoring | Faithfulness / relevance / hallucination verified |
| Manual | phase validation guides (1–19) | Documented, including phase 17/18/19 UI guides |
| End-to-end | Playwright | **Not yet implemented — future item** |

---

## Honest Limitations

Automated end-to-end testing with **Playwright** is **not yet implemented** and is tracked as a **future item**. Current end-to-end coverage is provided through manual phase validation guides and live `curl` checks rather than an automated browser-driven suite.
