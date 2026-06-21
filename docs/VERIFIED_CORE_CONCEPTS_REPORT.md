# DevPilot AI — Verified Core Concepts and Implementation Report

**Verification date:** 19 June 2026  
**Scope:** Sections 5.1–5.10 of the supplied draft, checked against the current repository  
**Status:** Source-backed description of what the project currently implements

---

## Executive verdict

The supplied report is **conceptually similar** to DevPilot AI, but it is not an exact description of the current code. It correctly identifies the main architecture—RAG, Qdrant, hybrid retrieval, reranking, seven pipeline roles, SSE, Celery, evaluation, and observability—but many code samples are illustrative rather than the code used by this project.

The most important corrections are:

| Draft claim | Current project behavior |
|---|---|
| Embeddings are created with `SentenceTransformer` | Embeddings are requested from Ollama through `POST /api/embed`. |
| Qdrant payload contains chunk text | Qdrant stores identifiers and metadata; chunk content remains in PostgreSQL and is loaded after vector search. |
| Chunking slices raw token arrays | The chunker preserves word boundaries while using `tiktoken` to keep each window near an 800-token budget. |
| The router freely selects the retrieval strategy | The router computes a strategy, but normal API requests explicitly default to `hybrid`, which overrides the router result. |
| Query rewriting is performed by an LLM | Rewriting is deterministic string logic. |
| Evaluation extracts and verifies atomic claims | Ollama can judge all four scores in one JSON response; otherwise deterministic overlap heuristics are used. |
| The corrector asks an LLM to rewrite weak answers | The corrector is deterministic: it keeps, replaces, or builds a short extractive answer according to thresholds. |
| Citations are streamed before generation | In the current SSE flow, citations are emitted after generation, evaluation, correction, and persistence. |
| Upload returns HTTP 202 and Celery uses PyMuPDF | Upload returns HTTP 201; PDF extraction uses `pypdf`. |
| Grafana contains 11 AI-quality panels | The provisioned Grafana dashboard currently has five panels. Richer RAGOps data comes from PostgreSQL-backed admin APIs and the frontend. |

---

## 5.1 RAG Pipeline

DevPilot has two connected pipelines: asynchronous document ingestion and real-time question answering.

### Document ingestion

```text
Authenticated upload
      ↓
Save file under backend/storage/<workspace>/<document>/
      ↓
Create PostgreSQL document row with status = queued
      ↓
Enqueue process_document_task through Celery/Redis
      ↓
Extract PDF/TXT/Markdown text
      ↓
Clean text and create overlapping chunks
      ↓
Persist chunks in PostgreSQL
      ↓
Request batched embeddings from Ollama
      ↓
Upsert vectors and metadata into Qdrant
      ↓
Set document status = indexed
```

The upload endpoint returns `201 Created` after saving the file, committing its metadata, and enqueueing the background task. It does not wait for extraction or embedding.

### Question-answering pipeline

```text
Question + workspace + requested retrieval strategy
      ↓
Router classifies the question
      ↓
Deterministic query rewriter normalizes the query
      ↓
Retrieve candidate chunks (15 by default when reranking is enabled)
      ↓
Rerank to 5 chunks by default
      ↓
Build a numbered context prompt
      ↓
Generate with configured provider: Gemini or Ollama
      ↓
Ensure at least one citation marker when context exists
      ↓
Evaluate four quality scores
      ↓
Deterministic corrector keeps or replaces the answer
      ↓
Persist message, chunks, usage, agent runs, and evaluation
```

The system prompt requires the model to use only retrieved context, cite sources as `[1]`, `[2]`, and so on, answer in the user's language, and return a fixed insufficient-context sentence when the answer is unavailable.

The default configuration is:

```text
RETRIEVAL_CANDIDATES=15
RERANK_TOP_K=5
RAG_TOP_K=5
RAG_MAX_CONTEXT_CHARS=6000
ENABLE_RERANKING=true
```

