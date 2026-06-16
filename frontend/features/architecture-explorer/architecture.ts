import type { IconName } from "@/components/ui/Icon";
import type { StageId } from "@/features/ai-execution-studio/types";

export type ArchGroup = "client" | "gateway" | "security" | "data" | "orchestration" | "ai" | "observability";

export const GROUP_COLOR: Record<ArchGroup, string> = {
  client: "#38bdf8",
  gateway: "#60a5fa",
  security: "#fbbf24",
  data: "#2dd4bf",
  orchestration: "#a855f7",
  ai: "#34d399",
  observability: "#f472b6",
};

export const GROUP_LABEL: Record<ArchGroup, string> = {
  client: "Client",
  gateway: "API Gateway",
  security: "Security",
  data: "Data",
  orchestration: "Orchestration",
  ai: "AI / Inference",
  observability: "Observability",
};

export type ArchNodeDef = {
  id: string;
  label: string;
  sub: string;
  group: ArchGroup;
  icon: IconName;
  position: { x: number; y: number };
  /** Maps the node to a live pipeline stage (drives real-time highlight). */
  stage?: StageId;
  /** When set, the node is explorable at /architecture-explorer/[slug]. */
  slug?: string;
  /** Nodes that light up as soon as the request enters the platform. */
  entry?: boolean;
};

export const ARCH_NODES: ArchNodeDef[] = [
  { id: "user", label: "User", sub: "Engineer asks a question", group: "client", icon: "user", position: { x: 420, y: 0 }, entry: true },
  { id: "frontend", label: "Next.js Frontend", sub: "App Router · React 19", group: "client", icon: "monitor", position: { x: 420, y: 110 }, entry: true },
  { id: "gateway", label: "FastAPI Gateway", sub: "REST + SSE streaming", group: "gateway", icon: "server", position: { x: 420, y: 220 }, entry: true },
  { id: "auth", label: "Authentication", sub: "JWT · RBAC", group: "security", icon: "lock", position: { x: 120, y: 235 }, entry: true },
  { id: "workspace", label: "Workspace Layer", sub: "Isolation · membership", group: "security", icon: "layers", position: { x: 120, y: 345 }, entry: true },
  { id: "document", label: "Document Layer", sub: "Ingestion · chunking", group: "data", icon: "file", position: { x: 120, y: 455 }, entry: true },
  { id: "orchestrator", label: "RAG Orchestrator", sub: "Agentic workflow", group: "orchestration", icon: "workflow", position: { x: 420, y: 360 }, entry: true },
  { id: "embedding", label: "Embedding Service", sub: "nomic-embed-text · 768-d", group: "ai", icon: "cpu", position: { x: 420, y: 475 }, stage: "embedding", slug: "embedding" },
  { id: "qdrant", label: "Qdrant Vector DB", sub: "HNSW · cosine", group: "data", icon: "database", position: { x: 420, y: 590 }, stage: "search", slug: "qdrant" },
  { id: "reranker", label: "Reranker", sub: "Cross-encoder rerank", group: "ai", icon: "activity", position: { x: 420, y: 705 }, stage: "rerank", slug: "reranking" },
  { id: "prompt", label: "Prompt Builder", sub: "System + context + query", group: "orchestration", icon: "code", position: { x: 420, y: 820 }, stage: "prompt", slug: "prompt-builder" },
  { id: "llm", label: "LLM Generation", sub: "Gemini 2.5 Flash", group: "ai", icon: "sparkles", position: { x: 420, y: 935 }, stage: "generation", slug: "llm" },
  { id: "evaluation", label: "Evaluation Engine", sub: "Faithfulness · hallucination", group: "ai", icon: "shield", position: { x: 420, y: 1050 }, stage: "evaluation", slug: "evaluation" },
  { id: "trace", label: "Trace Engine", sub: "Full execution lineage", group: "observability", icon: "layers", position: { x: 720, y: 1000 }, stage: "persistence", slug: "trace-engine" },
  { id: "ragops", label: "RAGOps Monitoring", sub: "Health · pipelines", group: "observability", icon: "activity", position: { x: 720, y: 1110 }, slug: "ragops" },
  { id: "response", label: "Final Response", sub: "Grounded · cited answer", group: "client", icon: "checkCircle", position: { x: 420, y: 1165 }, entry: false },
];

export type ArchEdgeDef = { id: string; source: string; target: string; main?: boolean };

