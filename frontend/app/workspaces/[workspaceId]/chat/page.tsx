"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CitationCard, EvaluationMetrics } from "@/components/ai";
import { DashboardShell } from "@/components/DashboardShell";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  Button,
  Card,
  EmptyState,
  LoadingSkeleton,
  Textarea,
} from "@/components/ui";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import {
  getConversation,
  listWorkspaceConversations,
} from "@/lib/chat";
import { listDocuments } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useChatStream } from "@/hooks/useChatStream";
import { getWorkspace } from "@/lib/workspaces";
import type {
  AnswerEvaluation,
  Citation,
  ConversationSummary,
  Document,
  Workspace,
} from "@/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt?: string;
  evaluation?: AnswerEvaluation;
  isPending?: boolean;
  isCorrected?: boolean;
  streamStatus?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function informationNotFound(answer: string) {
  const normalized = answer.toLowerCase();
  return [
    "could not find this information",
    "couldn't find this information",
    "information not found",
    "not in the uploaded documents",
    "no retrieved context",
  ].some((phrase) => normalized.includes(phrase));
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-2">
      {citations.map((citation) => (
        <CitationCard key={`${citation.id}-${citation.chunk_id}`} citation={citation} />
      ))}
    </div>
  );
}

function EvaluationPill({ evaluation }: { evaluation?: AnswerEvaluation }) {
  if (!evaluation) {
    return null;
  }

  return (
    <div className="mt-3">
      <EvaluationMetrics evaluation={evaluation} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  const notFound = isAssistant && informationNotFound(message.content);

  return (
    <article
      className={
        isAssistant
          ? "w-full max-w-3xl rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          : "ml-auto w-full max-w-3xl rounded-md bg-slate-950 p-4 text-white shadow-sm sm:w-fit"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={
              isAssistant
                ? "text-xs font-semibold uppercase tracking-wide text-slate-500"
                : "text-xs font-semibold uppercase tracking-wide text-slate-300"
            }
          >
            {isAssistant ? "Assistant" : "You"}
          </p>
          {message.isCorrected ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              Corrected
            </span>
          ) : null}
        </div>
        {message.createdAt ? (
          <time
            className={
              isAssistant ? "text-xs text-slate-400" : "text-xs text-slate-300"
            }
          >
            {formatDate(message.createdAt)}
          </time>
        ) : null}
      </div>

      {notFound ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Information not found in uploaded documents.
        </div>
      ) : null}

      <p
        className={
          isAssistant
            ? "mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800"
            : "mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white"
        }
      >
        {message.content}
        {message.isPending ? (
          <span className="ml-0.5 inline-block animate-pulse text-slate-500">|</span>
        ) : null}
      </p>

      {message.isPending ? (
        <div className="mt-3 text-xs font-medium text-slate-500">
          {message.streamStatus ?? "Generating answer..."}
        </div>
      ) : null}

      {isAssistant ? (
        <>
          <CitationList citations={message.citations} />
          <EvaluationPill evaluation={message.evaluation} />
        </>
      ) : null}
    </article>
  );
}

