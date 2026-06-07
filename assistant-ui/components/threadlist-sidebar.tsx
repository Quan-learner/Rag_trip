"use client";

import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import { Compass, LogOutIcon, PanelLeftIcon, UserRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clearAuthUser, getUserInitials, readAuthUser, type AuthUser } from "@/lib/auth-session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/thread-list";

export function ThreadListSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readAuthUser());
  }, []);

  const userInitials = useMemo(() => getUserInitials(user), [user]);
  const userName = user?.name ?? "未登录访客";
  const userEmail = user?.email ?? "请先登录账号";

  const handleLogout = () => {
    clearAuthUser();
    setUser(null);
    router.push("/login");
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "bg-white shadow-[4px_0_14px_rgba(0,0,0,0.04)] group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0",
        className,
      )}
      {...props}
    >
      <SidebarHeader className="aui-sidebar-header mb-2 px-3 py-3">
        <div className="aui-sidebar-header-content flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          {isCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="展开侧边栏"
              title="展开侧边栏"
              className="group/logo flex size-10 items-center justify-center rounded-xl transition-colors hover:cursor-e-resize hover:bg-zinc-100 active:cursor-grabbing"
            >
              <div className="aui-sidebar-header-icon-wrapper flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                <Compass className="aui-sidebar-header-icon size-4 group-hover/logo:hidden" />
                <PanelLeftIcon className="hidden size-4 group-hover/logo:block" />
              </div>
            </button>
          ) : (
            <div className="group/logo flex min-w-0 items-center gap-2 rounded-xl px-2 py-2">
              <div className="aui-sidebar-header-icon-wrapper flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                <Compass className="aui-sidebar-header-icon size-4" />
              </div>
              <div className="aui-sidebar-header-heading flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="aui-sidebar-header-title truncate font-semibold">
                  Trip Copilot
                </span>
                <span className="truncate text-xs">RAG 旅游知识助手</span>
              </div>
            </div>
          )}
          <SidebarTrigger className="size-8 shrink-0 rounded-lg bg-zinc-100 text-zinc-700 hover:cursor-w-resize hover:bg-zinc-200 active:cursor-grabbing group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent className="aui-sidebar-content px-2">
        <ThreadList />
      </SidebarContent>
      <SidebarFooter className="aui-sidebar-footer mt-auto px-2 pb-3 pt-2">
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-left transition-colors hover:bg-zinc-50 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              title={userName}
              aria-label="打开个人中心"
            >
              <Avatar
                size={isCollapsed ? "sm" : "default"}
                className="ring-1 ring-black/5 group-data-[collapsible=icon]:size-6"
              >
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={userName} /> : null}
                <AvatarFallback className="bg-zinc-900 text-white">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-medium text-zinc-900">{userName}</p>
                <p className="truncate text-xs text-zinc-500">{userEmail}</p>
              </div>
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>个人中心</DialogTitle>
              <DialogDescription>账号信息入口</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                <Avatar className="ring-1 ring-black/5">
                  {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={userName} /> : null}
                  <AvatarFallback className="bg-zinc-900 text-white">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{userName}</p>
                  <p className="truncate text-xs text-zinc-500">{userEmail}</p>
                </div>
              </div>

              {user ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start rounded-xl"
                    onClick={() => router.push("/profile")}
                  >
                    <UserRoundIcon className="size-4" />
                    个人中心
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full justify-start rounded-xl"
                    onClick={handleLogout}
                  >
                    <LogOutIcon className="size-4" />
                    退出登录
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                  onClick={() => router.push("/login")}
                >
                  去登录
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  );
}
