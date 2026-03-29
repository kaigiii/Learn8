"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/app/useAuthStore";

export function useRequireAuthRedirect(redirectTo = "/auth/login") {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const authHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!authHydrated) return;
    if (!token) {
      router.replace(redirectTo);
    }
  }, [authHydrated, redirectTo, router, token]);

  return {
    token,
    authHydrated,
    isAuthenticated: !!token,
    isReady: authHydrated && !!token,
  };
}