export default function WorkspaceChatPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const {
    error: streamError,
    isStreaming,
    sendStreamingMessage,
    stage: streamStage,
    stopStreaming,
  } = useChatStream();

  const handleAuthError = useCallback(
    (requestError: unknown) => {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        removeToken();
        router.replace("/login");
        return true;
      }

      return false;
    },
    [router],
  );

  const refreshConversations = useCallback(async () => {
    const response = await listWorkspaceConversations(workspaceId);
    setConversations(response);
  }, [workspaceId]);

  useEffect(() => {
    let isMounted = true;

    if (!user || !workspaceId) {
      return;
    }

    async function loadPage() {
      try {
        const [workspaceResponse, documentResponse, conversationResponse] =
          await Promise.all([
            getWorkspace(workspaceId),
            listDocuments(workspaceId),
            listWorkspaceConversations(workspaceId),
          ]);

        if (!isMounted) {
          return;
        }

        setWorkspace(workspaceResponse);
        setDocuments(documentResponse);
        setConversations(conversationResponse);
        setError(null);
      } catch (requestError) {
        if (!isMounted || handleAuthError(requestError)) {
          return;
        }

        setError(errorMessage(requestError, "Unable to load chat."));
      } finally {
        if (isMounted) {
          setIsLoadingPage(false);
        }
      }
    }

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [handleAuthError, user, workspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  async function handleLoadConversation(nextConversationId: string) {
    setIsLoadingConversation(true);
    setError(null);

    try {
      const conversation = await getConversation(nextConversationId);
      setConversationId(conversation.id);
      setMessages(
        conversation.messages.map((message) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
          citations: message.citations ?? [],
          createdAt: message.created_at,
        })),
      );
    } catch (requestError) {
      if (handleAuthError(requestError)) {
        return;
      }

      setError(errorMessage(requestError, "Unable to load conversation."));
    } finally {
      setIsLoadingConversation(false);
    }
  }

  function handleNewChat() {
    if (isStreaming) {
      stopStreaming();
    }
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  }

  function handleStopStreaming() {
    stopStreaming();
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || isStreaming || documents.length === 0) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: normalizedQuestion,
      citations: [],
    };
    const pendingMessage: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      citations: [],
      isPending: true,
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
        workspaceId,
        question: normalizedQuestion,
        conversationId,
        retrievalStrategy: "hybrid",
        onStart: (data) => {
          setConversationId(data.conversation_id);
          updateAssistantMessage((message) => ({
            ...message,
            streamStatus: "Preparing trace...",
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
          }));
        },
        onEvaluation: (evaluation) => {
          updateAssistantMessage((message) => ({
            ...message,
            evaluation,
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
                    id: response.message_id,
                    content: response.answer,
                    citations: response.citations,
                    evaluation: response.evaluation,
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
      if (handleAuthError(requestError)) {
        return;
      }

      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !== pendingMessage.id && message.id !== assistantMessageKey,
        ),
      );
      setError(errorMessage(requestError, "Unable to send message."));
    }
  }

  const hasDocuments = documents.length > 0;
  const isBusy = isAuthLoading || (user && isLoadingPage);

  if (isBusy) {
    return (
      <DashboardShell activeItem="chat" title="Chat" workspaceId={workspaceId}>
        <Card>
          <LoadingSkeleton label="Loading chat" rows={3} />
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activeItem="chat"
      title="Chat"
      description={
        workspace
          ? `Ask questions against indexed documents in ${workspace.name}.`
          : "Ask questions against indexed workspace documents."
      }
      workspaceId={workspaceId}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-4 lg:h-fit">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              Conversations
            </h2>
            <Button
              type="button"
              onClick={handleNewChat}
              size="sm"
              variant="secondary"
            >
              New
            </Button>
          </div>

          <div className="mt-4 grid gap-2">
            {conversations.length === 0 ? (
              <EmptyState title="No conversations yet" />
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void handleLoadConversation(conversation.id)}
                  className={
                    conversation.id === conversationId
                      ? "rounded-md border border-slate-950 bg-slate-950 px-3 py-2 text-left text-sm text-white"
                      : "rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
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
        </Card>

        <section className="min-h-[70dvh] overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm lg:min-h-[680px]">
          <div className="flex min-h-[70dvh] flex-col lg:min-h-[680px]">
            <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">
                    {conversationId ? "Conversation" : "New conversation"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {hasDocuments
                      ? `${documents.length} document${documents.length === 1 ? "" : "s"} available`
                      : "Upload documents before asking questions."}
                  </p>
                </div>
                <Link
                  href={`/workspaces/${workspaceId}/documents`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Documents
                </Link>
              </div>
            </div>

            {authError ? (
              <div className="px-5 pt-5">
                <ErrorMessage message={authError} />
              </div>
            ) : null}

            {error ? (
              <div className="px-5 pt-5">
                <ErrorMessage message={error} />
              </div>
            ) : null}

            {streamError && !error ? (
              <div className="px-5 pt-5">
                <ErrorMessage message={streamError} />
              </div>
            ) : null}

            {!hasDocuments ? (
              <div className="flex flex-1 items-center justify-center px-5">
                <EmptyState
                  title="Upload documents before asking questions"
                  description="The chat workspace needs indexed documents before retrieval can run."
                  action={
                    <Link
                      href={`/workspaces/${workspaceId}/documents`}
                      className="inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Upload documents
                    </Link>
                  }
                />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
                  {isLoadingConversation ? (
                    <LoadingSkeleton label="Loading conversation" rows={3} />
                  ) : messages.length === 0 ? (
                    <EmptyState
                      title="Ask a question to start a conversation"
                      description="Streaming answers, citations, and evaluation metrics will appear here."
                    />
                  ) : (
                    <div className="grid gap-4">
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="border-t border-slate-200 bg-white p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <Textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      disabled={isStreaming}
                      rows={3}
                      placeholder="Ask a question"
                      containerClassName="flex-1"
                      className="min-h-[92px] resize-none"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row lg:self-end">
                      {isStreaming ? (
                        <Button
                          type="button"
                          onClick={handleStopStreaming}
                          size="lg"
                          variant="secondary"
                        >
                          Stop
                        </Button>
                      ) : null}
                      <Button
                        type="submit"
                        disabled={isStreaming || !question.trim()}
                        size="lg"
                      >
                        {isStreaming ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                  {isStreaming || streamStage ? (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {streamStage ?? "Generating answer..."}
                    </p>
                  ) : null}
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
