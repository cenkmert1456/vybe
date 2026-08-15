import { en } from "./locales/en";

/**
 * Supported languages. Every language has a locale partial; missing keys fall
 * back to English at render time (see fallback.ts), so a key can never render
 * as `undefined` or leak the raw key.
 */
export const LANG_CODES = [
  "en",
  "tr",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ar",
  "ru",
  "ja",
  "ko",
  "zh-CN",
  "zh-TW",
  "hi",
  "id",
  "nl",
  "pl",
  "uk",
  "sv",
  "no",
  "da",
  "fi",
  "el",
  "cs",
  "ro",
  "vi",
  "th",
] as const;

export type Lang = (typeof LANG_CODES)[number];

/** BCP-47 locales used for date/number formatting. */
export const LOCALES: Record<Lang, string> = {
  en: "en-GB",
  tr: "tr-TR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ar: "ar-SA",
  ru: "ru-RU",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  hi: "hi-IN",
  id: "id-ID",
  nl: "nl-NL",
  pl: "pl-PL",
  uk: "uk-UA",
  sv: "sv-SE",
  no: "nb-NO",
  da: "da-DK",
  fi: "fi-FI",
  el: "el-GR",
  cs: "cs-CZ",
  ro: "ro-RO",
  vi: "vi-VN",
  th: "th-TH",
};

/** Right-to-left languages (Arabic). */
export const RTL_LANGS: ReadonlySet<string> = new Set(["ar"]);

/** Normalize a browser locale tag to one of our supported codes. */
export function matchLang(tag: string): Lang | null {
  const t = tag.trim().toLowerCase();
  if (!t) return null;
  for (const code of LANG_CODES) {
    if (t === code.toLowerCase()) return code;
  }
  // base-language match, e.g. pt-BR → pt, es-MX → es, zh-Hans → zh-CN
  const base = t.split("-")[0];
  if (base === "zh")
    return t.includes("tw") || t.includes("hant") ? "zh-TW" : "zh-CN";
  const match = LANG_CODES.find((c) => c === base);
  return match ?? null;
}

/** Every key that exists in the English locale (the source of truth). */
export type TKey = keyof typeof en;

/** A full dictionary: every key → translated string. */
export type Dict = Record<string, string>;

/** A locale partial: any subset of keys, merged over the English base. */
export type PartialDict = Partial<Record<TKey, string>>;