export const ARCH_EDGES: ArchEdgeDef[] = [
  { id: "e-user-fe", source: "user", target: "frontend", main: true },
  { id: "e-fe-gw", source: "frontend", target: "gateway", main: true },
  { id: "e-gw-auth", source: "gateway", target: "auth" },
  { id: "e-auth-ws", source: "auth", target: "workspace" },
  { id: "e-ws-doc", source: "workspace", target: "document" },
  { id: "e-gw-orch", source: "gateway", target: "orchestrator", main: true },
  { id: "e-doc-orch", source: "document", target: "orchestrator" },
  { id: "e-orch-emb", source: "orchestrator", target: "embedding", main: true },
  { id: "e-emb-qd", source: "embedding", target: "qdrant", main: true },
  { id: "e-qd-rr", source: "qdrant", target: "reranker", main: true },
  { id: "e-rr-pr", source: "reranker", target: "prompt", main: true },
  { id: "e-pr-llm", source: "prompt", target: "llm", main: true },
  { id: "e-llm-ev", source: "llm", target: "evaluation", main: true },
  { id: "e-ev-resp", source: "evaluation", target: "response", main: true },
  { id: "e-ev-trace", source: "evaluation", target: "trace" },
  { id: "e-trace-ragops", source: "trace", target: "ragops" },
];

export const archNode = (id: string) => ARCH_NODES.find((n) => n.id === id);
export const EXPLORABLE = ARCH_NODES.filter((n) => n.slug);

/* ─── component explorer config (real architecture facts) ────── */
export type ComponentConfig = {
  slug: string;
  nodeId: string;
  title: string;
  tagline: string;
  group: ArchGroup;
  /** Which reusable studio panel visualises this component (if any). */
  panel?: "embedding" | "qdrant" | "reranking" | "prompt" | "llm" | "evaluation" | "trace";
  /** Real configured facts about the component. */
  facts: { label: string; value: string }[];
};

export const COMPONENTS: ComponentConfig[] = [
  {
    slug: "embedding", nodeId: "embedding", title: "Embedding Service", group: "ai", panel: "embedding",
    tagline: "Turns a natural-language query into a 768-dimensional semantic vector.",
    facts: [
      { label: "Model", value: "nomic-embed-text" }, { label: "Provider", value: "Ollama (local)" },
      { label: "Dimensions", value: "768" }, { label: "Batch size", value: "4" }, { label: "Distance", value: "Cosine" },
    ],
  },
  {
    slug: "qdrant", nodeId: "qdrant", title: "Qdrant Vector Database", group: "data", panel: "qdrant",
    tagline: "Approximate nearest-neighbour search over the embedded knowledge base.",
    facts: [
      { label: "Engine", value: "Qdrant 1.12" }, { label: "Index", value: "HNSW" }, { label: "Metric", value: "Cosine similarity" },
      { label: "Candidates", value: "15 retrieved" }, { label: "Vector dim", value: "768" },
    ],
  },
  {
    slug: "reranking", nodeId: "reranker", title: "Reranking", group: "ai", panel: "reranking",
    tagline: "Reorders candidates by fine-grained relevance — recall first, precision second.",
    facts: [
      { label: "Strategy", value: "Cross-encoder rerank" }, { label: "Input", value: "15 candidates" },
      { label: "Output", value: "Top 5" }, { label: "Signal", value: "Query–chunk relevance" },
    ],
  },
  {
    slug: "prompt-builder", nodeId: "prompt", title: "Prompt Builder", group: "orchestration", panel: "prompt",
    tagline: "Assembles the exact prompt sent to the model: system + context + question.",
    facts: [
      { label: "System prompt", value: "Grounded, cited" }, { label: "Context budget", value: "6000 chars" },
      { label: "Citations", value: "[n] markers" }, { label: "Top-k context", value: "5 chunks" },
    ],
  },
  {
    slug: "llm", nodeId: "llm", title: "LLM Generation", group: "ai", panel: "llm",
    tagline: "Streams a grounded answer token-by-token from the configured model.",
    facts: [
      { label: "Model", value: "Gemini 2.5 Flash" }, { label: "Fallback", value: "Gemini 2.0 Flash" },
      { label: "Temperature", value: "0.2" }, { label: "Max tokens", value: "1000" }, { label: "Streaming", value: "SSE" },
    ],
  },
  {
    slug: "evaluation", nodeId: "evaluation", title: "Evaluation Engine", group: "ai", panel: "evaluation",
    tagline: "Scores every answer for faithfulness, relevance, precision and hallucination risk.",
    facts: [
      { label: "Faithfulness", value: "Grounding in context" }, { label: "Relevance", value: "Answer fit" },
      { label: "Context precision", value: "Retrieval quality" }, { label: "Corrector", value: "Repairs unfaithful answers" },
    ],
  },
  {
    slug: "trace-engine", nodeId: "trace", title: "Trace Engine", group: "observability", panel: "trace",
    tagline: "Persists the full execution lineage: message → runs → chunks → evaluation.",
    facts: [
      { label: "Lineage", value: "message → agent_runs" }, { label: "Captures", value: "retrieved_chunks" },
      { label: "Captures", value: "evaluations" }, { label: "Inspectable", value: "AI Trace Inspector" },
    ],
  },
  {
    slug: "ragops", nodeId: "ragops", title: "RAGOps Monitoring", group: "observability",
    tagline: "Operational view across the platform: health, pipelines, coverage, failures.",
    facts: [
      { label: "Surfaces", value: "Qdrant health" }, { label: "Surfaces", value: "Document pipeline" },
      { label: "Surfaces", value: "Embedding coverage" }, { label: "Surfaces", value: "Agent latency" },
    ],
  },
];

