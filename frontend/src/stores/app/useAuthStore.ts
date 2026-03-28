import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/lib/apiTypes";

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
      setSession: (token, user) => set({ token, user }),
      updateUser: (user) => set({ user }),
      clearSession: () => set({ token: null, user: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "learn8-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
