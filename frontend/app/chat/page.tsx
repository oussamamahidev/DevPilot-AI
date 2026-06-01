"use client";

import Link from "next/link";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatMarkdown, EvaluationPills, FollowUpSuggestions, SourceList, TypingDots } from "@/components/ai";
import { DashboardShell } from "@/components/DashboardShell";
import { ErrorState, LoadingSkeleton, Select } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { removeToken } from "@/lib/auth";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import { getConversation, listWorkspaceConversations } from "@/lib/chat";
import { listDocuments } from "@/lib/documents";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useChatStream } from "@/hooks/useChatStream";
import { listWorkspaces } from "@/lib/workspaces";
import type { AnswerEvaluation, Citation, ConversationSummary, Document, Workspace } from "@/types";

/* ─── types ──────────────────────────────────────────────────── */
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

/* ─── constants ──────────────────────────────────────────────── */
const EXAMPLE_QUESTIONS = [
  "Summarize the most important decisions in these documents.",
  "Which technologies does this project use and why?",
  "What risks or missing requirements should I pay attention to?",
];

const STRATEGY_META: Record<RetrievalStrategy, { label: string; description: string }> = {
  hybrid:   { label: "Hybrid",   description: "Combines semantic + keyword. Best default." },
  semantic: { label: "Semantic", description: "Broad questions and conceptual matches." },
  keyword:  { label: "Keyword",  description: "Exact terms, IDs, or filenames." },
};

const STAGE_STEPS = ["Rewriting query", "Retrieving context", "Reranking chunks", "Generating answer", "Evaluating answer", "Checking answer"];

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

function requestErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError || error instanceof ApiConnectionError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function isAdminRole(role?: string) { return role === "admin" || role === "super_admin"; }
function hasIndexedDocuments(docs: Document[]) { return docs.some(d => d.status === "indexed"); }

