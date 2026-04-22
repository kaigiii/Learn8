import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/lib/apiTypes";

function normalizeAvatarUrl(user: UserProfile | null): UserProfile | null {
  if (!user) {
    return user;
  }

  const email = user.email?.trim().toLowerCase();
  const avatarUrl = user.avatar_url?.trim();
  if (!email || !avatarUrl) {
    return user;
  }

  const match = avatarUrl.match(/(\/auth\/avatar-images\/)([^/?#]+)/);
  if (!match) {
    return user;
  }

  const filename = decodeURIComponent(match[2]);
  const isLegacyFilename = /^\d+\.png$/i.test(filename) || /^user-\d+\.png$/i.test(filename);
  if (!isLegacyFilename) {
    return user;
  }

  const normalizedFilename = `${email}.png`;
  const normalizedAvatarUrl = avatarUrl.replace(match[2], encodeURIComponent(normalizedFilename));
  return {
    ...user,
    avatar_url: normalizedAvatarUrl,
  };
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  hasHydrated: boolean;
  setSession: (token: string, user: UserProfile | null) => void;
  updateUser: (user: UserProfile) => void;
  clearSession: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setSession: (token, user) => set({ token, user: normalizeAvatarUrl(user) }),
      updateUser: (user) => set({ user: normalizeAvatarUrl(user) }),
      clearSession: () => set({ token: null, user: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "learn8-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.user = normalizeAvatarUrl(state.user);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
