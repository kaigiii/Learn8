"use client";

import { clearAllNavigationIntents } from "@/lib/navigation/intents";
import type {
  LessonComponentManifestResponse,
  LessonGenerationPreferenceItem,
  LessonGenerationPreferenceListResponse,
} from "@/lib/apiTypes";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const GENERIC_FETCH_ERROR_FRAGMENTS = [
  "failed to fetch",
  "fetch failed",
  "network request failed",
  "network error",
  "load failed",
  "networkerror when attempting to fetch resource",
];

function isGenericFetchErrorMessage(message: string | null | undefined) {
  const normalized = (message ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return GENERIC_FETCH_ERROR_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment)
  );
}

function normalizeErrorDetail(detail: string | null | undefined, fallback: string) {
  const normalized = (detail ?? "").trim();
  if (!normalized || isGenericFetchErrorMessage(normalized)) {
    return fallback;
  }
  return normalized;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    const normalizedDetail = normalizeErrorDetail(detail, "Request failed. Please try again.");
    super(normalizedDetail);
    this.status = status;
    this.detail = normalizedDetail;
  }
}

export function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return normalizeErrorDetail(error.detail, fallback);
  }

  if (error instanceof Error) {
    return normalizeErrorDetail(error.message, fallback);
  }

  return fallback;
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

export function getAuthToken() {
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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new ApiError(
      0,
      resolveErrorMessage(error, "Unable to connect to server. Please try again.")
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = data.detail || data.message || detail;
    } catch {
      // ignore parse failure
    }

    detail = normalizeErrorDetail(
      detail,
      response.status >= 500
        ? "Server error. Please try again."
        : "Request failed. Please try again."
    );

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

export const BACKEND_DEV_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || "13105";

export function getDirectBackendUrl(path: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  return isDev ? `http://${host}:${BACKEND_DEV_PORT}${API_BASE_URL}${path}` : `${API_BASE_URL}${path}`;
}

export function getDirectBackendWsUrl(path: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
  return isDev 
    ? `${protocol}://${host}:${BACKEND_DEV_PORT}${API_BASE_URL}${path}` 
    : (process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") || `${protocol}://${host}:${BACKEND_DEV_PORT}${API_BASE_URL}${path}`);
}

export function buildSseUrl(jobId: string) {
  // 優先嘗試連向後端直連埠口 (13105)，避開 Next.js dev proxy 的緩衝問題
  return getDirectBackendUrl(`/jobs/${jobId}/stream`);
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

export function fetchLessonGenerationPreferences(courseId: number) {
  return apiFetch<LessonGenerationPreferenceListResponse>(
    `/lessons/generation-preferences?course_id=${courseId}`
  );
}

export function saveLessonGenerationPreference(payload: {
  courseId: number;
  nodeId?: string | null;
  allowedComponents: string[];
}) {
  return apiFetch<LessonGenerationPreferenceItem>("/lessons/generation-preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteLessonGenerationPreference(params: {
  courseId: number;
  nodeId?: string | null;
}) {
  const search = new URLSearchParams();
  search.set("course_id", String(params.courseId));
  if (params.nodeId) {
    search.set("node_id", params.nodeId);
  }
  return apiFetch<void>(`/lessons/generation-preferences?${search.toString()}`, {
    method: "DELETE",
  });
}