The provider selected by `LLM_PROVIDER` generates the answer. Docker Compose currently defaults to Gemini, while the Python settings class itself defaults to Ollama when no environment value is supplied.

**Source files:** `services/chat_service.py`, `agents/rag.py`, `providers/ollama_provider.py`, `providers/gemini_provider.py`, `workers/document_tasks.py`.

---

## 5.2 Embeddings and Vector Search

### Embedding generation

DevPilot does not load `nomic-embed-text` through `sentence-transformers`. The active implementation calls Ollama:

```python
payload = {
    "model": self.model,
    "input": input_value,
}
response = await client.post("/api/embed", json=payload)
```

The default embedding model is `nomic-embed-text`, the configured dimension is 768, and ingestion sends chunks in batches of four by default.

Although configuration validation accepts `EMBEDDING_PROVIDER=openai`, the current vector-store factory only implements `ollama`. Selecting another embedding provider raises `VectorStoreError`.

### Qdrant collection

The collection is created only when missing:

```python
await qdrant.create_collection(
    collection_name="devpilot_chunks",
    vectors_config=models.VectorParams(
        size=settings.embedding_dimension,
        distance=models.Distance.COSINE,
    ),
)
```

Each Qdrant point uses the chunk UUID as its vector ID and stores this payload:

```python
payload = {
    "workspace_id": str(chunk.workspace_id),
    "document_id": str(chunk.document_id),
    "chunk_id": str(chunk.id),
    "chunk_index": chunk.chunk_index,
    "filename": filename,
}
```

Chunk text is deliberately not duplicated in Qdrant. It is stored in the PostgreSQL `chunks` table.

### Semantic search

At query time DevPilot:

1. embeds the rewritten query with Ollama;
2. calls Qdrant `query_points` using cosine similarity;
3. applies a mandatory `workspace_id` payload filter;
4. receives chunk IDs and vector scores;
5. fetches the corresponding chunk content and filenames from PostgreSQL;
6. preserves the Qdrant ranking in the returned result list.

This gives two layers of workspace protection: Qdrant filters the vector search and PostgreSQL queries also require `Chunk.workspace_id == workspace_id`.

If embedding or Qdrant search fails, DevPilot attempts a PostgreSQL text-overlap fallback. If no fallback result exists, it re-raises the provider/vector error.

**Source files:** `services/vector_store_service.py`, `services/retrieval_service.py`, `providers/ollama_provider.py`.

---

## 5.3 Chunking

The draft's values are correct: the defaults are 800 tokens per chunk and 150 tokens of overlap, with `cl100k_base` token counting.

The actual algorithm differs from direct token slicing. It first identifies non-whitespace words, counts the tokens in every word, and grows a chunk until adding the next word would exceed the token budget.

```python
word_matches = list(re.finditer(r"\S+", text))
word_token_counts = [max(count_tokens(match.group(0)), 1) for match in word_matches]

while end_word < len(word_matches):
    next_total = token_total + word_token_counts[end_word]
    if end_word > start_word and next_total > chunk_size:
        break
    token_total = next_total
    end_word += 1
```

For the next window, the algorithm walks backward from the previous end until it has accumulated at least the requested overlap:

```python
while next_start_word > start_word and overlap_tokens < overlap:
    next_start_word -= 1
    overlap_tokens += word_token_counts[next_start_word]
```

Therefore:

- chunks do not split words;
- a chunk is normally at most 800 tokens;
- the overlap is approximately 150 tokens and can be slightly larger when the boundary word contains multiple tokens;
- stored metadata contains `start_char` and `end_char`;
- each chunk stores its actual `token_count` in PostgreSQL;
- if `tiktoken` is unavailable, counting falls back to the number of non-whitespace words.

The worker calls `chunk_text(cleaned_text)` without overriding these defaults.

**Source file:** `utils/chunker.py`.

---

## 5.4 Semantic, Keyword, Hybrid Retrieval, and RRF

DevPilot implements all three retrieval strategies.

### Semantic retrieval

