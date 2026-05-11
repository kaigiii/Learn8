export const LANGUAGE_OPTIONS = [
  { key: "en", label: "English" },
  { key: "zh-TW", label: "繁體中文" },
  { key: "zh-CN", label: "简体中文" },
  { key: "ja", label: "日本語" },
  { key: "ko", label: "한국어" },
  { key: "es", label: "Español" },
] as const;

export type LanguageKey = (typeof LANGUAGE_OPTIONS)[number]["key"];
export type LanguageLabel = (typeof LANGUAGE_OPTIONS)[number]["label"];

export const DEFAULT_LANGUAGE_KEY: LanguageKey = "en";
export const DEFAULT_LANGUAGE_LABEL: LanguageLabel = "English";

const LABEL_TO_KEY: Record<string, LanguageKey> = LANGUAGE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.label] = option.key;
    return acc;
  },
  {} as Record<string, LanguageKey>
);

const KEY_TO_LABEL: Record<LanguageKey, LanguageLabel> = LANGUAGE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option.label;
    return acc;
  },
  {} as Record<LanguageKey, LanguageLabel>
);

export function resolveLanguageKey(value?: string | null): LanguageKey {
  if (!value) return DEFAULT_LANGUAGE_KEY;
  if ((KEY_TO_LABEL as Record<string, LanguageLabel>)[value]) {
    return value as LanguageKey;
  }
  if (LABEL_TO_KEY[value]) {
    return LABEL_TO_KEY[value];
  }
  return DEFAULT_LANGUAGE_KEY;
}

export function resolveLanguageLabel(value?: string | null): LanguageLabel {
  if (!value) return DEFAULT_LANGUAGE_LABEL;
  if (LABEL_TO_KEY[value]) {
    return value as LanguageLabel;
  }
  if ((KEY_TO_LABEL as Record<string, LanguageLabel>)[value]) {
    return KEY_TO_LABEL[value as LanguageKey];
  }
  return DEFAULT_LANGUAGE_LABEL;
}
