import { useEffect, useState } from "react";
import { authClient, authEnabled, getStoredUser, type StoredUser } from "./client";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

function asAppUser(user: { id: string; name?: string | null; email?: string | null; image?: string | null } | StoredUser): AppUser {
  return {
    id: user.id,
    displayName: "displayName" in user ? user.displayName : (user.name ?? null),
    primaryEmail: "primaryEmail" in user ? user.primaryEmail : (user.email ?? null),
    profileImageUrl: "profileImageUrl" in user ? user.profileImageUrl : (user.image ?? null),
    isDevFallback: false,
  };
}

export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  const { data, isPending } = authClient.useSession();
  const [localUser, setLocalUser] = useState<AppUser | null>(null);
  useEffect(() => {
    setLocalUser(getStoredUser());
  }, []);
  const sessionUser = data?.user;
  return {
    user: sessionUser ? asAppUser(sessionUser) : localUser,
    isPending: isPending && !localUser,
  };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
