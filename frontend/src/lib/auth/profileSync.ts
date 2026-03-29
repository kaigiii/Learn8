"use client";

import { apiFetch, createIdempotencyKey } from "@/lib/apiClient";
import type { UserLedgerResponse, UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore from "@/stores/app/useUserStore";

export function syncPersistedProfile(profile: UserProfile) {
  useAuthStore.getState().updateUser(profile);
  useUserStore.getState().syncFromProfile(profile);
}

export function establishAuthenticatedSession(token: string, profile: UserProfile) {
  useAuthStore.getState().setSession(token, profile);
  useUserStore.getState().syncFromProfile(profile);
}

export async function refreshAuthenticatedProfile() {
  const profile = await apiFetch<UserProfile>("/auth/me");
  syncPersistedProfile(profile);
  return profile;
}

export async function spendAuthenticatedCredits(amount: number) {
  const idempotencyKey = createIdempotencyKey("credits-spend");
  const profile = await apiFetch<UserProfile>(
    `/auth/credits/spend?amount=${amount}`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    }
  );
  syncPersistedProfile(profile);
  return profile;
}

export async function topUpAuthenticatedCredits(amount: number) {
  const idempotencyKey = createIdempotencyKey("credits-top-up");
  const profile = await apiFetch<UserProfile>(
    `/auth/credits/top-up?amount=${amount}`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    }
  );
  syncPersistedProfile(profile);
  return profile;
}

export async function fetchAuthenticatedLedger(limit = 50, offset = 0) {
  return apiFetch<UserLedgerResponse>(
    `/auth/ledger?limit=${limit}&offset=${offset}`
  );
}
