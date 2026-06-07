"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearAuthUser,
  getUserInitials,
  readAuthUser,
  writeAuthUser,
  type AuthUser,
} from "@/lib/auth-session";

function ProfilePageContent() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const current = readAuthUser();
    setUser(current);
    setDisplayName(current?.name ?? "");
  }, []);

  const profileName = displayName.trim() || user?.name || "未登录访客";
  const userInitials = useMemo(
    () => getUserInitials(user ? { ...user, name: profileName } : user),
    [profileName, user],
  );
  const userName = profileName;
  const userEmail = user?.email ?? "未绑定邮箱";

  const onSaveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) {
      setError("请先登录账号。");
      return;
    }

    const resolvedName = displayName.trim();
    if (!resolvedName) {
      setError("名称不能为空。");
      return;
    }

    const wantsPasswordUpdate = newPassword.length > 0 || confirmPassword.length > 0;
    if (wantsPasswordUpdate) {
      if (newPassword.length < 6) {
        setError("新密码至少 6 位。");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("两次输入的密码不一致。");
        return;
      }
    }

    const nextUser: AuthUser = {
      ...user,
      name: resolvedName,
      password: wantsPasswordUpdate ? newPassword : user.password,
    };

    writeAuthUser(nextUser);
    setUser(nextUser);
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("个人信息已保存。");
  };

  const onLogout = () => {
    clearAuthUser();
    setUser(null);
    router.push("/login");
  };

  return (
    <main className="min-h-dvh bg-[linear-gradient(165deg,oklch(0.99_0_0)_0%,oklch(0.975_0_0)_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          onClick={() => router.push("/assistant")}
        >
          <ArrowLeftIcon className="size-4" />
          返回助手
        </Button>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_14px_40px_-30px_rgba(0,0,0,0.35)] sm:p-8">
          <header className="flex items-center gap-4 border-zinc-200 border-b pb-5">
            <Avatar size="lg" className="ring-1 ring-black/5">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={userName} /> : null}
              <AvatarFallback className="bg-zinc-900 text-white">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-zinc-900">{userName}</h1>
              <p className="truncate text-sm text-zinc-500">{userEmail}</p>
            </div>
          </header>

          <section className="mt-5 space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
              <UserRoundIcon className="size-4" />
              个人中心
            </div>

            <form className="space-y-3" onSubmit={onSaveProfile}>
              <div className="rounded-xl border border-zinc-200 px-4 py-3">
                <label htmlFor="profile_name" className="text-xs text-zinc-500">
                  名称
                </label>
                <Input
                  id="profile_name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="请输入名称"
                  className="mt-2 h-10 rounded-lg border-zinc-200"
                />
              </div>

              <div className="rounded-xl border border-zinc-200 px-4 py-3">
                <p className="text-xs text-zinc-500">邮箱</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{userEmail}</p>
              </div>

              <div className="rounded-xl border border-zinc-200 px-4 py-3">
                <label htmlFor="new_password" className="text-xs text-zinc-500">
                  新密码
                </label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="留空表示不修改"
                  autoComplete="new-password"
                  className="mt-2 h-10 rounded-lg border-zinc-200"
                />
              </div>

              <div className="rounded-xl border border-zinc-200 px-4 py-3">
                <label htmlFor="confirm_password" className="text-xs text-zinc-500">
                  确认新密码
                </label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                  className="mt-2 h-10 rounded-lg border-zinc-200"
                />
              </div>

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {success}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  type="submit"
                  className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  保存修改
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl"
                  onClick={onLogout}
                >
                  <LogOutIcon className="size-4" />
                  退出登录
                </Button>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return <ProfilePageContent />;
}
