"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageSquareTextIcon, PlusIcon } from "lucide-react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type ThreadRow = {
  id: string;
  title: string;
  isActive: boolean;
  isNew: boolean;
};

type TopicState = {
  threadId: string;
  signature: string;
  title: string;
};

function extractUserText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const role = Reflect.get(message, "role");
  if (role !== "user") return "";

  const content = Reflect.get(message, "content");
  if (!Array.isArray(content)) return "";

  return content
    .filter((part) => {
      if (!part || typeof part !== "object") return false;
      return Reflect.get(part, "type") === "text";
    })
    .map((part) => {
      const text = Reflect.get(part, "text");
      return typeof text === "string" ? text : "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTopicTitle(messages: readonly unknown[]): { title: string; signature: string } {
  const userTexts = messages
    .map(extractUserText)
    .map((text) => text.trim())
    .filter(Boolean);

  if (userTexts.length === 0) {
    return { title: "", signature: "" };
  }

  const sample = userTexts.slice(-3);
  const signature = sample.join("|");
  const topic = sample.join(" / ").replace(/\s+/g, " ").trim();
  const maxLen = 26;
  const title = topic.length > maxLen ? `${topic.slice(0, maxLen)}…` : topic;
  return { title, signature };
}

export function ThreadList() {
  const aui = useAui();

  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadItems = useAuiState((s) => s.threads.threadItems);
  const messages = useAuiState((s) => s.thread.messages);
  const lastTopicRef = useRef<TopicState | null>(null);

  const rows = useMemo<ThreadRow[]>(() => {
    const visibleItems = threadItems.filter(
      (item) => item.status !== "archived" && item.status !== "deleted",
    );

    const ordered = [...visibleItems].sort((a, b) => {
      if (a.id === mainThreadId) return -1;
      if (b.id === mainThreadId) return 1;
      return 0;
    });

    return ordered.map((item, index) => {
      const isNew = item.status === "new";
      const fallbackKey =
        item.id
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(-4)
          .toUpperCase() || `${index + 1}`;
      const fallbackTitle = isNew ? "新对话" : `对话 ${fallbackKey}`;
      const title = item.title?.trim() || fallbackTitle;

      return {
        id: item.id,
        title,
        isActive: item.id === mainThreadId,
        isNew,
      };
    });
  }, [mainThreadId, threadItems]);

  const activeThread = useMemo(
    () => threadItems.find((item) => item.id === mainThreadId),
    [mainThreadId, threadItems],
  );

  useEffect(() => {
    const targetThread = threadItems.find((item) => item.id === mainThreadId);
    if (!targetThread || targetThread.status === "new") return;

    const { title: nextTitle, signature } = buildTopicTitle(messages);
    if (!nextTitle) return;

    const currentTitle = targetThread.title?.trim() ?? "";
    if (currentTitle === nextTitle) {
      lastTopicRef.current = {
        threadId: mainThreadId,
        signature,
        title: nextTitle,
      };
      return;
    }

    const last = lastTopicRef.current;
    if (
      last &&
      last.threadId === mainThreadId &&
      last.signature === signature &&
      last.title === nextTitle
    ) {
      return;
    }

    lastTopicRef.current = {
      threadId: mainThreadId,
      signature,
      title: nextTitle,
    };

    try {
      aui.threads().item({ id: mainThreadId }).rename(nextTitle);
    } catch {
      // noop: rename best-effort only
    }
  }, [aui, mainThreadId, messages, threadItems]);

  const handleCreateThread = () => {
    if (activeThread?.status === "new") return;
    aui.threads().switchToNewThread();
  };

  const handleSwitchThread = (threadId: string) => {
    if (threadId === mainThreadId) return;
    aui.threads().switchToThread(threadId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 pb-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full cursor-pointer justify-start gap-2 rounded-xl border-dashed active:cursor-grabbing group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          aria-label="新建对话"
          onClick={handleCreateThread}
        >
          <PlusIcon className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">新建对话</span>
        </Button>
      </div>

      <SidebarGroup className="min-h-0 p-0">
        <SidebarGroupLabel className="px-3 text-[11px] uppercase tracking-wide">
          会话列表
        </SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 overflow-y-auto">
          <SidebarMenu className="gap-1 px-2 pb-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
            {rows.length === 0 ? (
              <div className="text-sidebar-foreground/60 rounded-md px-2 py-2 text-xs">
                暂无会话，点击上方按钮开始。
              </div>
            ) : (
              rows.map((row) => (
                <SidebarMenuItem
                  key={row.id}
                  className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                >
                  <SidebarMenuButton
                    type="button"
                    isActive={row.isActive}
                    className="h-9 cursor-pointer data-[active=true]:bg-zinc-200 data-[active=true]:text-zinc-900 active:cursor-grabbing group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center"
                    title={row.title}
                    onClick={() => handleSwitchThread(row.id)}
                  >
                    <MessageSquareTextIcon className="size-4" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {row.title}
                    </span>
                    {row.isNew ? (
                      <span className="ms-auto rounded-full border px-1.5 py-0.5 text-[10px] leading-none group-data-[collapsible=icon]:hidden">
                        NEW
                      </span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}
