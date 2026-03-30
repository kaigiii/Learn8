"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import {
  fetchAuthenticatedLedger,
  syncPersistedProfile,
  topUpAuthenticatedCredits,
} from "@/lib/auth/profileSync";
import type { UserLedgerEvent, UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useCourseStore } from "@/stores/app/useCourseStore";
import useUserStore, {
  selectUserName,
  selectUserPreferences,
  selectUserTitle,
} from "@/stores/app/useUserStore";

export function useProfileSettings(onClose: () => void) {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setCurrentCourse = useCourseStore((s) => s.setCurrentCourse);
  const name = useUserStore(selectUserName);
  const title = useUserStore(selectUserTitle);
  const preferences = useUserStore(selectUserPreferences);
  const setPreferences = useUserStore((s) => s.setPreferences);
  const logout = useUserStore((s) => s.logout);

  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    education_level: "",
    preferred_language: "",
    daily_learning_goal_minutes: "",
  });
  const [saving, setSaving] = useState(false);
  const [toppingUpAmount, setToppingUpAmount] = useState<number | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<UserLedgerEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      full_name: authUser?.full_name || name,
      job_title: authUser?.job_title || "",
      education_level: authUser?.education_level || "",
      preferred_language: authUser?.preferred_language || "",
      daily_learning_goal_minutes: authUser?.daily_learning_goal_minutes
        ? String(authUser.daily_learning_goal_minutes)
        : "",
    });
  }, [authUser, name]);

  useEffect(() => {
    let cancelled = false;

    const loadLedger = async () => {
      if (!authUser) {
        setLedgerItems([]);
        return;
      }

      setLedgerLoading(true);
      try {
        const response = await fetchAuthenticatedLedger(8, 0);
        if (!cancelled) {
          setLedgerItems(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.detail : "Failed to load recent account activity."
          );
        }
      } finally {
        if (!cancelled) {
          setLedgerLoading(false);
        }
      }
    };

    void loadLedger();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const profile = await apiFetch<UserProfile>("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          full_name: form.full_name.trim() || null,
          job_title: form.job_title.trim() || null,
          education_level: form.education_level.trim() || null,
          preferred_language: form.preferred_language.trim() || null,
          daily_learning_goal_minutes: form.daily_learning_goal_minutes
            ? Number(form.daily_learning_goal_minutes)
            : null,
        }),
      });
      syncPersistedProfile(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickTopUp = async (amount: number) => {
    setToppingUpAmount(amount);
    setError("");
    try {
      await topUpAuthenticatedCredits(amount);
      const response = await fetchAuthenticatedLedger(8, 0);
      setLedgerItems(response.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to top up credits.");
    } finally {
      setToppingUpAmount(null);
    }
  };

  const handleOpenStore = () => {
    onClose();
    router.push("/store");
  };

  const handleLogout = () => {
    clearSession();
    setCurrentCourse(null);
    logout();
    onClose();
    router.push("/auth/login");
  };

  return {
    authUser,
    title,
    preferences,
    form,
    setForm,
    saving,
    toppingUpAmount,
    ledgerLoading,
    ledgerItems,
    error,
    setPreferences,
    handleSaveProfile,
    handleQuickTopUp,
    handleOpenStore,
    handleLogout,
  };
}
