# 06 — UML Package

This chapter presents the UML modelling of the DevPilot AI platform: a use-case
diagram, the principal sequence diagrams, the domain class diagram, the component
and deployment diagrams, and a traceability diagram linking a message to its
observability records. All diagrams are expressed with Mermaid.

---

## 1. Use-Case Diagram

Actors: **User**, **Admin**, **Super-Admin**. The Admin inherits all User
capabilities and adds operational supervision; the Super-Admin inherits all
Admin capabilities.

```mermaid
flowchart LR
    User([User])
    Admin([Admin])
    SuperAdmin([Super-Admin])

    UC_Auth(["Authenticate / Register"])
    UC_WS(["Manage Workspace"])
    UC_Docs(["Upload / Manage Documents"])
    UC_Chat(["Ask Question / RAG Chat"])
    UC_Hist(["View Conversation History"])
    UC_Ops(["Supervise RAGOps"])
    UC_Trace(["Inspect RAG Traces"])

    User --> UC_Auth
    User --> UC_WS
    User --> UC_Docs
    User --> UC_Chat
    User --> UC_Hist

    Admin --> UC_Auth
    Admin --> UC_WS
    Admin --> UC_Docs
    Admin --> UC_Chat
    Admin --> UC_Hist
    Admin --> UC_Ops
    Admin --> UC_Trace

    SuperAdmin --> UC_Ops
    SuperAdmin --> UC_Trace

    Admin -.->|is-a| User
    SuperAdmin -.->|is-a| Admin
```

---

## 2. Sequence Diagrams

### 2.1 Document Ingestion

```mermaid
sequenceDiagram
    actor User
    participant API as FastAPI
    participant DocSvc as DocumentService
    participant DB as PostgreSQL
    participant Queue as Redis / Celery
    participant Worker as Celery Worker
    participant Embed as Ollama (embeddings)
    participant Qdrant

    User->>API: POST /workspaces/{id}/documents (multipart file)
    API->>DocSvc: handle upload
    DocSvc->>DB: INSERT document (status=queued)
    DocSvc->>Queue: enqueue ingestion task
    API-->>User: 201 Created (document, status=queued)

    Queue->>Worker: dispatch task
    Worker->>DB: UPDATE document (status=processing)
    Worker->>Worker: parse + split into chunks
    Worker->>DB: INSERT chunks
    Worker->>Embed: embed chunk contents
    Embed-->>Worker: vectors
    Worker->>Qdrant: upsert points
    Qdrant-->>Worker: point ids
    Worker->>DB: UPDATE chunks (vector_id), document (status=indexed, processed_at)
```

### 2.2 RAG Streaming Query (7-agent flow with SSE)

```mermaid
sequenceDiagram
    actor User
    participant API as FastAPI (SSE)
    participant WF as AgenticRAGWorkflow
    participant Router
    participant Rewriter as QueryRewriter
    participant Retrieval as RetrievalAgent
    participant Reranker
    participant Generator
    participant Evaluator
    participant Corrector
    participant DB as PostgreSQL

    User->>API: POST /workspaces/{id}/chat/stream (Bearer JWT)
    API-->>User: SSE: start
    API->>WF: run(query)

    WF->>Router: route(query)
    Router-->>WF: route decision
    API-->>User: SSE: trace (router)

    WF->>Rewriter: rewrite(query)
    Rewriter-->>WF: rewritten query
    API-->>User: SSE: trace (query_rewriter)

    WF->>Retrieval: retrieve(query)
    Retrieval-->>WF: candidate chunks
    API-->>User: SSE: trace (retrieval)

    WF->>Reranker: rerank(chunks)
    Reranker-->>WF: ranked chunks
    API-->>User: SSE: trace (reranker)
    API-->>User: SSE: citations

    WF->>Generator: generate(context)
    Generator-->>WF: streamed answer
    API-->>User: SSE: token (xN)

    WF->>Evaluator: evaluate(answer, context)
    Evaluator-->>WF: scores
    API-->>User: SSE: evaluation

    opt Quality below threshold
        WF->>Corrector: correct(answer)
        Corrector-->>WF: corrected answer
        API-->>User: SSE: correction
    end

    WF->>DB: persist message, agent_runs, retrieved_chunks, evaluations, llm_usage
    API-->>User: SSE: message
    API-->>User: SSE: done
```