/* ─── StreamStageBar ─────────────────────────────────────────── */
function StreamStageBar({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const first = stage.toLowerCase().split(" ")[0] ?? "";
  const idx = STAGE_STEPS.findIndex(s => s.toLowerCase().includes(first));
  const progress = idx >= 0 ? Math.round(((idx + 1) / STAGE_STEPS.length) * 100) : 40;
  return (
    <div role="status" aria-live="polite" className="border-t border-line bg-surface px-4 py-2.5">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand motion-safe:animate-pulse" />
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{stage}</span>
        <div className="w-24 shrink-0">
          <div className="h-1 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MessageBubble ──────────────────────────────────────────── */
function MessageBubble({
  canViewTrace, isLastAssistant, message, onSelect, streamingDisabled,
}: {
  canViewTrace: boolean; isLastAssistant: boolean; message: ChatMessage; onSelect: (q: string) => void; streamingDisabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";

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
          {!message.isPending && isLastAssistant && message.content ? (
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
export default function ChatPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const submitInFlightRef = useRef(false);

  const { error: authError, isLoading: isAuthLoading, user } = useAuthUser();
  const { error: streamError, isStreaming, sendStreamingMessage, stage, stopStreaming } = useChatStream();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingWorkspaceData, setIsLoadingWorkspaceData] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [retrievalStrategy, setRetrievalStrategy] = useState<RetrievalStrategy>("hybrid");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedWorkspace = workspaces.find(ws => ws.id === selectedWorkspaceId);
  const indexedCount = documents.filter(d => d.status === "indexed").length;
  const canViewTrace = isAdminRole(user?.role);
  const canSend = Boolean(selectedWorkspaceId && hasIndexedDocuments(documents) && question.trim() && !isStreaming && !isSubmitting);
  const lastAssistantIdx = messages.reduceRight((found, msg, i) => (found === -1 && msg.role === "assistant" && !msg.isPending ? i : found), -1);

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

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    async function load() {
      setIsLoadingWorkspaces(true);
      setError(null);
      try {
        const response = await listWorkspaces();
        if (!mounted) return;
        setWorkspaces(response);
        setSelectedWorkspaceId(c => c || response[0]?.id || "");
      } catch (e) {
        if (!mounted) return;
        if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return; }
        setError(requestErrorMessage(e, "Unable to load workspaces."));
      } finally { if (mounted) setIsLoadingWorkspaces(false); }
    }
    void load();
    return () => { mounted = false; };
  }, [router, user]);

  const loadWorkspaceData = useCallback(async (wsId: string) => {
    if (!wsId) { setDocuments([]); setConversations([]); return; }
    setIsLoadingWorkspaceData(true);
    setError(null);
    try {
      const [docs, convs] = await Promise.all([listDocuments(wsId), listWorkspaceConversations(wsId)]);
      setDocuments(docs);
      setConversations(convs);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.status === 401) { removeToken(); router.replace("/login"); return; }
        if (e.status === 403) { setError(COMMON_ERROR_MESSAGES.forbidden); return; }
      }
      setError(requestErrorMessage(e, "Unable to load workspace chat data."));
    } finally { setIsLoadingWorkspaceData(false); }
  }, [router]);

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    void loadWorkspaceData(selectedWorkspaceId);
  }, [loadWorkspaceData, selectedWorkspaceId]);

  async function refreshConversations() {
    if (!selectedWorkspaceId) return;
    try { setConversations(await listWorkspaceConversations(selectedWorkspaceId)); } catch { /* secondary */ }
  }

  async function handleLoadConversation(nextId: string) {
    setIsLoadingConversation(true);
    setError(null);
    setSidebarOpen(false);
    try {
      const conv = await getConversation(nextId);
      setConversationId(conv.id);
      setMessages(conv.messages.map(m => ({
        citations: m.citations ?? [], content: m.content, createdAt: m.created_at, id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
      })));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return; }
      setError(requestErrorMessage(e, "Unable to load conversation."));
    } finally { setIsLoadingConversation(false); }
  }

  function handleNewChat() {
    if (isStreaming) stopStreaming();
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleStop() {
    stopStreaming();
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    setMessages(c => c.map(m => m.isPending ? { ...m, isPending: false, streamStatus: "Stopped" } : m));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = question.trim();
    if (isStreaming || isSubmitting || submitInFlightRef.current) return;
    if (!selectedWorkspaceId) { setError("Select a workspace before asking a question."); return; }
    if (!hasIndexedDocuments(documents)) { setError("No indexed documents are available in this workspace yet."); return; }
    if (!q) return;

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    const userMsg: ChatMessage = { citations: [], content: q, id: `local-user-${Date.now()}`, role: "user" };
    const pending: ChatMessage = { citations: [], citationsOpen: false, content: "", evaluationOpen: false, id: `local-assistant-${Date.now()}`, isPending: true, role: "assistant", streamStatus: "Starting..." };
    let assistantKey = pending.id;
    function updateAssistant(updater: (m: ChatMessage) => ChatMessage) { setMessages(c => c.map(m => m.id === assistantKey ? updater(m) : m)); }

    setMessages(c => [...c, userMsg, pending]);
    setQuestion("");
    setError(null);

    try {
      await sendStreamingMessage({
        workspaceId: selectedWorkspaceId, question: q, conversationId, retrievalStrategy,
        onStart: (data) => { setConversationId(data.conversation_id); updateAssistant(m => ({ ...m, streamStatus: "Rewriting query..." })); },
        onTrace: (_t, label) => { updateAssistant(m => ({ ...m, streamStatus: label })); },
        onToken: (text) => { updateAssistant(m => ({ ...m, content: `${m.content}${text}`, streamStatus: "Generating answer..." })); },
        onCitations: (cits) => { updateAssistant(m => ({ ...m, citations: cits, citationsOpen: cits.length > 0 ? true : m.citationsOpen })); },
        onEvaluation: (ev) => { updateAssistant(m => ({ ...m, evaluation: ev, evaluationOpen: true })); },
        onCorrection: (cor) => { if (!cor.corrected || !cor.final_answer) return; updateAssistant(m => ({ ...m, content: cor.final_answer ?? m.content, isCorrected: true })); },
        onMessage: (data) => {
          const prev = assistantKey; assistantKey = data.message_id; setConversationId(data.conversation_id);
          setMessages(c => c.map(m => m.id === prev ? { ...m, id: data.message_id, isPending: false, streamStatus: undefined } : m));
        },
        onDone: () => { updateAssistant(m => ({ ...m, isPending: false, streamStatus: undefined })); },
        onError: (msg) => { setError(msg); },
        onFallbackResponse: (r) => {
          const prev = assistantKey; assistantKey = r.message_id; setConversationId(r.conversation_id);
          setMessages(c => c.map(m => m.id === prev ? { ...m, citations: r.citations, citationsOpen: r.citations.length > 0, content: r.answer, evaluation: r.evaluation, evaluationOpen: Boolean(r.evaluation), id: r.message_id, isPending: false, streamStatus: undefined } : m));
        },
      });
      await refreshConversations();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) { removeToken(); router.replace("/login"); return; }
      setMessages(c => c.map(m => (m.id === assistantKey || m.id === pending.id) ? { ...m, isPending: false, streamStatus: "Unable to generate an answer." } : m));
      setError(requestErrorMessage(e, "The model is unavailable or the backend returned an error."));
    } finally { submitInFlightRef.current = false; setIsSubmitting(false); }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); formRef.current?.requestSubmit(); }
  }

  if (isAuthLoading) {
    return <DashboardShell activeItem="chat" title=""><LoadingSkeleton label="Checking authentication" rows={4} /></DashboardShell>;
  }
  if (!user) {
    return (
      <DashboardShell activeItem="chat" title="">
        <ErrorState
          action={<button type="button" onClick={() => window.location.reload()} className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg-muted transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Retry</button>}
          message={authError ?? "Your session expired. Please login again."}
          title="Unable to load chat"
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell activeItem="chat" title="">
      <div className="flex min-h-[calc(100dvh-120px)] overflow-hidden rounded-xl border border-line shadow-sm">

        {/* mobile sidebar */}
        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 animate-dp-fade-in bg-backdrop" />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface animate-dp-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-fg">Conversations</p>
                <button onClick={() => setSidebarOpen(false)} aria-label="Close" className="rounded-md text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><Icon name="close" size={18} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <SidebarContent {...{ conversations, conversationId, indexedCount, documents, isLoadingWorkspaceData, isStreaming, isSubmitting, retrievalStrategy, selectedWorkspace, onLoadConversation: handleLoadConversation, onNewChat: handleNewChat, onStrategyChange: setRetrievalStrategy }} />
              </div>
            </div>
          </div>
        ) : null}

        {/* desktop sidebar */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface xl:flex">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-fg">Conversations</p>
            <button type="button" onClick={handleNewChat} title="New chat"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-2 py-1 text-xs font-medium text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="plus" size={13} /> New
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <SidebarContent {...{ conversations, conversationId, indexedCount, documents, isLoadingWorkspaceData, isStreaming, isSubmitting, retrievalStrategy, selectedWorkspace, onLoadConversation: handleLoadConversation, onNewChat: handleNewChat, onStrategyChange: setRetrievalStrategy }} />
          </div>
        </aside>

        {/* main */}
        <div className="flex min-w-0 flex-1 flex-col bg-canvas">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open conversations"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition hover:bg-hover hover:text-fg xl:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Icon name="menu" size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{selectedWorkspace?.name ?? "No workspace selected"}</p>
              <p className="truncate text-[10px] text-fg-subtle">{selectedWorkspace ? `${indexedCount} indexed doc${indexedCount !== 1 ? "s" : ""} · ${retrievalStrategy} retrieval` : "Select a workspace to start chatting"}</p>
            </div>
            <Select
              value={selectedWorkspaceId}
              onChange={(e) => { if (isStreaming) stopStreaming(); setSelectedWorkspaceId(e.target.value); setError(null); }}
              disabled={isLoadingWorkspaces || workspaces.length === 0 || isStreaming || isSubmitting}
              className="h-8 max-w-[160px] text-xs"
            >
              {workspaces.length === 0 ? <option value="">No workspaces</option> : null}
              {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
            </Select>
          </div>

          {(error || streamError) ? (
            <div className="border-b border-danger-line bg-danger-subtle px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-danger-surface-fg">{error ?? streamError}</p>
                <button onClick={() => setError(null)} className="text-xs text-danger-fg hover:underline focus-visible:outline-none">Dismiss</button>
              </div>
            </div>
          ) : null}

          <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {isLoadingConversation ? (
              <LoadingSkeleton label="Loading conversation" rows={5} />
            ) : messages.length === 0 ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-brand-subtle-line bg-brand-subtle">
                  <Icon name="sparkles" size={24} className="text-brand-fg" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-fg">{selectedWorkspace ? `Ask about ${selectedWorkspace.name}` : "Select a workspace"}</h2>
                  <p className="mt-2 text-sm text-fg-muted">
                    {selectedWorkspace && indexedCount === 0 ? "This workspace has no indexed documents yet. Upload files to start chatting."
                      : selectedWorkspace ? `${indexedCount} document${indexedCount !== 1 ? "s" : ""} indexed · answers cite their sources`
                      : "Choose a workspace from the top bar to start chatting."}
                  </p>
                </div>
                {selectedWorkspace && indexedCount > 0 ? (
                  <div className="grid w-full gap-2">
                    {EXAMPLE_QUESTIONS.map(ex => (
                      <button key={ex} type="button" disabled={isStreaming || isSubmitting}
                        onClick={() => { setQuestion(ex); setTimeout(() => textareaRef.current?.focus(), 0); }}
                        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-fg-muted transition hover:border-line-strong hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                        <Icon name="message" size={15} className="shrink-0 text-fg-subtle" />
                        {ex}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mx-auto grid max-w-3xl gap-6">
                {messages.map((msg, i) => (
                  <MessageBubble key={msg.id} canViewTrace={canViewTrace} isLastAssistant={i === lastAssistantIdx} message={msg}
                    onSelect={(q) => { setQuestion(q); setTimeout(() => textareaRef.current?.focus(), 0); }}
                    streamingDisabled={isStreaming || isSubmitting} />
                ))}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>

          {isStreaming ? <StreamStageBar stage={stage} /> : null}

          <form ref={formRef} onSubmit={handleSubmit} className="border-t border-line bg-surface px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <div className={`flex gap-2 rounded-xl border bg-surface transition-colors ${question ? "border-line-strong" : "border-line"}`}>
                <textarea
                  ref={textareaRef} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={handleKeyDown}
                  disabled={isStreaming || isSubmitting} rows={1}
                  placeholder={selectedWorkspaceId && indexedCount > 0 ? "Ask a question… (Enter to send)" : selectedWorkspaceId ? "No indexed documents in this workspace" : "Select a workspace to begin"}
                  className="min-h-[52px] flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Ask a question"
                />
                <div className="flex shrink-0 flex-col items-end justify-end gap-2 p-2">
                  {isStreaming ? (
                    <button type="button" onClick={handleStop} title="Stop generating" aria-label="Stop"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-fg-muted transition hover:bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                      <Icon name="close" size={16} />
                    </button>
                  ) : (
                    <button type="submit" disabled={!canSend} aria-label="Send"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40">
                      <Icon name="arrowRight" size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <p className="text-[10px] text-fg-subtle">
                  {isStreaming ? "Generating… press ✕ to stop"
                    : indexedCount === 0 && selectedWorkspaceId ? "⚠ Upload and index documents first"
                    : "Enter to send · Shift+Enter for new line"}
                </p>
                <p className="text-[10px] capitalize text-fg-subtle">{retrievalStrategy} retrieval</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}

/* ─── SidebarContent ─────────────────────────────────────────── */
function SidebarContent({
  conversations, conversationId, indexedCount, documents, isLoadingWorkspaceData,
  isStreaming, isSubmitting, retrievalStrategy, selectedWorkspace, onLoadConversation, onNewChat, onStrategyChange,
}: {
  conversations: ConversationSummary[]; conversationId: string | null; indexedCount: number; documents: Document[];
  isLoadingWorkspaceData: boolean; isStreaming: boolean; isSubmitting: boolean; retrievalStrategy: RetrievalStrategy;
  selectedWorkspace: Workspace | undefined; onLoadConversation: (id: string) => void; onNewChat: () => void; onStrategyChange: (s: RetrievalStrategy) => void;
}) {
  return (
    <div className="grid gap-5">
      {selectedWorkspace ? (
        <div className="rounded-lg border border-line bg-canvas px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Workspace</p>
          <p className="mt-1 truncate text-sm font-semibold text-fg">{selectedWorkspace.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-fg-muted"><span className="font-medium text-success-fg">{indexedCount}</span> indexed</span>
            <span className="text-fg-subtle">·</span>
            <span className="text-xs text-fg-muted"><span className="font-medium text-fg">{documents.length}</span> total</span>
          </div>
          {indexedCount === 0 ? (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-warning-fg"><Icon name="alertCircle" size={11} /> No indexed documents</div>
          ) : (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-success-fg"><Icon name="checkCircle" size={11} /> Ready for chat</div>
          )}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Threads</p>
          <button type="button" onClick={onNewChat} className="text-[10px] font-medium text-brand-fg hover:underline focus-visible:outline-none">+ New</button>
        </div>
        {isLoadingWorkspaceData ? <LoadingSkeleton rows={3} />
          : conversations.length === 0 ? <p className="text-xs text-fg-subtle">No conversations yet.</p>
          : (
            <div className="grid gap-1">
              {conversations.slice(0, 12).map(conv => {
                const isActive = conv.id === conversationId;
                return (
                  <button key={conv.id} type="button" disabled={isStreaming || isSubmitting} onClick={() => onLoadConversation(conv.id)}
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isActive ? "border border-brand-subtle-line bg-brand-subtle text-brand-fg" : "text-fg-muted hover:bg-hover hover:text-fg"}`}>
                    <span className="block truncate font-medium">{conv.title ?? "Untitled"}</span>
                    <span className="mt-0.5 block text-[10px] opacity-70">{relTime(conv.updated_at)}</span>
                  </button>
                );
              })}
            </div>
          )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">Retrieval strategy</p>
        <div className="grid gap-1">
          {(["hybrid", "semantic", "keyword"] as RetrievalStrategy[]).map(s => {
            const isActive = s === retrievalStrategy;
            return (
              <button key={s} type="button" disabled={isStreaming || isSubmitting} onClick={() => onStrategyChange(s)}
                className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${isActive ? "border border-brand-subtle-line bg-brand-subtle text-brand-fg" : "text-fg-muted hover:bg-hover hover:text-fg"}`}>
                <span className="block font-medium capitalize">{STRATEGY_META[s].label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">{STRATEGY_META[s].description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