Semantic retrieval uses an Ollama query embedding and Qdrant cosine search, scoped to one workspace.

### Keyword retrieval

Keyword retrieval uses PostgreSQL English full-text search:

```python
search_vector = func.to_tsvector("english", Chunk.content)
search_query = func.plainto_tsquery("english", query)
rank = func.ts_rank_cd(search_vector, search_query).label("score")
```

If full-text search returns no rows, DevPilot scans up to 1,000 recent non-deleted chunks in the workspace and calculates a deterministic overlap score. That fallback includes query-term overlap, filename overlap, a full-query phrase bonus, and quoted-phrase bonuses.

### Hybrid retrieval

Hybrid retrieval runs semantic and keyword retrieval, then merges their ranked lists with Reciprocal Rank Fusion:

```text
RRF(chunk) = sum(1 / (60 + rank_in_each_list))
```

The implementation uses one-based ranks and `RRF_K = 60`:

```python
for rank, result in enumerate(results, start=1):
    fused[chunk_id]["score"] += 1 / (RRF_K + rank)
```

Original semantic and keyword scores are preserved in `metadata.source_scores`; the public `score` of a hybrid result becomes its RRF score.

With default settings and reranking enabled, each retrieval branch is asked for up to 15 items, the fused list is limited to 15, and the reranker later keeps five.

### What the router really does

The router is deterministic. It assigns categories such as exact-term, summary, comparison, technical, factual, or unknown and recommends keyword, hybrid, or semantic retrieval.

However, the API request schema defaults `retrieval_strategy` to `hybrid`, the frontend also sends `hybrid` by default, and the workflow treats a supplied strategy as an override. Consequently, normal chat requests use the strategy selected by the caller—usually hybrid—not the router's recommendation.

The router recommendation becomes active only when the workflow is called without an explicit retrieval strategy.

**Source files:** `services/retrieval_service.py`, `agents/rag.py`, `schemas/chat.py`, `hooks/useChatStream.ts`.

---

## 5.5 Reranking

Reranking is enabled by default. The normal path is deterministic heuristic reranking; an Ollama reranker is optional and disabled by default.

### Heuristic score

For candidate at one-based rank `r`:

```text
overlap       = query keyword coverage in the chunk
exact_matches = count of query terms found exactly, capped at 5 for scoring
original      = maximum of result.score and metadata.source_scores values
rank_prior    = 1 / (60 + r)

rerank_score =
    0.50 × overlap
  + 0.10 × min(exact_matches, 5)
  + 0.30 × original
  + 0.10 × rank_prior
```

This is close to the draft's 50/10/30/10 description, but `exact_matches` is a count rather than a single Boolean, and the rank prior is reciprocal rather than linearly decreasing.

The returned chunk includes `rerank_score` and diagnostic fields under `metadata.rerank_features`.

### Optional Ollama reranker

When `ENABLE_OLLAMA_RERANKER=true`, DevPilot asks the configured Ollama generation model to return strict JSON:

```json
{"ranked_chunk_ids": ["chunk-id-1", "chunk-id-2"]}
```

Missing positions are filled with heuristic results. Any Ollama reranking error also falls back completely to heuristics.

There is no separate cross-encoder reranking model in the current project.

**Source file:** `services/reranking_service.py`.

---

## 5.6 Agentic Workflow

DevPilot defines seven pipeline roles:

| Role | Current implementation |
|---|---|
| Router | Deterministic query classification and strategy recommendation. |
| Query rewriter | Deterministic normalization, short-query expansion, and question-mark insertion. |
| Retrieval | Calls semantic, keyword, or hybrid retrieval. |
| Reranker | Heuristic by default; optional Ollama ranking. Can be skipped by configuration. |
| Generator | Calls Gemini or Ollama with numbered retrieved context. |
| Evaluator | Ollama JSON judge only when Ollama is the active LLM; otherwise heuristics. |
| Corrector | Deterministic keep/refuse/extractive correction logic. |

