"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DatabaseIcon, PlaneTakeoffIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModuleItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
};

const moduleItems: ModuleItem[] = [
  {
    href: "/assistant",
    label: "旅游计划顾问",
    icon: PlaneTakeoffIcon,
    isActive: (pathname) => pathname.startsWith("/assistant"),
  },
  {
    href: "/documents",
    label: "知识库文档上传",
    icon: DatabaseIcon,
    isActive: (pathname) => pathname.startsWith("/documents"),
  },
];

export function ModuleSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="tablist"
      aria-label="模块切换"
    >
      {moduleItems.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;

        return (
          <Button
            key={item.href}
            asChild
            size="xs"
            variant={active ? "default" : "ghost"}
            className={cn(
              "h-7 rounded-full px-2.5 text-xs",
              active
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
