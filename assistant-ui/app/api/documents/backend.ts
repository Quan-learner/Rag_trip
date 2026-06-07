import { NextResponse } from "next/server";

const RAG_BACKEND_BASE_URL =
  process.env.RAG_BACKEND_BASE_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:8000";
const RAG_BACKEND_API_KEY = process.env.RAG_BACKEND_API_KEY;

export function createBackendUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${RAG_BACKEND_BASE_URL}${normalizedPath}`;
}

export function createBackendHeaders({ json = true }: { json?: boolean } = {}): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (RAG_BACKEND_API_KEY) headers["X-API-Key"] = RAG_BACKEND_API_KEY;
  return headers;
}

async function extractBackendError(response: Response): Promise<string> {
  const raw = (await response.text()).trim();
  if (!raw) return `请求失败（${response.status}）`;

  try {
    const parsed = JSON.parse(raw) as { detail?: string; error?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // fall through to raw text
  }

  return raw;
}

export async function toProxyErrorResponse(response: Response): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: await extractBackendError(response),
    },
    { status: response.status },
  );
}

export function toBackendUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "无法连接到 RAG 后端服务，请检查后端是否已启动。",
    },
    { status: 502 },
  );
}
