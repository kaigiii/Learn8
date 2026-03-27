"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useProjectStore } from "@/stores/app/useProjectStore";
import useUserStore from "@/stores/app/useUserStore";

export function useProfileSettings(onClose: () => void) {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const { name, title, preferences, setPreferences, syncFromProfile, logout } =
    useUserStore();

  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    education_level: "",
    daily_learning_goal_minutes: "",
  });
  const [saving, setSaving] = useState(false);
  const [toppingUpAmount, setToppingUpAmount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      full_name: authUser?.full_name || name,
      job_title: authUser?.job_title || "",
      education_level: authUser?.education_level || "",
      daily_learning_goal_minutes: authUser?.daily_learning_goal_minutes
        ? String(authUser.daily_learning_goal_minutes)
        : "",
    });
  }, [authUser, name]);

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
          daily_learning_goal_minutes: form.daily_learning_goal_minutes
            ? Number(form.daily_learning_goal_minutes)
            : null,
        }),
      });
      updateUser(profile);
      syncFromProfile(profile);
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
      const profile = await apiFetch<UserProfile>(
        `/auth/credits/topup?amount=${amount}`,
        { method: "POST" }
      );
      updateUser(profile);
      syncFromProfile(profile);
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
    setCurrentProject(null);
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
    error,
    setPreferences,
    handleSaveProfile,
    handleQuickTopUp,
    handleOpenStore,
    handleLogout,
  };
}