These are Python classes coordinated by `AgenticRAGWorkflow`; they are not seven autonomous LLM agents and do not inherit from a common `BaseAgent`.

The non-streaming workflow runs each stage through `_run_agent`, measures latency, catches failure status, and forwards a JSON-safe result to a logger callback. `chat_service.py` supplies a callback that adds an `AgentRun` row associated with the assistant message.

```text
router → query_rewriter → retrieval → [reranker] → generator → evaluator → corrector
```

The reranker stage is conditional. The other six roles run for each normal workflow execution.

The streaming path implements the same stages directly in `chat_service.py` so it can yield events between operations and stream generator output. It does not call `AgenticRAGWorkflow.run()` as one black box.

After completion, DevPilot persists:

- the user and assistant messages;
- one `AgentRun` per executed role;
- selected `RetrievedChunk` rows with rank and strategy;
- `LLMUsage` with provider/model/token/latency data;
- one `Evaluation` row;
- the final answer after correction.

**Source files:** `agents/rag.py`, `services/chat_service.py`, `models/conversation.py`.

---

## 5.7 Faithfulness, Relevance, Context Precision, and Hallucination

The supplied draft's atomic-claim algorithm is **not implemented**. DevPilot has two evaluation paths.

### Path A: Ollama-as-judge

This path runs only when `settings.llm_provider == "ollama"`. DevPilot sends the question, answer, and at most 6,000 characters of formatted context to Ollama and requests one JSON object:

```json
{
  "faithfulness": 0.0,
  "relevance": 0.0,
  "context_precision": 0.0,
  "hallucination_score": 0.0,
  "explanation": "brief reason"
}
```

The judge uses temperature 0 and a 250-token output limit. Returned scores are converted to floats, clamped to `[0, 1]`, and rounded to three decimals.

This is a single holistic LLM judgment. It does not extract claims, verify claims individually, calculate `1 - faithfulness`, or add hedge-word penalties.

If the Ollama request or JSON parsing fails, DevPilot uses the heuristic path.

### Path B: deterministic heuristic fallback

This path is also the normal evaluator when Gemini is selected as the generation provider.

Definitions:

```text
answer_context_overlap =
    answer keywords also present in context / number of answer keywords

context_precision =
    retrieved chunks sharing at least one question keyword / retrieved chunk count
```

Relevance is the maximum of direct and lightly stem-expanded question/answer keyword overlap. Technology-stack questions receive additional boosts when supported technology names appear in both answer and context.

Faithfulness and hallucination use these branches:

```python
if answer_is_an_insufficient_context_refusal:
    faithfulness = 0.8
    hallucination_score = 0.05
elif answer_has_a_numeric_citation:
    faithfulness = clamp(0.55 + 0.30 * answer_context_overlap, 0.60, 0.85)
    hallucination_score = clamp(0.65 - 0.40 * answer_context_overlap, 0.10, 0.60)
else:
    faithfulness = min(0.55, answer_context_overlap)
    hallucination_score = clamp(1.0 - answer_context_overlap, 0.35, 0.90)
```

These are proxy scores, not formal factual verification. A citation marker improves the heuristic even though the heuristic does not verify that each cited source supports each claim.

### Corrector thresholds

The corrector does not call an LLM. Its important hard replacement conditions are:

```text
no contexts                  → insufficient-context answer
faithfulness < 0.50          → insufficient-context answer
hallucination_score > 0.60   → insufficient-context answer
context_precision < 0.50     → insufficient-context answer
```

Before replacing, the code applies exceptions for supported technology terms and for answers with strong context support. Relevance between 0.50 and 0.70 alone is not a refusal condition.

If the generator incorrectly returns a refusal while retrieved context shares terms with the question, the corrector can select the best matching sentence and create a short extractive answer with a citation. It then adjusts the stored scores to reflect that correction.

**Source files:** `services/evaluation_service.py`, `agents/rag.py`.

---

## 5.8 Server-Sent Events (SSE)