### 2.3 Admin Trace Inspection

```mermaid
sequenceDiagram
    actor Admin
    participant API as FastAPI
    participant Auth as Role Guard (admin)
    participant TraceSvc as RagTracesService
    participant DB as PostgreSQL

    Admin->>API: GET /admin/rag-traces?filters (Bearer JWT)
    API->>Auth: verify admin role
    Auth-->>API: authorized
    API->>TraceSvc: list_traces(filters, page)
    TraceSvc->>DB: query messages + evaluations + retrieved_chunks
    DB-->>TraceSvc: paginated traces
    TraceSvc-->>API: trace list
    API-->>Admin: trace list

    Admin->>API: GET /admin/rag-traces/{message_id}
    API->>TraceSvc: get_trace(message_id)
    TraceSvc->>DB: load agent_runs, retrieved_chunks, evaluation, llm_usage
    DB-->>TraceSvc: full trace
    TraceSvc-->>API: full trace
    API-->>Admin: full trace (retrieval, reranking, evaluation)
```

---

## 3. Class Diagram

The domain comprises the 11 SQLAlchemy ORM models, the 7 pipeline agents
orchestrated by `AgenticRAGWorkflow`, and the key application services.

```mermaid
classDiagram
    %% ===== ORM Models =====
    class User {
        +UUID id
        +str email
        +str full_name
        +str hashed_password
        +str role
        +bool is_active
        +datetime created_at
        +datetime updated_at
        +datetime deleted_at
    }
    class Workspace {
        +UUID id
        +str name
        +str description
        +UUID owner_id
        +datetime created_at
        +datetime updated_at
    }
    class WorkspaceMember {
        +UUID id
        +UUID workspace_id
        +UUID user_id
        +str role
        +datetime created_at
    }
    class Document {
        +UUID id
        +UUID workspace_id
        +str filename
        +str file_type
        +int file_size
        +str status
        +UUID uploaded_by
        +str storage_path
        +datetime created_at
        +datetime processed_at
    }
    class Chunk {
        +UUID id
        +UUID document_id
        +int chunk_index
        +str content
        +str vector_id
        +datetime created_at
    }
    class Conversation {
        +UUID id
        +UUID user_id
        +UUID workspace_id
        +str title
        +datetime created_at
        +datetime updated_at
    }
    class Message {
        +UUID id
        +UUID conversation_id
        +str role
        +str content
        +datetime created_at
    }
    class AgentRun {
        +UUID id
        +UUID message_id
        +str agent_type
        +str status
        +int latency_ms
        +dict input_preview
        +dict output_preview
        +str error
        +datetime created_at
    }
    class RetrievedChunk {
        +UUID id
        +UUID message_id
        +UUID chunk_id
        +UUID document_id
        +str filename
        +int rank
        +float score
        +str content_preview
        +datetime created_at
    }
    class Evaluation {
        +UUID id
        +UUID message_id
        +float faithfulness
        +float relevance
        +float context_precision
        +float hallucination_score
        +str explanation
        +str evaluation_method
        +bool corrected
        +str correction_reason
        +datetime created_at
    }
    class LLMUsage {
        +UUID id
        +UUID message_id
        +str model
        +int prompt_tokens
        +int completion_tokens
        +int total_tokens
        +Decimal cost_usd
        +datetime created_at
    }

    User "1" --> "*" Workspace : owns
    User "1" --> "*" WorkspaceMember
    Workspace "1" --> "*" WorkspaceMember
    Workspace "1" --> "*" Document
    Document "1" --> "*" Chunk
    User "1" --> "*" Conversation
    Workspace "1" --> "*" Conversation
    Conversation "1" --> "*" Message
    Message "1" --> "*" AgentRun
    Message "1" --> "*" RetrievedChunk
    Message "1" --> "1" Evaluation
    Message "1" --> "*" LLMUsage
    Chunk "1" --> "*" RetrievedChunk

    %% ===== Agents & Workflow =====
    class AgenticRAGWorkflow {
        +run(query)
        +stream(query)
    }
    class RouterAgent {
        +route(query)
    }
    class QueryRewriterAgent {
        +rewrite(query)
    }
    class RetrievalAgent {
        +retrieve(query)
    }
    class RerankerAgent {
        +rerank(chunks)
    }
    class GeneratorAgent {
        +generate(context)
    }
    class EvaluatorAgent {
        +evaluate(answer, context)
    }
    class CorrectorAgent {
        +correct(answer)
    }

    AgenticRAGWorkflow --> RouterAgent
    AgenticRAGWorkflow --> QueryRewriterAgent
    AgenticRAGWorkflow --> RetrievalAgent
    AgenticRAGWorkflow --> RerankerAgent
    AgenticRAGWorkflow --> GeneratorAgent
    AgenticRAGWorkflow --> EvaluatorAgent
    AgenticRAGWorkflow --> CorrectorAgent

    %% ===== Services =====
    class DocumentService {
        +upload()
        +list()
        +delete()
    }
    class RetrievalService {
        +retrieve()
    }
    class RerankingService {
        +rerank()
    }
    class EvaluationService {
        +evaluate()
    }
    class RagTracesService {
        +list_traces()
        +get_trace()
    }

    DocumentService --> Document
    DocumentService --> Chunk
    RetrievalAgent --> RetrievalService
    RerankerAgent --> RerankingService
    EvaluatorAgent --> EvaluationService
    RagTracesService --> Message
    RagTracesService --> AgentRun
    RagTracesService --> RetrievedChunk
    RagTracesService --> Evaluation
    RagTracesService --> LLMUsage
```

