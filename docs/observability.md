# Observability

Phase 20 adds structured request logs, Prometheus metrics, Prometheus scraping, and
Grafana provisioning.

## Structured Request Logs

Every backend request emits one JSON log event named `HTTP request completed` with:

- `request_id`: value from `X-Request-ID`, or a generated UUID.
- `method`: HTTP method.
- `path`: FastAPI route template when available.
- `status_code`: response status code.
- `latency_ms`: request latency in milliseconds.
- `user_id`: authenticated token subject when a bearer token is present and valid.
- `workspace_id`: workspace path parameter when the request path includes one.

The backend also returns `X-Request-ID` on responses so a client request can be
correlated with logs.

## Backend Metrics

Metrics are exposed by the backend at:

```bash
curl -sS http://localhost:8000/metrics
```

Prometheus scrapes the backend container at `backend:8000/metrics`. Celery worker
metrics are collected through Prometheus client's multiprocess mode using the
shared `prometheus_multiproc` Docker volume, then exposed by the backend
`/metrics` endpoint.

## Prometheus

Start the monitoring stack:

```bash
docker compose up -d prometheus grafana
```

Open Prometheus at:

```text
http://localhost:9090
```

Useful Prometheus checks:

```promql
up{job="devpilot-backend"}
rate(http_requests_total[5m])
histogram_quantile(0.95, sum by (le, path) (rate(http_request_duration_seconds_bucket[5m])))
```

## Grafana

Grafana is exposed on port `3001` by default:

```text
http://localhost:3001
```

Default local credentials:

```text
username: admin
password: admin
```

The Compose service provisions a Prometheus datasource and a starter dashboard named
`DevPilot AI Observability`.

If another service already uses port `3001`, change one of the host port values in
`.env`, for example:

```bash
GRAFANA_HOST_PORT=3002
```

## Metrics

`http_requests_total`
: Counter of backend HTTP requests, labeled by `method`, route `path`, and
`status_code`.

`http_request_duration_seconds`
: Histogram of backend HTTP request duration, labeled by `method`, route `path`,
and `status_code`.

`documents_uploaded_total`
: Counter of accepted document uploads, labeled by `file_type`.

`document_processing_duration_seconds`
: Histogram of Celery document processing task duration, labeled by final `status`
such as `indexed`, `failed`, `missing`, or `deleted`.

`document_processing_failures_total`
: Counter of document processing failures, labeled by exception `error_type`.

`rag_queries_total`
: Counter of chat RAG queries, labeled by `success` or `error`.

`rag_query_duration_seconds`
: Histogram of end-to-end chat RAG query duration, labeled by `success` or `error`.

`retrieval_latency_seconds`
: Histogram of retrieval latency, labeled by retrieval `strategy` and `status`.

`evaluation_latency_seconds`
: Histogram of answer evaluation latency. The `status` label is `llm` when the LLM
evaluator succeeds, `heuristic` when the heuristic fallback is used, and `error`
when evaluation fails.

`llm_tokens_total`
: Counter of LLM tokens recorded from generated chat responses, labeled by
`provider`, `model`, and `token_type` (`prompt`, `completion`, or `total`).