The streaming endpoint is:

```text
POST /api/v1/workspaces/{workspace_id}/chat/stream
Content-Type: application/json
Response Content-Type: text/event-stream
```

The route uses `StreamingResponse`, disables caching and Nginx buffering, and stops producing data when the client disconnects.

### Actual event order

```text
start
trace(query_rewriter started/completed)
trace(retrieval started/completed)
trace(reranker started/completed|skipped)
trace(generator started)
token ... token ... token
trace(generator completed)
trace(evaluator started/completed)
trace(corrector started/completed)
correction                    # only when correction occurs
citations
evaluation
message
done
```

On failure, the service emits an `error` event with a safe message. The final event is named `done`, not `complete`.

Important payload names are:

```text
token.data.text
citations.data.citations
evaluation.data.evaluation
correction.data.final_answer
message.data.message_id
message.data.conversation_id
done.data.status
```

Both Ollama and Gemini implement native streaming methods. If a provider cannot produce a usable stream before emitting text, it falls back to non-streaming generation and yields the completed response in small 24-character pieces.

The frontend uses `fetch()` and a custom SSE block parser because the request is a POST with a bearer token and JSON body. It buffers incomplete blocks, supports `\n\n` and `\r\n\r\n`, and can fall back to the non-streaming chat endpoint only if no stream event was received.

One current limitation is that native streaming does not return a final provider usage object to `chat_service.py`; in that case token counts persisted for the streamed answer are zero, while latency is measured locally.

**Source files:** `api/routes/chat.py`, `services/chat_service.py`, `providers/ollama_provider.py`, `providers/gemini_provider.py`, `frontend/hooks/useChatStream.ts`.

---

## 5.9 Celery Asynchronous Document Processing

Celery uses the configured Redis URL as both broker and result backend:

```python
celery_app = Celery(
    "devpilot",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.document_tasks"],
)
```

The configured options include JSON serialization, UTC, and task-start tracking. The current configuration does not set `task_acks_late` or `task_reject_on_worker_lost`, despite those options appearing in the supplied draft.

### Upload behavior

The authenticated endpoint accepts PDF, TXT, MD, and Markdown files up to 10 MiB by default. It sanitizes the filename, writes the file in 1 MiB blocks, commits a `queued` document row, increments an upload metric, and calls:

```python
process_document_task.delay(str(created_document.id))
```

It returns the document model with HTTP 201.

### Worker behavior

The worker:

1. sets status to `processing`;
2. extracts PDFs with `pypdf.PdfReader` or reads text/Markdown as UTF-8;
3. cleans and chunks the text;
4. replaces the document's PostgreSQL chunks;
5. embeds chunks in batches through Ollama;
6. upserts each vector to Qdrant;
7. sets status to `indexed` and records `processed_at`.

The task declares `max_retries=3`. Generic exceptions are retried with exponential delays of approximately 1, 2, and 4 seconds. `EmbeddingProviderError` and `VectorStoreError` are handled differently: the task records failure and returns a failed result without invoking the outer Celery retry.

Embedding timeouts have their own inner retry loop in the vector-store service: three retries after the first attempt, with 1, 2, and 4 second delays.

The implementation is idempotent at the PostgreSQL chunk level because it deletes old chunk rows before inserting replacements. The report should not claim full cross-store idempotency, because stale Qdrant points from earlier chunk UUIDs are not explicitly removed by this replacement function.

**Source files:** `services/document_service.py`, `workers/celery_app.py`, `workers/document_tasks.py`, `services/vector_store_service.py`.

---

## 5.10 RAGOps, Prometheus, Grafana, and Traceability

DevPilot has two observability systems that should be described separately.

### Prometheus runtime metrics

