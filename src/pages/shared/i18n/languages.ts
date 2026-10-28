// The languages the extension is shown in: every language Twitch offers (read off Twitch's own language menu).
// Pure data and a resolver, so it is tested in plain node.

export type Direction = "ltr" | "rtl";

export type Language = {
  // The code of the language's catalog (src/pages/shared/i18n/catalogs/<code>.ts); English is catalog.en.ts
  code: string;
  // Its name in itself, which is what the popup lists (never translated)
  name: string;
  dir: Direction;
  // The codes Twitch uses for it (its <html lang> and `language` cookie), for the record and the tests
  twitch: string[];
};

// Sorted the way Twitch's menu lists them
export const LANGUAGES: Language[] = [
  { code: "en", name: "English", dir: "ltr", twitch: ["en-US"] },
  { code: "da", name: "Dansk", dir: "ltr", twitch: ["da-DK"] },
  { code: "de", name: "Deutsch", dir: "ltr", twitch: ["de-DE"] },
  { code: "en-GB", name: "English - UK", dir: "ltr", twitch: ["en-GB"] },
  { code: "es", name: "Español", dir: "ltr", twitch: ["es-ES", "es-MX"] },
  { code: "fr", name: "Français", dir: "ltr", twitch: ["fr-FR"] },
  { code: "it", name: "Italiano", dir: "ltr", twitch: ["it-IT"] },
  { code: "hu", name: "Magyar", dir: "ltr", twitch: ["hu-HU"] },
  { code: "nl", name: "Nederlands", dir: "ltr", twitch: ["nl-NL"] },
  { code: "no", name: "Norsk", dir: "ltr", twitch: ["no-NO"] },
  { code: "pl", name: "Polski", dir: "ltr", twitch: ["pl-PL"] },
  { code: "pt-PT", name: "Português", dir: "ltr", twitch: ["pt-PT"] },
  { code: "pt-BR", name: "Português - Brasil", dir: "ltr", twitch: ["pt-BR"] },
  { code: "ro", name: "Română", dir: "ltr", twitch: ["ro-RO"] },
  { code: "sk", name: "Slovenčina", dir: "ltr", twitch: ["sk-SK"] },
  { code: "fi", name: "Suomi", dir: "ltr", twitch: ["fi-FI"] },
  { code: "sv", name: "Svenska", dir: "ltr", twitch: ["sv-SE"] },
  { code: "vi", name: "Tiếng Việt", dir: "ltr", twitch: ["vi-VN"] },
  { code: "tr", name: "Türkçe", dir: "ltr", twitch: ["tr-TR"] },
  { code: "cs", name: "Čeština", dir: "ltr", twitch: ["cs-CZ"] },
  { code: "el", name: "Ελληνικά", dir: "ltr", twitch: ["el-GR"] },
  { code: "bg", name: "Български", dir: "ltr", twitch: ["bg-BG"] },
  { code: "ru", name: "Русский", dir: "ltr", twitch: ["ru-RU"] },
  { code: "uk", name: "Українська", dir: "ltr", twitch: ["uk-UA"] },
  { code: "th", name: "ภาษาไทย", dir: "ltr", twitch: ["th-TH"] },
  { code: "ar", name: "العربية", dir: "rtl", twitch: ["ar-SA"] },
  { code: "zh-CN", name: "中文 简体", dir: "ltr", twitch: ["zh-CN"] },
  { code: "zh-TW", name: "中文 繁體", dir: "ltr", twitch: ["zh-TW"] },
  { code: "ja", name: "日本語", dir: "ltr", twitch: ["ja-JP"] },
  { code: "ko", name: "한국어", dir: "ltr", twitch: ["ko-KR"] },
];

// "qps" is the standard pseudo-locale: every message is made of accented look-alike letters in brackets, so a
// string that was never moved into the catalog stands out. It is for tests; it is not offered to users.
export const PSEUDO = "qps";

const byLowerCode = new Map(LANGUAGES.map((l) => [l.code.toLowerCase(), l.code]));

// Language tags that are not a catalog's own code but belong to one
const ALIASES: Record<string, string> = {
  pt: "pt-BR", // the larger of the two, when the region is not said
  zh: "zh-CN",
  "zh-hans": "zh-CN",
  "zh-sg": "zh-CN",
  "zh-hant": "zh-TW",
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
  nb: "no",
  nn: "no",
};

export const isLanguageCode = (value: unknown): value is string => typeof value === "string" && (value === PSEUDO || byLowerCode.has(value.toLowerCase()));

// The catalog code for one language tag ("es-MX" is "es", "zh-Hant-TW" is "zh-TW"), or undefined
const match = (tag: string): string | undefined => {
  const lower = tag.toLowerCase().replace(/_/g, "-");
  if (lower === PSEUDO || lower.startsWith(`${PSEUDO}-`)) return PSEUDO;
  const parts = lower.split("-");
  // The most specific form first: the whole tag, then without the last part, down to the language
  for (let n = parts.length; n >= 1; n--) {
    const candidate = parts.slice(0, n).join("-");
    const code = byLowerCode.get(candidate) ?? byLowerCode.get(ALIASES[candidate]?.toLowerCase() ?? "");
    if (code) return code;
  }
  return undefined;
};

// The first language tag in the list that the extension has a catalog for, else English
export const resolveLanguage = (candidates: (string | undefined | null)[]): string => {
  for (const candidate of candidates) {
    const code = candidate ? match(candidate) : undefined;
    if (code) return code;
  }
  return "en";
};

export const directionOf = (code: string): Direction => LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
