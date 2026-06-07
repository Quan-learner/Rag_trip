import { NextResponse } from "next/server";
import {
  createBackendHeaders,
  createBackendUrl,
  toBackendUnavailableResponse,
  toProxyErrorResponse,
} from "../backend";

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatPayload = {
  query?: string;
  history?: ChatHistoryMessage[];
};

function sanitizeHistory(history: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];

      const rawRole = (item as { role?: unknown }).role;
      const rawContent = (item as { content?: unknown }).content;
      const content = typeof rawContent === "string" ? rawContent.trim() : "";
      if (!content) return [];

      const role: ChatHistoryMessage["role"] = rawRole === "assistant" ? "assistant" : "user";
      return [{ role, content }];
    })
    .filter((item) => item.content.length > 0)
    .slice(-12);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ChatPayload;
    const query = String(payload?.query ?? "").trim();

    if (!query) {
      return NextResponse.json({ error: "请输入问题后再发送。" }, { status: 400 });
    }

    const history = sanitizeHistory(payload?.history);

    const response = await fetch(createBackendUrl("/chat"), {
      method: "POST",
      headers: createBackendHeaders(),
      body: JSON.stringify({
        query,
        history,
        top_k: 10,
        rerank_top_k: 3,
        return_sources: true,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return toProxyErrorResponse(response);
    }

    return NextResponse.json(await response.json(), { status: 200 });
  } catch {
    return toBackendUnavailableResponse();
  }
}
