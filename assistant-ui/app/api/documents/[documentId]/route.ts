import { NextResponse, type NextRequest } from "next/server";
import {
  createBackendHeaders,
  createBackendUrl,
  toBackendUnavailableResponse,
  toProxyErrorResponse,
} from "../backend";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

async function getDocumentId(context: RouteContext): Promise<string> {
  const { documentId } = await context.params;
  return documentId;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const documentId = await getDocumentId(context);

  try {
    const response = await fetch(createBackendUrl(`/documents/${encodeURIComponent(documentId)}`), {
      method: "GET",
      headers: createBackendHeaders(),
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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const documentId = await getDocumentId(context);

  try {
    const response = await fetch(createBackendUrl(`/documents/${encodeURIComponent(documentId)}`), {
      method: "DELETE",
      headers: createBackendHeaders(),
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
