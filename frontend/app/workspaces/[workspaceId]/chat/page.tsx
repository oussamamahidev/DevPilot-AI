"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadingState } from "@/components/LoadingState";
import { ApiConnectionError, ApiRequestError } from "@/lib/api";
import { removeToken } from "@/lib/auth";
import {
  getConversation,
  listWorkspaceConversations,
  queryWorkspaceChat,
} from "@/lib/chat";
import { listDocuments } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
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
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatScore(score: number) {
  return Number.isFinite(score) ? score.toFixed(3) : "0.000";
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
        <div
          key={`${citation.id}-${citation.chunk_id}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-slate-950">[{citation.id}]</span>
            <span className="max-w-full truncate font-medium">
              {citation.filename}
            </span>
            <span>Chunk {citation.chunk_index}</span>
            <span>Score {formatScore(citation.score)}</span>
          </div>

          {citation.content ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-slate-600 hover:text-slate-950">
                Preview
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-white p-3 leading-5 text-slate-700">
                {citation.content}
              </p>
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EvaluationPill({ evaluation }: { evaluation?: AnswerEvaluation }) {
  if (!evaluation) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
      <span className="rounded-full bg-slate-100 px-2.5 py-1">
        Faithfulness {formatScore(evaluation.faithfulness)}
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1">
        Relevance {formatScore(evaluation.relevance)}
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1">
        Hallucination {formatScore(evaluation.hallucination_score)}
      </span>
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
          ? "max-w-3xl rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          : "ml-auto max-w-3xl rounded-md bg-slate-950 p-4 text-white shadow-sm"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={
            isAssistant
              ? "text-xs font-semibold uppercase tracking-wide text-slate-500"
              : "text-xs font-semibold uppercase tracking-wide text-slate-300"
          }
        >
          {isAssistant ? "Assistant" : "You"}
        </p>
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
      </p>

      {message.isPending ? (
        <div className="mt-3">
          <LoadingState label="Generating answer" />
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
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || isSending || documents.length === 0) {
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
    };

    setMessages((current) => [...current, userMessage, pendingMessage]);
    setQuestion("");
    setError(null);
    setIsSending(true);

    try {
      const response = await queryWorkspaceChat(workspaceId, {
        question: normalizedQuestion,
        conversation_id: conversationId,
      });

      setConversationId(response.conversation_id);
      setMessages((current) => [
        ...current.filter((message) => message.id !== pendingMessage.id),
        {
          id: response.message_id,
          role: "assistant",
          content: response.answer,
          citations: response.citations,
          evaluation: response.evaluation,
        },
      ]);
      await refreshConversations();
    } catch (requestError) {
      if (handleAuthError(requestError)) {
        return;
      }

      setMessages((current) =>
        current.filter((message) => message.id !== pendingMessage.id),
      );
      setError(errorMessage(requestError, "Unable to send message."));
    } finally {
      setIsSending(false);
    }
  }

  const hasDocuments = documents.length > 0;
  const isBusy = isAuthLoading || (user && isLoadingPage);

  if (isBusy) {
    return (
      <DashboardShell activeItem="chat" title="Chat" workspaceId={workspaceId}>
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <LoadingState label="Loading chat" />
        </section>
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
        <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:h-fit">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              Conversations
            </h2>
            <button
              type="button"
              onClick={handleNewChat}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              New
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {conversations.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                No conversations yet.
              </p>
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
        </aside>

        <section className="min-h-[680px] rounded-md border border-slate-200 bg-slate-100 shadow-sm">
          <div className="flex min-h-[680px] flex-col">
            <div className="border-b border-slate-200 bg-white px-5 py-4">
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
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
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

            {!hasDocuments ? (
              <div className="flex flex-1 items-center justify-center px-5">
                <div className="max-w-md rounded-md border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">
                    Upload documents before asking questions.
                  </h3>
                  <Link
                    href={`/workspaces/${workspaceId}/documents`}
                    className="mt-4 inline-flex h-10 items-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Upload documents
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {isLoadingConversation ? (
                    <LoadingState label="Loading conversation" />
                  ) : messages.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                      Ask a question to start a conversation.
                    </div>
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
                  className="border-t border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      disabled={isSending}
                      rows={3}
                      placeholder="Ask a question"
                      className="min-h-[92px] flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !question.trim()}
                      className="h-11 rounded-md bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:self-end"
                    >
                      {isSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
