"use client";

import { AssistantRuntimeProvider, AssistantCloud } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useMemo } from "react";
import { ModuleSwitcher } from "@/components/module-switcher";
import { Thread } from "@/components/thread";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/threadlist-sidebar";

const cloudBaseUrl = process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL;
const cloud = cloudBaseUrl
  ? new AssistantCloud({
      baseUrl: cloudBaseUrl,
      anonymous: true,
    })
  : undefined;

const CHAT_API_ENDPOINT = process.env.NEXT_PUBLIC_CHAT_API_ENDPOINT ?? "/api/chat";

export const Assistant = () => {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: CHAT_API_ENDPOINT,
      }),
    [],
  );

  const runtime = useChatRuntime({
    ...(cloud ? { cloud } : {}),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full bg-white">
          <ThreadListSidebar />
          <SidebarInset>
            <div className="relative flex h-full flex-col overflow-hidden">
              <div className="absolute right-4 top-3 z-20">
                <ModuleSwitcher />
              </div>
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
