import { useEffect, useState } from "react";
import { authClient, authEnabled, getStoredUser, setBearerToken, setStoredUser } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is disabled
 * (`VITE_AUTH_ENABLED=false`, the shipped default). With auth on, the sandbox
 * live preview does real sign-in via the baked preview client. Its id is
 * `"dev-user"` — the SAME id `verify.server.ts` returns server-side — so per-user
 * rows written in that mode belong to one consistent owner.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current user + loading state. Same behavior in live preview and when deployed:
 *   - Auth enabled -> the real signed-in user; `user` is `null` while
 *                            the session resolves (`isPending: true`) and when
 *                            signed out (`isPending: false`). Session comes from
 *                            Better Auth `useSession()` → `/api/auth/get-session`
 *                            (cookie when deployed; bearer in live preview).
 *   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
 *
 * Protect a route by waiting out `isPending` before acting on `user` —
 * redirecting on `user: null` alone bounces signed-in visitors to sign-in on
 * every hard reload:
 *
 *   import { RedirectToSignIn } from "@/lib/auth/gates";
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;              // still resolving — don't redirect yet
 *   if (!user) return <RedirectToSignIn />;  // definitely signed out
 *
 * `authEnabled` is a module-level constant fixed at load, so the guarded hook
 * call keeps a stable hook order across every render of a given component.
 */
function readAuthHash(): AppUser | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith("#auth=")) return null;
  try {
    const saved = JSON.parse(decodeURIComponent(hash.slice("#auth=".length))) as {
      token?: string;
      user?: AppUser;
    };
    if (!saved.token || !saved.user?.id) return null;
    setBearerToken(saved.token);
    setStoredUser(saved.user);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return saved.user;
  } catch {
    return null;
  }
}

export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const { data, isPending } = authClient.useSession();
  const [localUser, setLocalUser] = useState<AppUser | null>(null);
  const [cookieChecked, setCookieChecked] = useState(false);
  useEffect(() => {
    const fromHash = readAuthHash();
    const stored = fromHash ?? getStoredUser();
    if (stored) {
      setLocalUser(stored);
      setCookieChecked(true);
      return;
    }
    void fetch("/api/account/open?mode=me", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ok?: boolean; user?: { id?: string; name?: string; email?: string } }) => {
        if (!result?.ok || !result.user?.id) return;
        const user: AppUser = {
          id: result.user.id,
          displayName: result.user.name ?? null,
          primaryEmail: result.user.email ?? null,
          profileImageUrl: null,
          isDevFallback: false,
        };
        setStoredUser(user);
        setLocalUser(user);
      })
      .catch(() => undefined)
      .finally(() => setCookieChecked(true));
  }, []);
  const sessionUser = data?.user;
  return {
    user: sessionUser
      ? {
          id: sessionUser.id,
          displayName: sessionUser.name ?? null,
          primaryEmail: sessionUser.email ?? null,
          profileImageUrl: sessionUser.image ?? null,
          isDevFallback: false,
        }
      : localUser,
    isPending: !cookieChecked || (isPending && !localUser),
  };
}

/**
 * Convenience view of `useCurrentUserState().user` for display (e.g.
 * `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
 * for redirects/guards use `useCurrentUserState()` and check `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
