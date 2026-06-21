from prometheus_client import Counter, Histogram


HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests handled by the backend.",
    ("method", "path", "status_code"),
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds.",
    ("method", "path", "status_code"),
)

DOCUMENTS_UPLOADED_TOTAL = Counter(
    "documents_uploaded_total",
    "Total documents accepted for upload.",
    ("file_type",),
)
DOCUMENT_PROCESSING_DURATION_SECONDS = Histogram(
    "document_processing_duration_seconds",
    "Document processing task duration in seconds.",
    ("status",),
)
DOCUMENT_PROCESSING_FAILURES_TOTAL = Counter(
    "document_processing_failures_total",
    "Total document processing failures.",
    ("error_type",),
)

RAG_QUERIES_TOTAL = Counter(
    "rag_queries_total",
    "Total RAG chat queries.",
    ("status",),
)
RAG_QUERY_DURATION_SECONDS = Histogram(
    "rag_query_duration_seconds",
    "RAG chat query latency in seconds.",
    ("status",),
)
RETRIEVAL_LATENCY_SECONDS = Histogram(
    "retrieval_latency_seconds",
    "Retrieval latency in seconds.",
    ("strategy", "status"),
)
EVALUATION_LATENCY_SECONDS = Histogram(
    "evaluation_latency_seconds",
    "Answer evaluation latency in seconds.",
    ("status",),
)

LLM_TOKENS_TOTAL = Counter(
    "llm_tokens_total",
    "Total LLM tokens consumed.",
    ("provider", "model", "token_type"),
)


def initialize_metric_labels(*, llm_provider: str, llm_model: str) -> None:
    for file_type in ("pdf", "txt", "markdown"):
        DOCUMENTS_UPLOADED_TOTAL.labels(file_type=file_type).inc(0)

    for status in ("indexed", "failed", "missing", "deleted", "unknown"):
        DOCUMENT_PROCESSING_DURATION_SECONDS.labels(status=status)

    DOCUMENT_PROCESSING_FAILURES_TOTAL.labels(error_type="unknown").inc(0)

    for status in ("success", "error"):
        RAG_QUERIES_TOTAL.labels(status=status).inc(0)
        RAG_QUERY_DURATION_SECONDS.labels(status=status)

    for strategy in ("semantic", "keyword", "hybrid", "unknown"):
        for status in ("success", "error"):
            RETRIEVAL_LATENCY_SECONDS.labels(strategy=strategy, status=status)

    for status in ("llm", "heuristic", "error"):
        EVALUATION_LATENCY_SECONDS.labels(status=status)

    for token_type in ("prompt", "completion", "total"):
        LLM_TOKENS_TOTAL.labels(
            provider=llm_provider,
            model=llm_model,
            token_type=token_type,
        ).inc(0)
