"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, ApiConnectionError, ApiRequestError } from "@/lib/api-client";
import { getToken } from "@/lib/auth";
import { queryWorkspaceChat } from "@/lib/chat";
import { COMMON_ERROR_MESSAGES } from "@/lib/errors";
import type { AnswerEvaluation, ChatQueryResponse, Citation } from "@/types";

type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

type TraceEvent = {
  stage?: string;
  status?: string;
  retrieved_count?: number;
  reranked_count?: number;
};

type StartEvent = {
  workspace_id: string;
  conversation_id: string;
  retrieval_strategy: RetrievalStrategy;
};

type MessageEvent = {
  message_id: string;
  conversation_id: string;
};

type CorrectionEvent = {
  corrected: boolean;
  final_answer?: string;
  reason?: string;
};

type ChatStreamCallbacks = {
  onStart?: (data: StartEvent) => void;
  onTrace?: (data: TraceEvent, label: string) => void;
  onToken?: (text: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onEvaluation?: (evaluation: AnswerEvaluation) => void;
  onCorrection?: (data: CorrectionEvent) => void;
  onMessage?: (data: MessageEvent) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  onFallbackResponse?: (response: ChatQueryResponse) => void;
};

type SendStreamingMessageInput = ChatStreamCallbacks & {
  workspaceId: string;
  question: string;
  conversationId?: string | null;
  retrievalStrategy?: RetrievalStrategy;
};

type ParsedSseEvent = {
  event: string;
  data: unknown;
};

function findSseSeparator(buffer: string) {
  const lfIndex = buffer.indexOf("\n\n");
  const crlfIndex = buffer.indexOf("\r\n\r\n");

  if (lfIndex === -1 && crlfIndex === -1) {
    return null;
  }

  if (lfIndex === -1) {
    return { index: crlfIndex, length: 4 };
  }

  if (crlfIndex === -1 || lfIndex < crlfIndex) {
    return { index: lfIndex, length: 2 };
  }

  return { index: crlfIndex, length: 4 };
}

function buildStreamUrl(workspaceId: string) {
  return `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/chat/stream`;
}

function parseSseBlock(block: string): ParsedSseEvent | null {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")),
    };
  } catch {
    return null;
  }
}

function stageLabel(trace: TraceEvent) {
  const status = trace.status ?? "started";
  if (status === "completed" || status === "skipped") {
    if (trace.stage === "retrieval") {
      return `Retrieved ${trace.retrieved_count ?? 0} chunks`;
    }
    if (trace.stage === "reranker") {
      return status === "skipped"
        ? "Reranking skipped"
        : `Reranked ${trace.reranked_count ?? 0} chunks`;
    }
  }

  switch (trace.stage) {
    case "query_rewriter":
      return "Rewriting query...";
    case "retrieval":
      return "Retrieving context...";
    case "reranker":
      return "Reranking chunks...";
    case "generator":
      return "Generating answer...";
    case "evaluator":
      return "Evaluating answer...";
    case "corrector":
      return "Checking answer...";
    default:
      return "Working...";
  }
}

async function parseErrorResponse(response: Response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload === "object") {
      const detail = (payload as Record<string, unknown>).detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
  } catch {
    // Ignore parse failures and use a clean status-based message below.
  }

  return `Streaming request failed with status ${response.status}`;
}

