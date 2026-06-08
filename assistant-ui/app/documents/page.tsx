"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { LoaderCircleIcon, MessageSquareTextIcon, Trash2Icon, UploadCloudIcon } from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ModuleSwitcher } from "@/components/module-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DocumentSummary = {
  id: string;
  title: string;
  source_filename: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  chunk_count: number;
};

type DocumentSource = {
  id: string;
  document_id: string;
  title: string;
  snippet: string;
  score?: number | null;
};

type DocumentChatResponse = {
  answer: string;
  sources: DocumentSource[];
};

type DocumentChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: DocumentSource[];
};

const docChatMarkdownComponents: Components = {
  p: ({ children }) => <p className="my-2 whitespace-pre-wrap break-words leading-6">{children}</p>,
  h2: ({ children }) => (
    <h2 className="mt-3 mb-2 text-base font-semibold text-zinc-900">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-2 text-sm font-semibold text-zinc-800">{children}</h3>
  ),
  ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="min-w-full border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-100/90">{children}</thead>,
  th: ({ children }) => (
    <th className="border-zinc-200 border-b px-3 py-2 text-left text-xs font-semibold text-zinc-700">
      {children}
    </th>
  ),
  tr: ({ children }) => <tr className="odd:bg-white even:bg-zinc-50/70">{children}</tr>,
  td: ({ children }) => (
    <td className="border-zinc-100 border-b px-3 py-2 align-top text-zinc-700">{children}</td>
  ),
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function parseApiError(response: Response): Promise<string> {
  const raw = (await response.text()).trim();
  if (!raw) return `请求失败（${response.status}）`;

  try {
    const parsed = JSON.parse(raw) as { detail?: string; error?: string };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
  } catch {
    // fall through to raw text
  }

  return raw;
}

const PRE_SEEDED_TITLES = new Set([
  "上海", "中国5A景区-四川省", "四川省", "四川省5A景区攻略", "内蒙古", "北京", "北京5A景区攻略", 
  "吉林", "宁夏", "安徽", "山东", "山西", "广东", "广西", "新疆", "江苏", "江西", "河北", 
  "河南", "浙江", "海南", "湖北", "湖南", "甘肃", "福建", "西藏", "贵州", "辽宁", 
  "重庆", "陕西", "陕西5A景区攻略", "青海", "黑龙江", "吉林省", "安徽省", "山东省", "山西省", 
  "广东省", "江苏省", "江西省", "河北省", "河南省", "浙江省", "海南省", "湖北省", "湖南省", 
  "甘肃省", "福建省", "贵州省", "辽宁省", "陕西省", "青海省", "黑龙江省", "四川省", "西藏自治区", 
  "新疆维吾尔自治区", "宁夏回族自治区", "广西壮族自治区", "内蒙古自治区", "北京市", "上海市", "重庆市",
  "北京市5A景区旅游攻略", "陕西省5A景区旅游攻略", "云南省5A景区旅游攻略", "云南省"
]);

function isPreSeededTravelDoc(doc: DocumentSummary): boolean {
  // 1. 根据创建时间判定：2026-06-06 导入的所有内置旅游攻略文档均在 2026-06-07 之前
  const createdAt = new Date(doc.created_at);
  if (!Number.isNaN(createdAt.getTime()) && createdAt.getTime() < new Date("2026-06-07T00:00:00Z").getTime()) {
    return true;
  }
  // 2. 根据标题特征及预定义列表判定，防止重新导入时时间变更
  const title = doc.title.trim();
  if (PRE_SEEDED_TITLES.has(title)) {
    return true;
  }
  if (title.includes("5A景区") || title.endsWith("旅游攻略") || title.endsWith("游记（精选）")) {
    return true;
  }
  return false;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<DocumentChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const visibleDocuments = documents.filter((doc) => !isPreSeededTravelDoc(doc));

  const fetchDocuments = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/documents", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const data = (await response.json()) as DocumentSummary[];
      setDocuments(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "无法获取文档列表，请稍后再试。",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const onUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (!selectedFile) {
      setError("请先选择需要上传的文档。");
      return;
    }

    setError(null);
    setSubmitMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title.trim()) formData.append("title", title.trim());
      if (tags.trim()) formData.append("tags", tags.trim());

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setSubmitMessage(`上传成功：${selectedFile.name}`);
      setSelectedFile(null);
      setTitle("");
      setTags("");
      form.reset();
      await fetchDocuments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "上传失败，请稍后重试。");
    } finally {
      setIsUploading(false);
    }
  };

  const onDelete = async (documentId: string) => {
    const confirmed = window.confirm("确认删除该文档吗？删除后将无法恢复。");
    if (!confirmed) return;

    setError(null);
    setDeletingId(documentId);

    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setDocuments((current) => current.filter((item) => item.id !== documentId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  };

  const onSendDocChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isChatLoading) return;

    const query = chatInput.trim();
    if (!query) {
      setChatError("请输入问题后再发送。");
      return;
    }

    const history = chatMessages.map((item) => ({
      role: item.role,
      content: item.content,
    }));

    setChatError(null);
    setChatInput("");
    setIsChatLoading(true);
    setChatMessages((current) => [...current, { role: "user", content: query }]);

    try {
      const response = await fetch("/api/documents/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const payload = (await response.json()) as Partial<DocumentChatResponse>;
      const answer =
        typeof payload.answer === "string" && payload.answer.trim()
          ? payload.answer.trim()
          : "未返回有效回答，请重试。";
      const sources = Array.isArray(payload.sources) ? payload.sources : [];

      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer,
          sources,
        },
      ]);
    } catch (requestError) {
      setChatError(requestError instanceof Error ? requestError.message : "问答失败，请稍后重试。");
    } finally {
      setIsChatLoading(false);
    }
  };

  const onClearDocChat = () => {
    setChatMessages([]);
    setChatError(null);
    setChatInput("");
  };

  return (
    <main className="min-h-dvh bg-[linear-gradient(160deg,oklch(0.99_0_0)_0%,oklch(0.975_0_0)_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="flex justify-end">
          <ModuleSwitcher />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_16px_48px_-32px_rgba(0,0,0,0.4)] sm:p-8">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">知识库文档上传</h1>
              <p className="mt-1 text-sm text-zinc-500">
                上传后的文档会自动解析、切块并写入向量数据库。
              </p>
            </div>

            <form
              className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 p-4 sm:grid-cols-2"
              onSubmit={onUpload}
            >
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-800">选择文档</span>
                <Input
                  required
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx,.csv"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  className="h-11 cursor-pointer rounded-xl file:mr-3 file:inline-flex file:h-8 file:items-center file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-0 file:text-sm file:font-medium file:leading-8 file:text-zinc-700 file:cursor-pointer hover:file:bg-zinc-200"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-800">文档标题（可选）</span>
                <Input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="请输入关键字"
                  className="h-11 rounded-xl"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-800">标签（可选）</span>
                <Input
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="请输入关键字"
                  className="h-11 rounded-xl"
                />
              </label>

              <div className="flex items-center justify-end gap-3 sm:col-span-2">
                {submitMessage ? <p className="text-sm text-emerald-600">{submitMessage}</p> : null}
                <Button
                  type="submit"
                  className="min-w-32 cursor-pointer rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      上传中
                    </>
                  ) : (
                    <>
                      <UploadCloudIcon className="size-4" />
                      上传并入库
                    </>
                  )}
                </Button>
              </div>
            </form>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <section className="mt-6 space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-700 uppercase">
                已入库文档
              </h2>

              {isLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  正在加载文档列表...
                </div>
              ) : visibleDocuments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
                  当前还没有自己上传的文档，上传后会在这里显示。
                </div>
              ) : (
                <div className="grid gap-3">
                  {visibleDocuments.map((doc) => (
                    <article
                      key={doc.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-zinc-900">{doc.title}</p>
                        <p className="truncate text-xs text-zinc-500">
                          文件名：{doc.source_filename ?? "未知来源"} | 分块：{doc.chunk_count}
                        </p>
                        <p className="text-xs text-zinc-500">
                          更新时间：{formatDateTime(doc.updated_at)}
                        </p>
                        {doc.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {doc.tags.map((tag) => (
                              <span
                                key={`${doc.id}-${tag}`}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="cursor-pointer rounded-lg"
                        onClick={() => void onDelete(doc.id)}
                        disabled={deletingId === doc.id}
                      >
                        {deletingId === doc.id ? (
                          <>
                            <LoaderCircleIcon className="size-4 animate-spin" />
                            删除中
                          </>
                        ) : (
                          <>
                            <Trash2Icon className="size-4" />
                            删除
                          </>
                        )}
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_16px_48px_-32px_rgba(0,0,0,0.4)] sm:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-zinc-100 p-2 text-zinc-700">
                <MessageSquareTextIcon className="size-4" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900">知识库文档问答</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  右侧独立对话，仅基于你上传到知识库的文档内容进行检索回答。
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="h-[56dvh] min-h-[420px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    先上传文档，再在这里提问......
                  </p>
                ) : (
                  <div className="space-y-3">
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={
                          message.role === "user"
                            ? "ml-auto max-w-[88%] rounded-2xl border border-zinc-800/20 bg-gradient-to-br from-zinc-900 to-zinc-700 px-4 py-3 text-sm text-white shadow-[0_12px_30px_-22px_rgba(24,24,27,0.95)]"
                            : "mr-auto max-w-[92%] rounded-xl bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
                        }
                      >
                        {message.role === "user" ? (
                          <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-200/85 uppercase">
                            你的提问
                          </p>
                        ) : null}

                        {message.role === "assistant" ? (
                          <div className="text-sm text-zinc-900">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={docChatMarkdownComponents}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        )}

                        {message.role === "assistant" &&
                        message.sources &&
                        message.sources.length > 0 ? (
                          <div className="mt-2 border-zinc-200 border-t pt-2">
                            <p className="mb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                              参考来源
                            </p>
                            <div className="space-y-1">
                              {message.sources.slice(0, 3).map((source) => (
                                <div
                                  key={`${index}-${source.id}`}
                                  className="rounded-md bg-zinc-100 px-2 py-1"
                                >
                                  <p className="truncate text-xs font-medium text-zinc-700">
                                    {source.title}
                                  </p>
                                  <p className="line-clamp-2 text-xs text-zinc-500">
                                    {source.snippet}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {isChatLoading ? (
                      <div className="mr-auto max-w-[92%] rounded-xl bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm">
                        正在检索文档并生成回答...
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {chatError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {chatError}
                </p>
              ) : null}

              <form
                className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_12px_32px_-28px_rgba(24,24,27,0.8)]"
                onSubmit={onSendDocChat}
              >
                <label htmlFor="doc-chat-input" className="sr-only">
                  文档问答输入框
                </label>
                <textarea
                  id="doc-chat-input"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="请输入你的文档问题，可输入多行信息（例如：预算、天数、偏好）..."
                  className="min-h-[104px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm leading-6 text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isChatLoading}
                />
                <div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <p className="text-xs text-zinc-500">支持多行提问，信息越完整，回答越准确。</p>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="cursor-pointer rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                      disabled={isChatLoading}
                    >
                      发送
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer rounded-xl"
                      onClick={onClearDocChat}
                      disabled={isChatLoading || chatMessages.length === 0}
                    >
                      清空
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
