export const AUTH_USER_STORAGE_KEY = "tripcopilot.auth.user";

export type AuthUser = {
  name: string;
  email: string;
  avatarUrl?: string;
  password?: string;
};

function isClient() {
  return typeof window !== "undefined";
}

export function readAuthUser(): AuthUser | null {
  if (!isClient()) return null;

  try {
    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof parsed.email !== "string" || !parsed.email.trim()) return null;

    const fallbackName = parsed.email.split("@")[0] || "旅行者";
    return {
      email: parsed.email.trim(),
      name:
        typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName,
      avatarUrl:
        typeof parsed.avatarUrl === "string" && parsed.avatarUrl.trim()
          ? parsed.avatarUrl.trim()
          : undefined,
      password:
        typeof parsed.password === "string" && parsed.password.length > 0
          ? parsed.password
          : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAuthUser(user: AuthUser) {
  if (!isClient()) return;
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  if (!isClient()) return;
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function getUserInitials(user: AuthUser | null): string {
  if (!user) return "访客";
  const source = (user.name || user.email || "").trim();
  if (!source) return "访客";

  const compact = source.replace(/\s+/g, "");
  if (compact.length <= 2) return compact.toUpperCase();

  const emailLocal = compact.split("@")[0];
  const words = emailLocal.split(/[._-]+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return emailLocal.slice(0, 2).toUpperCase();
}
