"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CitationCard } from "@/components/ai";
import { DashboardShell } from "@/components/DashboardShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import {
  getConversation,
  listWorkspaceConversations,
} from "@/lib/chat";
import { listDocuments } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useChatStream } from "@/hooks/useChatStream";
import { listWorkspaces } from "@/lib/workspaces";
import type {
  AnswerEvaluation,
  Citation,
  ConversationSummary,
  Document,
  Workspace,
} from "@/types";

type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

type ChatMessage = {
  citations: Citation[];
  citationsOpen?: boolean;
  content: string;
  createdAt?: string;
  evaluation?: AnswerEvaluation;
  evaluationOpen?: boolean;
  id: string;
  isCorrected?: boolean;
  isPending?: boolean;
  role: "assistant" | "user";
  streamStatus?: string;
};

const exampleQuestions = [
  "Summarize the most important decisions in these documents.",
  "Which technologies does this project use and why?",
  "What risks or missing requirements should I pay attention to?",
];

const strategyDescriptions: Record<RetrievalStrategy, string> = {
  hybrid: "Best default: combines semantic and keyword signals.",
  keyword: "Useful when exact terms, IDs, or filenames matter.",
  semantic: "Useful for broad questions and conceptual matches.",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function isAdminRole(role: string | undefined) {
  return role === "admin" || role === "super_admin";
}

function hasIndexedDocuments(documents: Document[]) {
  return documents.some((document) => document.status === "indexed");
}

function scoreTone(value: number, inverted = false) {
  if (inverted) {
    if (value <= 0.3) {
      return "success";
    }
    if (value <= 0.6) {
      return "warning";
    }
    return "critical";
  }

  if (value >= 0.75) {
    return "success";
  }
  if (value >= 0.5) {
    return "warning";
  }
  return "critical";
}

function EvaluationBars({ evaluation }: { evaluation: AnswerEvaluation }) {
  const rows = [
    { label: "Faithfulness", value: evaluation.faithfulness },
    { label: "Relevance", value: evaluation.relevance },
    { label: "Context precision", value: evaluation.context_precision },
    {
      inverted: true,
      label: "Hallucination risk",
      value: evaluation.hallucination_score,
    },
  ];

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const width = Math.max(0, Math.min(100, row.value * 100));
        const tone = scoreTone(row.value, row.inverted);
        const color =
          tone === "success"
            ? "bg-emerald-600"
            : tone === "warning"
              ? "bg-amber-500"
              : "bg-red-600";

        return (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-slate-600">{row.label}</span>
              <StatusBadge label={row.value.toFixed(2)} tone={tone} />
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
      {evaluation.explanation ? (
        <p className="rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {evaluation.explanation}
        </p>
      ) : null}
    </div>
  );
}

function MessageBubble({
  canViewTrace,
  message,
  onCopy,
  onToggleCitations,
  onToggleEvaluation,
}: {
  canViewTrace: boolean;
  message: ChatMessage;
  onCopy: (message: ChatMessage) => void;
  onToggleCitations: (messageId: string) => void;
  onToggleEvaluation: (messageId: string) => void;
}) {
  const isAssistant = message.role === "assistant";

  return (
    <article
      className={
        isAssistant
          ? "w-full max-w-4xl rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          : "ml-auto w-full max-w-3xl rounded-md bg-slate-950 p-4 text-white shadow-sm sm:w-fit"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              isAssistant
                ? "text-xs font-semibold uppercase tracking-wide text-slate-500"
                : "text-xs font-semibold uppercase tracking-wide text-slate-300"
            }
          >
            {isAssistant ? "Assistant" : "You"}
          </span>
          {message.isCorrected ? <StatusBadge label="Corrected" tone="warning" /> : null}
          {message.isPending ? <StatusBadge label="Streaming" tone="info" /> : null}
        </div>
        {message.createdAt ? (
          <time className={isAssistant ? "text-xs text-slate-400" : "text-xs text-slate-300"}>
            {formatDate(message.createdAt)}
          </time>
        ) : null}
      </div>

      <div
        className={
          isAssistant
            ? "mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800"
            : "mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white"
        }
      >
        {message.content || (message.isPending ? "Preparing answer..." : "")}
        {message.isPending ? (
          <span className="ml-0.5 inline-block animate-pulse text-slate-500">|</span>
        ) : null}
      </div>

      {message.streamStatus ? (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          {message.streamStatus}
        </div>
      ) : null}

      {isAssistant ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onCopy(message)}
            disabled={!message.content}
          >
            Copy answer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onToggleCitations(message.id)}
            disabled={message.citations.length === 0}
          >
            {message.citationsOpen ? "Hide citations" : `View citations (${message.citations.length})`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onToggleEvaluation(message.id)}
            disabled={!message.evaluation}
          >
            {message.evaluationOpen ? "Hide evaluation" : "View evaluation"}
          </Button>
          {canViewTrace && !message.id.startsWith("local-") ? (
            <Link
              href={`/admin/rag-traces/${message.id}`}
              className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              View trace
            </Link>
          ) : null}
        </div>
      ) : null}

      {isAssistant && message.citationsOpen && message.citations.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {message.citations.map((citation) => (
            <CitationCard key={`${message.id}-${citation.id}-${citation.chunk_id}`} citation={citation} />
          ))}
        </div>
      ) : null}

      {isAssistant && message.evaluationOpen && message.evaluation ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
          <EvaluationBars evaluation={message.evaluation} />
        </div>
      ) : null}
    </article>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const submitInFlightRef = useRef(false);
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const {
    error: streamError,
    isStreaming,
    sendStreamingMessage,
    stage,
    stopStreaming,
  } = useChatStream();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingWorkspaceData, setIsLoadingWorkspaceData] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [retrievalStrategy, setRetrievalStrategy] =
    useState<RetrievalStrategy>("hybrid");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const selectedWorkspace = workspaces.find(
    (workspace) => workspace.id === selectedWorkspaceId,
  );
  const indexedDocumentCount = documents.filter(
    (document) => document.status === "indexed",
  ).length;
  const canViewTrace = isAdminRole(user?.role);
  const canSend = Boolean(
    selectedWorkspaceId &&
      hasIndexedDocuments(documents) &&
      question.trim() &&
      !isStreaming &&
      !isSubmitting,
  );

  const statusSteps = useMemo(
    () => [
      "Rewriting query...",
      "Retrieving context...",
      "Reranking chunks...",
      "Generating answer...",
      "Evaluating answer...",
      "Checking answer...",
    ],
    [],
  );

  const loadWorkspaceData = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId) {
        setDocuments([]);
        setConversations([]);
        return;
      }

      setIsLoadingWorkspaceData(true);
      setError(null);

      try {
        const [documentResponse, conversationResponse] = await Promise.all([
          listDocuments(workspaceId),
          listWorkspaceConversations(workspaceId),
        ]);
        setDocuments(documentResponse);
        setConversations(conversationResponse);
      } catch (requestError) {
        if (requestError instanceof ApiRequestError) {
          if (requestError.status === 401) {
            removeToken();
            router.replace("/login");
            return;
          }

          if (requestError.status === 403) {
            setError(COMMON_ERROR_MESSAGES.forbidden);
            return;
          }
        }

        setError(
          requestErrorMessage(
            requestError,
            "Unable to load workspace chat data.",
          ),
        );
      } finally {
        setIsLoadingWorkspaceData(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    async function loadWorkspaces() {
      setIsLoadingWorkspaces(true);
      setError(null);

      try {
        const response = await listWorkspaces();
        if (!isMounted) {
          return;
        }

        setWorkspaces(response);
        setSelectedWorkspaceId((current) => current || response[0]?.id || "");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        if (requestError instanceof ApiRequestError && requestError.status === 401) {
          removeToken();
          router.replace("/login");
          return;
        }

        setError(requestErrorMessage(requestError, "Unable to load workspaces."));
      } finally {
        if (isMounted) {
          setIsLoadingWorkspaces(false);
        }
      }
    }

    void loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [router, user]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      return;
    }

    setConversationId(null);
    setMessages([]);
    setQuestion("");
    void loadWorkspaceData(selectedWorkspaceId);
  }, [loadWorkspaceData, selectedWorkspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!copyStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyStatus(null), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  async function refreshConversations() {
    if (!selectedWorkspaceId) {
      return;
    }

    try {
      setConversations(await listWorkspaceConversations(selectedWorkspaceId));
    } catch {
      // Conversation refresh is secondary to answer generation.
    }
  }

  async function handleLoadConversation(nextConversationId: string) {
    setIsLoadingConversation(true);
    setError(null);

    try {
      const conversation = await getConversation(nextConversationId);
      setConversationId(conversation.id);
      setMessages(
        conversation.messages.map((message) => ({
          citations: message.citations ?? [],
          content: message.content,
          createdAt: message.created_at,
          id: message.id,
          role: message.role === "assistant" ? "assistant" : "user",
        })),
      );
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        removeToken();
        router.replace("/login");
        return;
      }

      setError(requestErrorMessage(requestError, "Unable to load conversation."));
    } finally {
      setIsLoadingConversation(false);
    }
  }

  function handleNewChat() {
    if (isStreaming) {
      stopStreaming();
    }
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  }

  function handleStopStreaming() {
    stopStreaming();
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    setMessages((current) =>
      current.map((message) =>
        message.isPending
          ? {
              ...message,
              isPending: false,
              streamStatus: "Stopped",
            }
          : message,
      ),
    );
  }

  async function handleCopy(message: ChatMessage) {
    if (!message.content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(message.content);
      setCopyStatus("Answer copied.");
    } catch {
      setCopyStatus("Unable to copy from this browser.");
    }
  }

  function toggleMessagePanel(messageId: string, panel: "citationsOpen" | "evaluationOpen") {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, [panel]: !message[panel] } : message,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuestion = question.trim();
    if (isStreaming || isSubmitting || submitInFlightRef.current) {
      return;
    }

    if (!selectedWorkspaceId) {
      setError("Select a workspace before asking a question.");
      return;
    }

    if (!hasIndexedDocuments(documents)) {
      setError("No indexed documents are available in this workspace yet.");
      return;
    }

    if (!normalizedQuestion) {
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    const userMessage: ChatMessage = {
      citations: [],
      content: normalizedQuestion,
      id: `local-user-${Date.now()}`,
      role: "user",
    };
    const pendingMessage: ChatMessage = {
      citations: [],
      citationsOpen: false,
      content: "",
      evaluationOpen: false,
      id: `local-assistant-${Date.now()}`,
      isPending: true,
      role: "assistant",
      streamStatus: "Starting...",
    };
    let assistantMessageKey = pendingMessage.id;

    function updateAssistantMessage(
      updater: (message: ChatMessage) => ChatMessage,
    ) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageKey ? updater(message) : message,
        ),
      );
    }

    setMessages((current) => [...current, userMessage, pendingMessage]);
    setQuestion("");
    setError(null);

    try {
      await sendStreamingMessage({
        workspaceId: selectedWorkspaceId,
        question: normalizedQuestion,
        conversationId,
        retrievalStrategy,
        onStart: (data) => {
          setConversationId(data.conversation_id);
          updateAssistantMessage((message) => ({
            ...message,
            streamStatus: "Rewriting query...",
          }));
        },
        onTrace: (_trace, label) => {
          updateAssistantMessage((message) => ({
            ...message,
            streamStatus: label,
          }));
        },
        onToken: (text) => {
          updateAssistantMessage((message) => ({
            ...message,
            content: `${message.content}${text}`,
            streamStatus: "Generating answer...",
          }));
        },
        onCitations: (citations) => {
          updateAssistantMessage((message) => ({
            ...message,
            citations,
            citationsOpen: citations.length > 0 ? true : message.citationsOpen,
          }));
        },
        onEvaluation: (evaluation) => {
          updateAssistantMessage((message) => ({
            ...message,
            evaluation,
            evaluationOpen: true,
          }));
        },
        onCorrection: (correction) => {
          if (!correction.corrected || !correction.final_answer) {
            return;
          }

          updateAssistantMessage((message) => ({
            ...message,
            content: correction.final_answer ?? message.content,
            isCorrected: true,
          }));
        },
        onMessage: (data) => {
          const previousKey = assistantMessageKey;
          assistantMessageKey = data.message_id;
          setConversationId(data.conversation_id);
          setMessages((current) =>
            current.map((message) =>
              message.id === previousKey
                ? {
                    ...message,
                    id: data.message_id,
                    isPending: false,
                    streamStatus: undefined,
                  }
                : message,
            ),
          );
        },
        onDone: () => {
          updateAssistantMessage((message) => ({
            ...message,
            isPending: false,
            streamStatus: undefined,
          }));
        },
        onError: (message) => {
          setError(message);
        },
        onFallbackResponse: (response) => {
          const previousKey = assistantMessageKey;
          assistantMessageKey = response.message_id;
          setConversationId(response.conversation_id);
          setMessages((current) =>
            current.map((message) =>
              message.id === previousKey
                ? {
                    ...message,
                    citations: response.citations,
                    citationsOpen: response.citations.length > 0,
                    content: response.answer,
                    evaluation: response.evaluation,
                    evaluationOpen: Boolean(response.evaluation),
                    id: response.message_id,
                    isPending: false,
                    streamStatus: undefined,
                  }
                : message,
            ),
          );
        },
      });

      await refreshConversations();
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        removeToken();
        router.replace("/login");
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageKey || message.id === pendingMessage.id
            ? {
                ...message,
                isPending: false,
                streamStatus: "Unable to generate an answer.",
              }
            : message,
        ),
      );
      setError(
        requestErrorMessage(
          requestError,
          "The model is unavailable or the backend returned an error.",
        ),
      );
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  if (isAuthLoading) {
    return (
      <DashboardShell activeItem="chat" title="Chat" description="Loading chat access.">
        <LoadingSkeleton label="Checking authentication" rows={4} />
      </DashboardShell>
    );
  }

  if (!user) {
    return (
      <DashboardShell
        activeItem="chat"
        title="Chat"
        description="Ask questions against indexed workspace documents with citations, evaluation, and traceability."
      >
        <ErrorState
          action={
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
          message={authError ?? "Your session expired. Please login again."}
          title="Unable to load chat"
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="chat"
      title="Chat"
      description="Ask questions against indexed workspace documents with citations, evaluation, and traceability."
    >
      <div className="grid gap-6">
        <ErrorState message={authError} title="Authentication warning" />
        <ErrorState
          action={
            error || streamError ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  selectedWorkspaceId
                    ? void loadWorkspaceData(selectedWorkspaceId)
                    : window.location.reload()
                }
              >
                Retry
              </Button>
            ) : undefined
          }
          message={error ?? streamError}
          title="Chat request failed"
        />

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <div className="grid gap-5 lg:grid-cols-[1fr_260px] lg:items-end">
              <div>
                <Badge tone="ai">RAG Chat</Badge>
                <h1 className="mt-4 text-2xl font-semibold text-slate-950">
                  Ask questions with citations and quality checks
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Select a workspace, choose a retrieval strategy, and stream an
                  answer grounded in indexed documents.
                </p>
              </div>
              <Select
                label="Workspace"
                value={selectedWorkspaceId}
                onChange={(event) => {
                  if (isStreaming) {
                    stopStreaming();
                  }
                  setSelectedWorkspaceId(event.target.value);
                  setError(null);
                }}
                disabled={
                  isLoadingWorkspaces ||
                  workspaces.length === 0 ||
                  isStreaming ||
                  isSubmitting
                }
              >
                {workspaces.length === 0 ? <option value="">No workspaces</option> : null}
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-medium text-slate-500">Workspace readiness</p>
            <p className="mt-2 truncate text-xl font-semibold text-slate-950">
              {selectedWorkspace?.name ?? "No workspace selected"}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Indexed</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">
                  {indexedDocumentCount}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Total docs</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {documents.length}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Threads</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {conversations.length}
                </p>
              </div>
            </div>
            {!selectedWorkspaceId ? (
              <p className="mt-3 text-sm text-amber-700">Select a workspace to chat.</p>
            ) : indexedDocumentCount === 0 ? (
              <p className="mt-3 text-sm text-amber-700">
                No indexed documents yet. Upload and wait for indexing before asking.
              </p>
            ) : (
              <p className="mt-3 text-sm text-emerald-700">
                Ready for RAG chat.
              </p>
            )}
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="p-4 xl:h-fit">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">
                Conversations
              </h2>
              <Button type="button" size="sm" variant="secondary" onClick={handleNewChat}>
                New
              </Button>
            </div>
            <div className="mt-4 grid gap-2">
              {isLoadingWorkspaceData ? (
                <LoadingSkeleton label="Loading conversations" rows={3} />
              ) : conversations.length === 0 ? (
                <EmptyState
                  title="No conversations yet"
                  description="Ask your first question to create a thread."
                />
              ) : (
                conversations.slice(0, 12).map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    disabled={isStreaming || isSubmitting}
                    onClick={() => void handleLoadConversation(conversation.id)}
                    className={
                      conversation.id === conversationId
                        ? "rounded-md border border-slate-950 bg-slate-950 px-3 py-2 text-left text-sm text-white"
                        : "rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    }
                  >
                    <span className="block truncate font-medium">
                      {conversation.title ?? "Untitled conversation"}
                    </span>
                    <span
                      className={
                        conversation.id === conversationId
                          ? "mt-1 block text-xs text-slate-300"
                          : "mt-1 block text-xs text-slate-500"
                      }
                    >
                      {formatDate(conversation.updated_at)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-950">
                Retrieval strategy
              </p>
              <div className="mt-3 grid gap-2">
                {(["hybrid", "semantic", "keyword"] as RetrievalStrategy[]).map(
                  (strategy) => (
                    <button
                      key={strategy}
                      type="button"
                      disabled={isStreaming || isSubmitting}
                      onClick={() => setRetrievalStrategy(strategy)}
                      className={
                        strategy === retrievalStrategy
                          ? "rounded-md border border-slate-950 bg-slate-950 px-3 py-2 text-left text-sm text-white"
                          : "rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      }
                    >
                      <span className="block font-medium capitalize">{strategy}</span>
                      <span
                        className={
                          strategy === retrievalStrategy
                            ? "mt-1 block text-xs text-slate-300"
                            : "mt-1 block text-xs text-slate-500"
                        }
                      >
                        {strategyDescriptions[strategy]}
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </Card>

          <section className="min-h-[70dvh] overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm xl:min-h-[720px]">
            <div className="flex min-h-[70dvh] flex-col xl:min-h-[720px]">
              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      {conversationId ? "Conversation" : "New conversation"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedWorkspace
                        ? `${selectedWorkspace.name} · ${retrievalStrategy} retrieval`
                        : "Select a workspace to begin."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {copyStatus ? <StatusBadge label={copyStatus} tone="success" /> : null}
                    {stage ? <StatusBadge label={stage} tone="info" /> : null}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
                {isLoadingConversation ? (
                  <LoadingSkeleton label="Loading conversation" rows={5} />
                ) : messages.length === 0 ? (
                  <div className="mx-auto grid max-w-3xl gap-4 py-10">
                    <EmptyState
                      title="Ask a question about your indexed documents"
                      description="Good questions are specific, reference decisions or requirements, and ask for evidence."
                    />
                    <div className="grid gap-2">
                      {exampleQuestions.map((example) => (
                        <button
                          key={example}
                          type="button"
                          disabled={isStreaming || isSubmitting}
                          onClick={() => setQuestion(example)}
                          className="rounded-md border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        canViewTrace={canViewTrace}
                        message={message}
                        onCopy={handleCopy}
                        onToggleCitations={(messageId) =>
                          toggleMessagePanel(messageId, "citationsOpen")
                        }
                        onToggleEvaluation={(messageId) =>
                          toggleMessagePanel(messageId, "evaluationOpen")
                        }
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {isStreaming ? (
                <div className="border-t border-slate-200 bg-white px-5 py-3">
                  <div className="flex flex-wrap gap-2">
                    {statusSteps.map((label) => (
                      <StatusBadge
                        key={label}
                        label={label}
                        tone={stage === label ? "info" : "neutral"}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="border-t border-slate-200 bg-white p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row">
                  <Textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming || isSubmitting}
                    rows={3}
                    placeholder={
                      selectedWorkspaceId
                        ? "Ask a question. Press Enter to send, Shift+Enter for a new line."
                        : "Select a workspace first."
                    }
                    containerClassName="flex-1"
                    className="min-h-[96px] resize-none"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row lg:self-end">
                    {isStreaming ? (
                      <Button
                        type="button"
                        size="lg"
                        variant="secondary"
                        onClick={handleStopStreaming}
                      >
                        Stop
                      </Button>
                    ) : null}
                    <Button type="submit" size="lg" disabled={!canSend}>
                      {isStreaming || isSubmitting ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
                {!selectedWorkspaceId ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Select a workspace before asking a question.
                  </p>
                ) : selectedWorkspaceId && indexedDocumentCount === 0 ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    This workspace has no indexed documents yet.
                  </p>
                ) : null}
              </form>
            </div>
          </section>
        </section>
      </div>
    </DashboardShell>
  );
}
