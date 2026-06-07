"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readAuthUser, writeAuthUser } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";
type LoginMethod = "email" | "username";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("username");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const heading = useMemo(() => (mode === "login" ? "欢迎回来" : "创建账号"), [mode]);
  const submitLabel = useMemo(() => (mode === "login" ? "登录系统" : "创建并进入"), [mode]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const username = String(form.get("username") ?? "").trim();
    const nickname = String(form.get("nickname") ?? "").trim();

    const account = mode === "login" ? (loginMethod === "email" ? email : username) : email;
    if (!account) {
      setError(
        loginMethod === "username" && mode === "login" ? "请输入用户名。" : "请输入邮箱地址。",
      );
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("两次输入的密码不一致，请重新确认。");
      return;
    }

    const previous = readAuthUser();
    const accountPrefix = account.includes("@") ? (account.split("@")[0] ?? "") : account;
    const fallbackName = accountPrefix || "旅行者";
    const resolvedName =
      mode === "register"
        ? nickname || fallbackName
        : previous?.email === account
          ? previous.name
          : fallbackName;

    writeAuthUser({
      email: account,
      name: resolvedName,
      avatarUrl: previous?.email === account ? previous.avatarUrl : undefined,
      password,
    });

    setIsSubmitting(true);
    router.push("/assistant");
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[linear-gradient(160deg,oklch(0.99_0_0)_0%,oklch(0.975_0_0)_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="-z-10 pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,oklch(0.92_0.01_230)_0%,transparent_36%),radial-gradient(circle_at_82%_88%,oklch(0.9_0.012_260)_0%,transparent_30%)]" />

      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-stretch rounded-3xl border border-black/10 bg-white shadow-[0_18px_60px_-32px_rgba(0,0,0,0.3)]">
        <section className="flex w-full flex-1 flex-col justify-between p-8 sm:p-10 lg:p-12">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-black/10 px-3 py-1 text-xs font-medium tracking-[0.18em] text-zinc-600 uppercase">
                Trip Copilot
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{heading}</h1>
                <p className="mt-2 text-sm text-zinc-500">旅游计划顾问后台访问入口</p>
              </div>
            </div>

            <form className="w-full max-w-[22rem] space-y-4" onSubmit={onSubmit}>
              {mode === "login" ? (
                <div className="inline-flex w-full max-w-[17rem] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-0">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("username");
                      setError(null);
                    }}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium transition hover:cursor-pointer",
                      loginMethod === "username"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800",
                    )}
                  >
                    用户名登录
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("email");
                      setError(null);
                    }}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium transition hover:cursor-pointer",
                      loginMethod === "email"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800",
                    )}
                  >
                    邮箱登录
                  </button>
                </div>
              ) : null}

              <div className="grid gap-4">
                {mode === "register" || loginMethod === "email" ? (
                  <Input
                    required
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="邮箱地址"
                    className="auth-input h-12 rounded-xl border-zinc-200 bg-transparent px-4 py-2 shadow-none focus:bg-transparent hover:bg-transparent dark:bg-transparent"
                  />
                ) : (
                  <Input
                    required
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="用户名"
                    className="auth-input h-12 rounded-xl border-zinc-200 bg-transparent px-4 py-2 shadow-none focus:bg-transparent hover:bg-transparent dark:bg-transparent"
                  />
                )}

                {mode === "register" ? (
                  <Input
                    required
                    name="nickname"
                    type="text"
                    autoComplete="name"
                    placeholder="昵称"
                    className="auth-input h-12 rounded-xl border-zinc-200 bg-transparent px-4 py-2 shadow-none focus:bg-transparent hover:bg-transparent dark:bg-transparent"
                  />
                ) : null}

                <Input
                  required
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="auth-input h-12 rounded-xl border-zinc-200 bg-transparent px-4 py-2 shadow-none focus:bg-transparent hover:bg-transparent dark:bg-transparent"
                />

                {mode === "register" ? (
                  <Input
                    required
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="确认密码"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="auth-input h-12 rounded-xl border-zinc-200 bg-transparent px-4 py-2 shadow-none focus:bg-transparent hover:bg-transparent dark:bg-transparent"
                  />
                ) : null}
              </div>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl bg-zinc-900 text-white hover:cursor-pointer hover:bg-zinc-800"
              >
                {submitLabel}
                <ArrowRightIcon className="size-4" />
              </Button>
            </form>
          </div>

          <p className="text-xs text-zinc-500">
            {mode === "login" ? "没有账号？" : "已有账号？"}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setLoginMethod("username");
                setError(null);
              }}
              className="ml-1 font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:cursor-pointer"
            >
              {mode === "login" ? "立即注册" : "去登录"}
            </button>
          </p>
        </section>

        <section className="relative hidden flex-1 overflow-hidden rounded-r-3xl border-l border-black/10 md:block">
          <div className="absolute inset-0 bg-[linear-gradient(150deg,oklch(0.95_0.01_220)_0%,oklch(0.98_0_0)_48%,oklch(0.93_0.012_250)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9)_0%,transparent_40%),radial-gradient(circle_at_75%_30%,rgba(255,255,255,0.65)_0%,transparent_38%),radial-gradient(circle_at_50%_80%,rgba(17,24,39,0.08)_0%,transparent_45%)]" />

          <div className="relative flex h-full flex-col justify-between p-10 lg:p-12">
            <div>
              <p className="text-xs tracking-[0.22em] text-zinc-500 uppercase">Minimal Split</p>
              <h2 className="mt-3 max-w-xs text-3xl font-semibold leading-tight text-zinc-900">
                轻量登录，快速回到你的行程工作台
              </h2>
            </div>

            <div className="space-y-3 rounded-2xl border border-black/10 bg-white/70 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <CheckIcon className="size-4 text-zinc-900" />
                一个账号管理全部旅行会话
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <CheckIcon className="size-4 text-zinc-900" />
                登录与注册同页切换
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <CheckIcon className="size-4 text-zinc-900" />
                与现有系统风格保持一致
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
