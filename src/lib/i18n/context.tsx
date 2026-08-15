import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LOCALES,
  RTL_LANGS,
  matchLang,
  type Lang,
  type TKey,
} from "./types";
import { DICTS } from "./locales";
import { resolveText } from "./fallback";

export interface I18nContextValue {
  /** Resolved language (automatic preference resolved to a concrete code). */
  lang: Lang;
  /** Raw preference: "auto" or an explicit language code. */
  langPref: Lang | "auto";
  setLang: (lang: Lang | "auto") => void;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  formatRelativeTime: (ms: number) => string;
  formatClockTime: (ms: number) => string;
  formatFullDate: (ms: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "vybe-lang";

function detectDeviceLang(): Lang {
  try {
    const langs = navigator.languages ?? [navigator.language ?? ""];
    for (const tag of langs) {
      const m = matchLang(tag);
      if (m) return m;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

function pickPref(): Lang | "auto" {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto") return "auto";
    const m = matchLang(stored ?? "");
    if (m) return m;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Manual selection wins; otherwise detect from the device.
  const [langPref, setLangPref] = useState<Lang | "auto">(pickPref);
  const lang: Lang = langPref === "auto" ? detectDeviceLang() : langPref;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, langPref);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  }, [lang, langPref]);

  const dict = DICTS[lang] ?? DICTS.en;

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) =>
      resolveText(dict, DICTS.en, key, params),
    [dict],
  );

  const formatRelativeTime = useCallback(
    (ms: number) => {
      const diff = Date.now() - ms;
      const min = 60 * 1000;
      const hour = 60 * min;
      const day = 24 * hour;
      if (diff < min) return t("common.justNow");
      if (diff < hour) return t("common.minutesAgo", { n: Math.floor(diff / min) });
      if (diff < day) return t("common.hoursAgo", { n: Math.floor(diff / hour) });
      if (diff < 7 * day) return t("common.daysAgo", { n: Math.floor(diff / day) });
      if (diff < 2 * day) return t("common.yesterday");
      return formatFullDate(ms);
    },
    [t, formatFullDate],
  );

  const formatClockTime = useCallback(
    (ms: number) => {
      const d = new Date(ms);
      return d.toLocaleTimeString(LOCALES[lang], {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [lang],
  );

  function formatFullDate(ms: number) {
    const d = new Date(ms);
    return d.toLocaleDateString(LOCALES[lang], {
      day: "numeric",
      month: "short",
    });
  }

  const setLang = useCallback((next: Lang | "auto") => setLangPref(next), []);

  const value = useMemo(
    () => ({
      lang,
      langPref,
      setLang,
      t,
      formatRelativeTime,
      formatClockTime,
      formatFullDate,
    }),
    [lang, langPref, setLang, t, formatRelativeTime, formatClockTime, formatFullDate],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
