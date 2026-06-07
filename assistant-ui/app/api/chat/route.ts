import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type UIMessage,
} from "ai";

type BackendHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type BackendSource = {
  id: string;
  document_id: string;
  title: string;
  snippet?: string;
  score?: number;
};

type BackendStreamEvent =
  | { type: "token"; delta: string }
  | { type: "source"; source: BackendSource }
  | { type: "done"; answer?: string; sources?: BackendSource[] }
  | { type: "error"; message: string };

const RAG_BACKEND_BASE_URL =
  process.env.RAG_BACKEND_BASE_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:8000";

const RAG_BACKEND_API_KEY = process.env.RAG_BACKEND_API_KEY;

function extractMessageText(message: UIMessage | undefined): string {
  if (!message) return "";

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function isHistoryRoleMessage(
  message: UIMessage,
): message is UIMessage & { role: "user" | "assistant" } {
  return message.role === "user" || message.role === "assistant";
}

function toBackendHistory(messages: UIMessage[]): BackendHistoryMessage[] {
  return messages
    .filter(isHistoryRoleMessage)
    .map((message) => ({
      role: message.role,
      content: extractMessageText(message),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-12);
}

function parseLineToEvent(line: string): BackendStreamEvent | null {
  const raw = line.trim();
  if (!raw || raw === "[DONE]") return null;

  const jsonLine = raw.startsWith("data:") ? raw.slice(5).trim() : raw;
  if (!jsonLine) return null;

  try {
    return JSON.parse(jsonLine) as BackendStreamEvent;
  } catch {
    return null;
  }
}

function toUserFacingBackendError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as { detail?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
  } catch {
    // fall through to raw text
  }

  return trimmed;
}

function normalizeStreamErrorMessage(raw: string): string {
  const parsed = toUserFacingBackendError(raw);
  const normalized = parsed.toLowerCase();

  if (!normalized) {
    return `无法连接到 RAG 后端服务（${RAG_BACKEND_BASE_URL}），请检查后端是否已启动。`;
  }

  if (
    normalized.includes("terminated") ||
    normalized.includes("aborterror") ||
    normalized.includes("aborted") ||
    normalized.includes("econnreset") ||
    normalized.includes("socket") ||
    normalized.includes("premature close") ||
    normalized.includes("unexpected end") ||
    normalized.includes("stream closed")
  ) {
    return "本次回复在传输中被中断，请重试一次。若连续出现，请确认前后端服务和网络稳定。";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("cannot connect") ||
    normalized.includes("all connection attempts failed") ||
    normalized.includes("connection refused") ||
    normalized.includes("service unavailable") ||
    normalized.includes("503")
  ) {
    return `无法连接到 RAG 后端服务（${RAG_BACKEND_BASE_URL}），请确认后端已启动。`;
  }

  return parsed;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const query = extractMessageText(latestUserMessage);
  const history = toBackendHistory(messages.slice(0, -1));

  const stream = createUIMessageStream({
    originalMessages: messages,
    generateId,
    execute: async ({ writer }) => {
      const textPartId = generateId();

      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: textPartId });

      if (!query) {
        writer.write({
          type: "text-delta",
          id: textPartId,
          delta: "请先输入你的旅行需求，例如目的地、天数、预算和出行偏好。",
        });
        writer.write({ type: "text-end", id: textPartId });
        writer.write({ type: "finish", finishReason: "stop" });
        return;
      }

      try {
        let receivedAnyToken = false;
        let receivedDoneEvent = false;
        const response = await fetch(`${RAG_BACKEND_BASE_URL}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(RAG_BACKEND_API_KEY ? { "X-API-Key": RAG_BACKEND_API_KEY } : {}),
          },
          body: JSON.stringify({
            query,
            history,
            top_k: 10,
            rerank_top_k: 3,
            return_sources: false,
          }),
          signal: req.signal,
        });

        if (!response.ok || !response.body) {
          const errorMessage = await response.text();
          throw new Error(errorMessage || "无法从 RAG 后端获取响应。");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            const event = parseLineToEvent(line);
            if (!event) {
              newlineIndex = buffer.indexOf("\n");
              continue;
            }

            if (event.type === "token" && event.delta) {
              receivedAnyToken = true;
              writer.write({ type: "text-delta", id: textPartId, delta: event.delta });
            }

            if (event.type === "done") {
              receivedDoneEvent = true;
            }

            if (event.type === "error") {
              throw new Error(event.message || "后端流式响应发生错误。");
            }

            newlineIndex = buffer.indexOf("\n");
          }
        }

        const trailingEvent = parseLineToEvent(buffer);
        if (trailingEvent?.type === "token") {
          receivedAnyToken = true;
          writer.write({ type: "text-delta", id: textPartId, delta: trailingEvent.delta });
        } else if (trailingEvent?.type === "done") {
          receivedDoneEvent = true;
        } else if (trailingEvent?.type === "error") {
          throw new Error(trailingEvent.message || "后端流式响应发生错误。");
        }

        if (!receivedDoneEvent && !receivedAnyToken) {
          throw new Error("terminated");
        }
      } catch (error) {
        if (req.signal.aborted) {
          return;
        }
        const fallback = `无法连接到 RAG 后端服务（${RAG_BACKEND_BASE_URL}），请检查后端是否已启动。`;
        const message =
          error instanceof Error && error.message
            ? normalizeStreamErrorMessage(error.message)
            : fallback;

        writer.write({
          type: "text-delta",
          id: textPartId,
          delta: message || fallback,
        });
      }

      writer.write({ type: "text-end", id: textPartId });
      writer.write({
        type: "finish",
        finishReason: "stop",
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
