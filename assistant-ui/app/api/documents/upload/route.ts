import { NextResponse } from "next/server";
import {
  createBackendHeaders,
  createBackendUrl,
  toBackendUnavailableResponse,
  toProxyErrorResponse,
} from "../backend";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少上传文件。" }, { status: 400 });
    }

    const title = formData.get("title");
    const tags = formData.get("tags");

    const payload = new FormData();
    payload.append("file", file, file.name);

    if (typeof title === "string" && title.trim()) {
      payload.append("title", title.trim());
    }
    if (typeof tags === "string" && tags.trim()) {
      payload.append("tags", tags.trim());
    }

    const response = await fetch(createBackendUrl("/upload"), {
      method: "POST",
      headers: createBackendHeaders({ json: false }),
      body: payload,
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