The backend exposes `/metrics`. The current custom metric families are:

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | Counter | method, path, status_code |
| `http_request_duration_seconds` | Histogram | method, path, status_code |
| `documents_uploaded_total` | Counter | file_type |
| `document_processing_duration_seconds` | Histogram | status |
| `document_processing_failures_total` | Counter | error_type |
| `rag_queries_total` | Counter | status |
| `rag_query_duration_seconds` | Histogram | status |
| `retrieval_latency_seconds` | Histogram | strategy, status |
| `evaluation_latency_seconds` | Histogram | status |
| `llm_tokens_total` | Counter | provider, model, token_type |

There are currently no Prometheus gauges named `rag_avg_faithfulness`, `rag_embedding_coverage_ratio`, or counters named `rag_correction_total` and `rag_hallucination_total`.

Prometheus scrapes `backend:8000/metrics` every 15 seconds.

### Provisioned Grafana dashboard

The repository's provisioned dashboard currently contains five panels:

1. HTTP Request Rate;
2. HTTP p95 Latency;
3. RAG Query Rate;
4. RAG p95 Latency;
5. LLM Token Rate.

Therefore, the draft's list of 11 Grafana panels is not an accurate description of the checked-in dashboard.

### PostgreSQL-backed RAGOps APIs

The richer AI-specific monitoring is calculated from application tables and exposed through admin APIs:

```text
GET  /api/v1/admin/ragops/workspaces
GET  /api/v1/admin/ragops/workspaces/{workspace_id}
GET  /api/v1/admin/ragops/documents/{document_id}/pipeline
GET  /api/v1/admin/ragops/documents/{document_id}/chunks
POST /api/v1/admin/ragops/documents/{document_id}/retry
GET  /api/v1/admin/ragops/qdrant/health
```

These APIs report document status distribution, chunk statistics, embedding coverage, PostgreSQL/Qdrant consistency, recent ingestion jobs, failed documents, recent RAG queries, average evaluation scores, and average agent latency. Full chunk content is restricted to `super_admin` and creates an audit record.

### Actual workspace RAG health score

The current formula is:

```text
health =
    40 × embedding coverage
  + 20 × indexed-document ratio
  + 20 × average faithfulness
  + 10 × (1 - average hallucination score)
  + 10 × retrieval success rate
```

All inputs are normalized to `[0, 1]`, the result is clamped to `[0, 100]`, and it is rounded to an integer.

```text
85–100 → healthy
60–84  → warning
0–59   → critical
```

When no retrieval history exists, the health calculation treats retrieval success as 1.0. When a workspace has no non-deleted documents, its indexed-document ratio is also treated as 1.0. Evaluation averages default to zero when no evaluation rows exist.

### Traceability

Per-answer traceability is stored in PostgreSQL rather than Prometheus. The project records agent inputs/outputs/status/latency, retrieved chunks and ranks, generation provider/model/token usage, final evaluation scores, and the final assistant message. The trace and RAGOps frontend features query this persisted data for forensic views.

**Source files:** `core/metrics.py`, `core/observability.py`, `services/ragops_service.py`, `api/routes/ragops.py`, `monitoring/prometheus.yml`, `monitoring/grafana/dashboards/devpilot-observability.json`.

---

## Final architecture summary

The most accurate short description of the current project is:

> DevPilot AI is a multi-workspace document RAG application built with FastAPI, Next.js, PostgreSQL, Qdrant, Redis, and Celery. Documents are extracted and embedded asynchronously with Ollama-hosted embeddings. Questions use caller-selected semantic, keyword, or hybrid retrieval; hybrid combines Qdrant and PostgreSQL full-text results with RRF. Retrieved candidates are reranked heuristically by default, then Gemini or Ollama generates a cited answer. The answer is evaluated by Ollama when Ollama is the active generation provider, otherwise by deterministic heuristics, and a deterministic corrector can refuse or create a short extractive answer. REST and SSE chat paths persist messages, retrieval evidence, agent runs, usage, and evaluation data. Prometheus/Grafana cover runtime metrics, while admin RAGOps APIs calculate richer workspace and document health from PostgreSQL and Qdrant.

This description matches the repository as checked on the verification date. It describes implemented behavior, not planned behavior.
