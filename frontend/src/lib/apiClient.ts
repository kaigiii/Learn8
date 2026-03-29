"use client";

import { clearAllNavigationIntents } from "@/lib/navigation/intents";
import type { LessonComponentManifestResponse } from "@/lib/apiTypes";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function clearPersistedSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("learn8-auth");
  window.localStorage.removeItem("learn8-user");
  clearAllNavigationIntents();
}

function redirectToLoginOnUnauthorized() {
  if (typeof window === "undefined") {
    return;
  }

  clearPersistedSession();

  if (window.location.pathname !== "/auth/login") {
    window.location.replace("/auth/login");
  }
}

function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("learn8-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();

  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = data.detail || data.message || detail;
    } catch {
      // ignore parse failure
    }

    if (response.status === 401) {
      redirectToLoginOnUnauthorized();
    }

    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function buildSseUrl(jobId: string) {
  return `${API_BASE_URL}/jobs/${jobId}/stream`;
}

export function createIdempotencyKey(scope: string) {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${suffix}`;
}

export function fetchLessonComponentManifest() {
  return apiFetch<LessonComponentManifestResponse>("/lessons/components");
}
