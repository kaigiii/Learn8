"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/useI18n";

export default function LanguageHtmlUpdater() {
  const { languageKey } = useI18n();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = languageKey;
  }, [languageKey]);

  return null;
}
