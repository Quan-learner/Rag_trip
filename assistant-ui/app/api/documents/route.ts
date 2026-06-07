import { NextResponse } from "next/server";
import {
  createBackendHeaders,
  createBackendUrl,
  toBackendUnavailableResponse,
  toProxyErrorResponse,
} from "./backend";

export async function GET() {
  try {
    const response = await fetch(createBackendUrl("/documents"), {
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