export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStage(null);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const sendStreamingMessage = useCallback(
    async ({
      workspaceId,
      question,
      conversationId,
      retrievalStrategy = "hybrid",
      onStart,
      onTrace,
      onToken,
      onCitations,
      onEvaluation,
      onCorrection,
      onMessage,
      onDone,
      onError,
      onFallbackResponse,
    }: SendStreamingMessageInput) => {
      if (abortRef.current) {
        throw new Error("A response is already streaming.");
      }

      const token = getToken();
      if (!token) {
        throw new ApiRequestError("Authentication required.", 401, null);
      }

      const normalizedQuestion = question.trim();
      if (!workspaceId) {
        throw new Error("Select a workspace before asking a question.");
      }
      if (!normalizedQuestion) {
        throw new Error("Enter a question before sending.");
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStage("Starting...");
      setError(null);
      let receivedStreamEvent = false;
      let sawDoneEvent = false;

      try {
        const handleParsedEvent = (parsed: ParsedSseEvent) => {
          receivedStreamEvent = true;

          if (parsed.event === "start") {
            onStart?.(parsed.data as StartEvent);
          } else if (parsed.event === "trace") {
            const trace = parsed.data as TraceEvent;
            const label = stageLabel(trace);
            setStage(label);
            onTrace?.(trace, label);
          } else if (parsed.event === "token") {
            setStage("Generating answer...");
            const text = (parsed.data as { text?: string }).text;
            if (text) {
              onToken?.(text);
            }
          } else if (parsed.event === "citations") {
            const citations = (parsed.data as { citations?: Citation[] }).citations ?? [];
            onCitations?.(citations);
          } else if (parsed.event === "evaluation") {
            const evaluation = (parsed.data as { evaluation?: AnswerEvaluation }).evaluation;
            if (evaluation) {
              onEvaluation?.(evaluation);
            }
          } else if (parsed.event === "correction") {
            onCorrection?.(parsed.data as CorrectionEvent);
          } else if (parsed.event === "message") {
            onMessage?.(parsed.data as MessageEvent);
          } else if (parsed.event === "done") {
            sawDoneEvent = true;
            onDone?.();
          } else if (parsed.event === "error") {
            const message =
              (parsed.data as { message?: string }).message ??
              "Unable to generate an answer right now.";
            setError(message);
            onError?.(message);
            throw new Error(message);
          }
        };

        const response = await fetch(buildStreamUrl(workspaceId), {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: normalizedQuestion,
            conversation_id: conversationId ?? null,
            retrieval_strategy: retrievalStrategy,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await parseErrorResponse(response);
          if (response.status === 401 || response.status === 403) {
            throw new ApiRequestError(message, response.status, null);
          }
          throw new Error(message);
        }

        if (!response.body) {
          throw new Error("Streaming response was empty.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          let separator = findSseSeparator(buffer);

          while (separator) {
            const block = buffer.slice(0, separator.index);
            buffer = buffer.slice(separator.index + separator.length);
            const parsed = parseSseBlock(block);
            if (parsed) {
              handleParsedEvent(parsed);
            }
            separator = findSseSeparator(buffer);
          }
        }

        const trailingText = `${buffer}${decoder.decode()}`.trim();
        if (trailingText) {
          const parsed = parseSseBlock(trailingText);
          if (parsed) {
            handleParsedEvent(parsed);
          }
        }

        if (receivedStreamEvent && !sawDoneEvent) {
          onDone?.();
        }
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        if (requestError instanceof ApiRequestError) {
          throw requestError;
        }

        if (!receivedStreamEvent && onFallbackResponse) {
          try {
            const fallbackResponse = await queryWorkspaceChat(workspaceId, {
              question: normalizedQuestion,
              conversation_id: conversationId ?? null,
              retrieval_strategy: retrievalStrategy,
            });
            onFallbackResponse(fallbackResponse);
            return;
          } catch (fallbackError) {
            setError(
              fallbackError instanceof Error
                ? fallbackError.message
                : "Unable to generate an answer right now.",
            );
            throw fallbackError;
          }
        }

        if (requestError instanceof Error) {
          setError(requestError.message);
          throw requestError;
        }
        setError(COMMON_ERROR_MESSAGES.backendUnreachable);
        throw new ApiConnectionError(COMMON_ERROR_MESSAGES.backendUnreachable, requestError);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
        setStage(null);
      }
    },
    [],
  );

  return {
    error,
    isStreaming,
    sendStreamingMessage,
    stage,
    stopStreaming,
  };
}