---

## 4. Component Diagram

```mermaid
flowchart TB
    subgraph Client
        FE[Frontend - Next.js]
    end

    subgraph Backend
        API[FastAPI Application]
    end

    subgraph DataStores
        PG[(PostgreSQL)]
        RC[Redis / Celery]
        QD[(Qdrant)]
    end

    subgraph LLM
        OL[Ollama - local models]
        GM[Gemini API - external]
    end

    subgraph Observability
        PR[Prometheus]
        GR[Grafana]
    end

    FE <-->|REST / SSE| API
    API <--> PG
    API <--> RC
    API <--> QD
    API <--> OL
    API <--> GM
    API -->|metrics| PR
    PR --> GR
```

---

## 5. Deployment Diagram

The platform runs as 8 Docker Compose services, with **Ollama hosted on the
host machine** and **Gemini reached as an external API**.

```mermaid
flowchart TB
    subgraph Host[Host Machine]
        OL[Ollama - host service]

        subgraph Compose[Docker Compose - 8 services]
            FE[frontend]
            API[backend - FastAPI]
            WK[celery worker]
            BT[celery beat]
            PG[(postgres)]
            RD[redis]
            QD[(qdrant)]
            PR[prometheus]
        end
    end

    subgraph External
        GM[Gemini API]
    end

    GR[Grafana]

    FE --> API
    API --> PG
    API --> RD
    API --> QD
    API --> OL
    API --> GM
    WK --> RD
    WK --> PG
    WK --> QD
    WK --> OL
    BT --> RD
    API --> PR
    PR --> GR
```

> Note: the 8 Compose services are `frontend`, `backend`, `celery worker`,
> `celery beat`, `postgres`, `redis`, `qdrant`, and `prometheus`. Ollama runs on
> the host; Gemini is an external API; Grafana visualises Prometheus metrics.

---

## 6. Traceability Diagram

A single assistant **message** is the anchor for all observability records
generated by the agentic pipeline.

```mermaid
flowchart LR
    M[message]
    AR[agent_runs - 7 agent steps]
    RC[retrieved_chunks - ranked sources]
    EV[evaluations - 1:1 quality scores]
    LU[llm_usage - tokens & cost]

    M -->|1..*| AR
    M -->|1..*| RC
    M -->|1..1| EV
    M -->|1..*| LU
```