export const componentBySlug = (slug: string) => COMPONENTS.find((c) => c.slug === slug);

/* ─── detail for the infra nodes (the 8 AI/data nodes reuse COMPONENTS) ── */
const NODE_DETAIL: Record<string, { description: string; facts: { label: string; value: string }[] }> = {
  user: {
    description: "The engineer asking a question. Every request is scoped to their identity and workspace membership.",
    facts: [{ label: "Identity", value: "JWT subject" }, { label: "Scope", value: "Workspace-isolated" }],
  },
  frontend: {
    description: "Next.js App Router client. Renders the chat, streams tokens over SSE and visualises every trace.",
    facts: [{ label: "Framework", value: "Next.js 15" }, { label: "UI", value: "React 19 · Tailwind" }, { label: "Data", value: "React Query" }, { label: "Streaming", value: "fetch + ReadableStream" }],
  },
  gateway: {
    description: "FastAPI gateway. Validates auth, enforces RBAC and exposes the REST + SSE streaming API.",
    facts: [{ label: "Framework", value: "FastAPI" }, { label: "Transport", value: "REST + SSE" }, { label: "Validation", value: "Pydantic" }, { label: "Async", value: "asyncio" }],
  },
  auth: {
    description: "JWT authentication with role-based access control across user, admin and super-admin.",
    facts: [{ label: "Tokens", value: "JWT (Bearer)" }, { label: "Roles", value: "user · admin · super-admin" }, { label: "Guard", value: "Per-route dependency" }],
  },
  workspace: {
    description: "Workspaces isolate knowledge. Membership controls who can read and write each space.",
    facts: [{ label: "Isolation", value: "Per-workspace" }, { label: "Membership", value: "Owner + members" }, { label: "Access", value: "403 on mismatch" }],
  },
  document: {
    description: "Asynchronous ingestion: extract → chunk → embed → index, with per-document status tracking.",
    facts: [{ label: "Worker", value: "Celery + Redis" }, { label: "Flow", value: "queued → indexed" }, { label: "Chunking", value: "overlapping windows" }, { label: "Retries", value: "3" }],
  },
  orchestrator: {
    description: "The agentic RAG workflow — router → rewrite → retrieve → rerank → generate → evaluate → correct.",
    facts: [{ label: "Agents", value: "7" }, { label: "Pattern", value: "Agentic pipeline" }, { label: "Logged", value: "agent_runs" }],
  },
  response: {
    description: "The final grounded answer returned to the user — cited, evaluated and fully traceable.",
    facts: [{ label: "Grounded", value: "From context only" }, { label: "Cited", value: "[n] markers" }, { label: "Traceable", value: "Full lineage" }],
  },
};

export function nodeDetail(nodeId: string): { description: string; facts: { label: string; value: string }[]; slug?: string } {
  const comp = COMPONENTS.find((c) => c.nodeId === nodeId);
  if (comp) return { description: comp.tagline, facts: comp.facts, slug: comp.slug };
  const d = NODE_DETAIL[nodeId];
  return { description: d?.description ?? "", facts: d?.facts ?? [] };
}
