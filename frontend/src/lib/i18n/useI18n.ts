"use client";

import { useCallback } from "react";
import useUserStore from "@/stores/app/useUserStore";
import {
  DEFAULT_LANGUAGE_LABEL,
  LANGUAGE_OPTIONS,
  resolveLanguageKey,
  resolveLanguageLabel,
} from "@/lib/i18n/languages";
import { translations, type TranslationKey } from "@/lib/i18n/translations";

export function useI18n() {
  const preferredLanguage = useUserStore(
    (state) => state.clientOnly.preferences.preferredLanguage
  );
  const setPreferences = useUserStore((state) => state.setPreferences);

  const languageLabel = resolveLanguageLabel(preferredLanguage);
  const languageKey = resolveLanguageKey(preferredLanguage);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const fallback = translations.en[key] ?? key;
      const template = translations[languageKey]?.[key] ?? fallback;
      if (!params) return template;

      return Object.entries(params).reduce((acc, [paramKey, value]) => {
        return acc.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
      }, template);
    },
    [languageKey]
  );

  const setLanguageLabel = useCallback(
    (label: string) => {
      const normalized = resolveLanguageLabel(label || DEFAULT_LANGUAGE_LABEL);
      setPreferences({ preferredLanguage: normalized });
    },
    [setPreferences]
  );

  return {
    t,
    languageKey,
    languageLabel,
    setLanguageLabel,
    languageOptions: LANGUAGE_OPTIONS,
  };
}
