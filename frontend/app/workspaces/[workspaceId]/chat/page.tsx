"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMarkdown,
  EvaluationPills,
  FollowUpSuggestions,
  SourceList,
  TypingDots,
} from "@/components/ai";
import { DashboardShell } from "@/components/DashboardShell";
import { EmptyState, LoadingSkeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { getConversation, listWorkspaceConversations } from "@/lib/chat";
import { listDocuments } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useChatStream } from "@/hooks/useChatStream";
import { getWorkspace } from "@/lib/workspaces";
import type { AnswerEvaluation, Citation, ConversationSummary, Document, Workspace } from "@/types";

/* ─── types ──────────────────────────────────────────────────── */
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

/* ─── helpers ────────────────────────────────────────────────── */
function relTime(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const diff = (Date.now() - new Date(value).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch { return ""; }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function isAdminRole(role?: string) { return role === "admin" || role === "super_admin"; }

function informationNotFound(answer: string): boolean {
  const n = answer.toLowerCase();
  return [
    "could not find this information",
    "couldn't find this information",
    "information not found",
    "not in the uploaded documents",
    "no retrieved context",
  ].some((p) => n.includes(p));
}

/* ─── MessageBubble ──────────────────────────────────────────── */
function MessageBubble({
  canViewTrace, isLastAssistant, message, onSelect, streamingDisabled,
}: {
  canViewTrace: boolean; isLastAssistant: boolean; message: ChatMessage; onSelect: (q: string) => void; streamingDisabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";
  const notFound = isAssistant && !message.isPending && informationNotFound(message.content);

  async function copy() {
    if (!message.content) return;
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  }

  if (!isAssistant) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-tr-sm bg-brand px-4 py-3 text-sm leading-7 text-white shadow-sm">{message.content}</div>
          {message.createdAt ? <p className="mt-1 text-right text-[10px] text-fg-subtle">{relTime(message.createdAt)}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3">
      <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand-subtle-line bg-brand-subtle">
        <Icon name="sparkles" size={13} className="text-brand-fg" />
      </div>
      <div className="min-w-0 flex-1">
        <article aria-live={message.isPending ? "polite" : undefined} className="min-w-0 rounded-2xl rounded-tl-sm border border-line bg-surface p-4 shadow-sm">
          {(message.isCorrected || (message.isPending && message.streamStatus)) ? (
            <div className="mb-3 flex items-center gap-2">
              {message.isCorrected ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning-line bg-warning-subtle px-2 py-0.5 text-[10px] font-medium text-warning-surface-fg">
                  <Icon name="refreshCw" size={10} /> Corrected
                </span>
              ) : null}
              {message.isPending && message.streamStatus ? <span className="text-[10px] text-fg-subtle">{message.streamStatus}</span> : null}
            </div>
          ) : null}

          {notFound ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning-line bg-warning-subtle px-3 py-2 text-xs font-medium text-warning-surface-fg">
              <Icon name="alertCircle" size={13} />
              Information not found in the uploaded documents.
            </div>
          ) : null}

          <div className="min-w-0">
            {message.content ? (
              <>
                <ChatMarkdown content={message.content} citations={message.citations} />
                {message.isPending ? <span className="ml-px inline-block h-4 w-0.5 animate-pulse bg-fg-subtle align-text-bottom" aria-hidden="true" /> : null}
              </>
            ) : (
              <TypingDots />
            )}
          </div>

          {message.evaluation ? <div className="mt-3"><EvaluationPills evaluation={message.evaluation} /></div> : null}
          {!message.isPending ? <SourceList citations={message.citations} /> : null}
          {!message.isPending && isLastAssistant && message.content && !notFound ? (
            <FollowUpSuggestions question={message.content} onSelect={onSelect} disabled={streamingDisabled} />
          ) : null}
        </article>

        {!message.isPending ? (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={copy} title="Copy answer"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fg-subtle transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name={copied ? "checkCircle" : "fileText"} size={13} />
              {copied ? "Copied" : "Copy"}
            </button>
            {canViewTrace && !message.id.startsWith("local-") ? (
              <Link href={`/admin/rag-traces/${message.id}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fg-subtle transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                <Icon name="activity" size={13} /> Trace
              </Link>
            ) : null}
            {message.createdAt ? <span className="ml-1 text-[10px] text-fg-subtle">{relTime(message.createdAt)}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── PAGE ────────────────────────────────────────────────────── */
export default function WorkspaceChatPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params.workspaceId;
  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const { error: streamError, isStreaming, sendStreamingMessage, stage: streamStage, stopStreaming } = useChatStream();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const indexedCount = documents.filter(d => d.status === "indexed").length;
  const hasDocuments = documents.length > 0;
  const canViewTrace = isAdminRole(user?.role);
  const lastAssistantIdx = messages.reduceRight((found, m, i) => (found === -1 && m.role === "assistant" && !m.isPending ? i : found), -1);

  const handleAuthError = useCallback((e: unknown): boolean => {
    if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return true; }
    return false;
  }, [router]);

  const refreshConversations = useCallback(async () => {
    setConversations(await listWorkspaceConversations(workspaceId));
  }, [workspaceId]);

  /* smart auto-scroll */
  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);
  useEffect(() => {
    if (isNearBottom()) messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isNearBottom]);

  /* auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [question]);

  /* initial load */
  useEffect(() => {
    let mounted = true;
    if (!user || !workspaceId) return;
    async function load() {
      try {
        const [ws, docs, convs] = await Promise.all([
          getWorkspace(workspaceId),
          listDocuments(workspaceId),
          listWorkspaceConversations(workspaceId),
        ]);
        if (!mounted) return;
        setWorkspace(ws);
        setDocuments(docs);
        setConversations(convs);
        setError(null);
      } catch (e) {
        if (!mounted || handleAuthError(e)) return;
        setError(errorMessage(e, "Unable to load chat."));
      } finally {
        if (mounted) setIsLoadingPage(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [handleAuthError, user, workspaceId]);

  async function handleLoadConversation(nextId: string) {
    setIsLoadingConversation(true);
    setError(null);
    setSidebarOpen(false);
    try {
      const conv = await getConversation(nextId);
      setConversationId(conv.id);
      setMessages(conv.messages.map(m => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        citations: m.citations ?? [],
        createdAt: m.created_at,
      })));
    } catch (e) {
      if (handleAuthError(e)) return;
      setError(errorMessage(e, "Unable to load conversation."));
    } finally {
      setIsLoadingConversation(false);
    }
  }

  function handleNewChat() {
    if (isStreaming) stopStreaming();
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleStop() {
    stopStreaming();
    setMessages(c => c.map(m => m.isPending ? { ...m, isPending: false, streamStatus: "Stopped" } : m));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = question.trim();
    if (!q || isStreaming || documents.length === 0) return;

    const userMsg: ChatMessage = { id: `local-user-${Date.now()}`, role: "user", content: q, citations: [] };
    const pending: ChatMessage = { id: `local-assistant-${Date.now()}`, role: "assistant", content: "", citations: [], isPending: true, streamStatus: "Starting..." };
    let assistantKey = pending.id;
    function updateAssistant(updater: (m: ChatMessage) => ChatMessage) { setMessages(c => c.map(m => m.id === assistantKey ? updater(m) : m)); }

    setMessages(c => [...c, userMsg, pending]);
    setQuestion("");
    setError(null);

    try {
      await sendStreamingMessage({
        workspaceId, question: q, conversationId, retrievalStrategy: "hybrid",
        onStart: (data) => { setConversationId(data.conversation_id); updateAssistant(m => ({ ...m, streamStatus: "Preparing trace..." })); },
        onTrace: (_t, label) => { updateAssistant(m => ({ ...m, streamStatus: label })); },
        onToken: (text) => { updateAssistant(m => ({ ...m, content: `${m.content}${text}`, streamStatus: "Generating answer..." })); },
        onCitations: (cits) => { updateAssistant(m => ({ ...m, citations: cits })); },
        onEvaluation: (ev) => { updateAssistant(m => ({ ...m, evaluation: ev })); },
        onCorrection: (cor) => { if (!cor.corrected || !cor.final_answer) return; updateAssistant(m => ({ ...m, content: cor.final_answer ?? m.content, isCorrected: true })); },
        onMessage: (data) => {
          const prev = assistantKey; assistantKey = data.message_id; setConversationId(data.conversation_id);
          setMessages(c => c.map(m => m.id === prev ? { ...m, id: data.message_id, isPending: false, streamStatus: undefined } : m));
        },
        onDone: () => { updateAssistant(m => ({ ...m, isPending: false, streamStatus: undefined })); },
        onError: (msg) => { setError(msg); },
        onFallbackResponse: (r) => {
          const prev = assistantKey; assistantKey = r.message_id; setConversationId(r.conversation_id);
          setMessages(c => c.map(m => m.id === prev ? { ...m, id: r.message_id, content: r.answer, citations: r.citations, evaluation: r.evaluation, isPending: false, streamStatus: undefined } : m));
        },
      });
      await refreshConversations();
    } catch (e) {
      if (handleAuthError(e)) return;
      setMessages(c => c.filter(m => m.id !== pending.id && m.id !== assistantKey));
      setError(errorMessage(e, "Unable to send message."));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); formRef.current?.requestSubmit(); }
  }

  const isBusy = isAuthLoading || (user && isLoadingPage);
  if (isBusy) {
    return (
      <DashboardShell activeItem="chat" title="" workspaceId={workspaceId}>
        <LoadingSkeleton label="Loading chat" rows={4} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeItem="chat" title="" workspaceId={workspaceId}>
      <div className="-mx-4 -my-6 flex h-[calc(100dvh-3.5rem)] overflow-hidden border-t border-line bg-canvas sm:-mx-6 lg:-mx-8">

        {/* mobile sidebar */}
        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 animate-dp-fade-in bg-backdrop" />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface animate-dp-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-fg">Conversations</p>
                <button onClick={() => setSidebarOpen(false)} aria-label="Close" className="rounded-md text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><Icon name="close" size={18} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <Sidebar {...{ workspace, workspaceId, conversations, conversationId, indexedCount, documents, isStreaming, onLoad: handleLoadConversation, onNew: handleNewChat }} />
              </div>
            </div>
          </div>
        ) : null}

        {/* desktop sidebar */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">Conversations</p>
            <button type="button" onClick={handleNewChat} title="New chat"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="plus" size={13} /> New
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Sidebar {...{ workspace, workspaceId, conversations, conversationId, indexedCount, documents, isStreaming, onLoad: handleLoadConversation, onNew: handleNewChat }} />
          </div>
        </aside>

        {/* main */}
        <div className="flex min-w-0 flex-1 flex-col bg-canvas">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open conversations"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition hover:bg-hover hover:text-fg lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="menu" size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{workspace?.name ?? "Workspace"}</p>
              <p className="truncate text-[10px] text-fg-subtle">{indexedCount} indexed · {documents.length} total · hybrid retrieval</p>
            </div>
            <Link href={`/workspaces/${workspaceId}/documents`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="fileText" size={14} /> Documents
            </Link>
          </div>

          {(error || streamError || authError) ? (
            <div className="border-b border-danger-line bg-danger-subtle px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-danger-surface-fg">{error ?? streamError ?? authError}</p>
                <button onClick={() => setError(null)} className="text-xs text-danger-fg hover:underline focus-visible:outline-none">Dismiss</button>
              </div>
            </div>
          ) : null}

          {!hasDocuments ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                title="Upload documents before asking questions"
                description="This workspace needs indexed documents before retrieval can run."
                action={
                  <Link href={`/workspaces/${workspaceId}/documents`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                    <Icon name="cloudUpload" size={15} /> Upload documents
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                {isLoadingConversation ? (
                  <LoadingSkeleton label="Loading conversation" rows={5} />
                ) : messages.length === 0 ? (
                  <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-16 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-subtle-line bg-brand-subtle">
                      <Icon name="sparkles" size={24} className="text-brand-fg" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-fg">Ask about {workspace?.name ?? "this workspace"}</h2>
                      <p className="mt-2 text-sm text-fg-muted">
                        {indexedCount} document{indexedCount !== 1 ? "s" : ""} indexed · answers cite their sources
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto grid max-w-3xl gap-6">
                    {messages.map((msg, i) => (
                      <MessageBubble key={msg.id} canViewTrace={canViewTrace} isLastAssistant={i === lastAssistantIdx} message={msg}
                        onSelect={(q) => { setQuestion(q); setTimeout(() => textareaRef.current?.focus(), 0); }}
                        streamingDisabled={isStreaming} />
                    ))}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                )}
              </div>

              {isStreaming ? (
                <div role="status" aria-live="polite" className="border-t border-line bg-surface px-4 py-2.5">
                  <div className="mx-auto flex max-w-3xl items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{streamStage ?? "Generating answer..."}</span>
                  </div>
                </div>
              ) : null}

              <form ref={formRef} onSubmit={handleSubmit} className="border-t border-line bg-surface px-4 pb-4 pt-3 sm:px-6">
                <div className="mx-auto max-w-3xl">
                  <div className={`flex gap-2 rounded-xl border bg-surface transition-colors ${question ? "border-line-strong" : "border-line"}`}>
                    <textarea
                      ref={textareaRef} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={handleKeyDown}
                      disabled={isStreaming} rows={1} placeholder="Ask a question… (Enter to send)"
                      className="min-h-[52px] flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Ask a question"
                    />
                    <div className="flex shrink-0 flex-col items-end justify-end gap-2 p-2">
                      {isStreaming ? (
                        <button type="button" onClick={handleStop} title="Stop" aria-label="Stop"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                          <Icon name="close" size={16} />
                        </button>
                      ) : (
                        <button type="submit" disabled={isStreaming || !question.trim()} aria-label="Send"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40">
                          <Icon name="arrowRight" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 px-1 text-[10px] text-fg-subtle">
                    {isStreaming ? "Generating… press ✕ to stop" : "Enter to send · Shift+Enter for new line"}
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────── */
function Sidebar({
  workspace, workspaceId, conversations, conversationId, indexedCount, documents, isStreaming, onLoad, onNew,
}: {
  workspace: Workspace | null; workspaceId: string; conversations: ConversationSummary[]; conversationId: string | null;
  indexedCount: number; documents: Document[]; isStreaming: boolean; onLoad: (id: string) => void; onNew: () => void;
}) {
  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-line bg-canvas px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Workspace</p>
        <p className="mt-1 truncate text-sm font-semibold text-fg">{workspace?.name ?? "Workspace"}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-fg-muted"><span className="font-medium text-success-fg">{indexedCount}</span> indexed</span>
          <span className="text-fg-subtle">·</span>
          <span className="text-xs text-fg-muted"><span className="font-medium text-fg">{documents.length}</span> total</span>
        </div>
        <Link href={`/workspaces/${workspaceId}/documents`}
          className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-line bg-surface text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Icon name="fileText" size={13} /> Manage documents
        </Link>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Threads</p>
          <button type="button" onClick={onNew} className="text-[10px] font-medium text-brand-fg hover:underline focus-visible:outline-none">+ New</button>
        </div>
        {conversations.length === 0 ? (
          <p className="text-xs text-fg-subtle">No conversations yet.</p>
        ) : (
          <div className="grid gap-1">
            {conversations.slice(0, 12).map(conv => {
              const isActive = conv.id === conversationId;
              return (
                <button key={conv.id} type="button" disabled={isStreaming} onClick={() => onLoad(conv.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isActive ? "border border-brand-subtle-line bg-brand-subtle text-brand-fg" : "text-fg-muted hover:bg-hover hover:text-fg"}`}>
                  <span className="block truncate font-medium">{conv.title ?? "Untitled"}</span>
                  <span className="mt-0.5 block text-[10px] opacity-70">{relTime(conv.updated_at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
