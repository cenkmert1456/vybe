import type { Dict, Lang, PartialDict } from "../types";
import { LANG_CODES } from "../types";
import { en } from "./en";
import { tr } from "./tr";
import { es } from "./es";
import { fr } from "./fr";
import { de } from "./de";
import { it } from "./it";
import { pt } from "./pt";
import { ar } from "./ar";
import { ru } from "./ru";
import { ja } from "./ja";
import { ko } from "./ko";
import { zhCN } from "./zhCN";
import { zhTW } from "./zhTW";
import { hi } from "./hi";
import { id } from "./id";
import { nl } from "./nl";
import { pl } from "./pl";
import { uk } from "./uk";
import { sv } from "./sv";
import { no } from "./no";
import { da } from "./da";
import { fi } from "./fi";
import { el } from "./el";
import { cs } from "./cs";
import { ro } from "./ro";
import { vi } from "./vi";
import { th } from "./th";

/** Per-language overrides; empty means "use English entirely". */
export const PARTIALS: Record<Lang, PartialDict> = {
  en: {},
  tr,
  es,
  fr,
  de,
  it,
  pt,
  ar,
  ru,
  ja,
  ko,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  hi,
  id,
  nl,
  pl,
  uk,
  sv,
  no,
  da,
  fi,
  el,
  cs,
  ro,
  vi,
  th,
};

/** Resolved dictionaries: English base merged with each locale's overrides. */
export const DICTS: Record<Lang, Dict> = Object.fromEntries(
  LANG_CODES.map((code) => [
    code,
    { ...(en as Dict), ...(PARTIALS[code] as Dict) },
  ]),
) as Record<Lang, Dict>;
DICTS.tr = { ...(en as Dict), ...(tr as Dict) };

/** Native-language display names for the language picker. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  tr: "Türkçe",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ar: "العربية",
  ru: "Русский",
  ja: "日本語",
  ko: "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  nl: "Nederlands",
  pl: "Polski",
  uk: "Українська",
  sv: "Svenska",
  no: "Norsk",
  da: "Dansk",
  fi: "Suomi",
  el: "Ελληνικά",
  cs: "Čeština",
  ro: "Română",
  vi: "Tiếng Việt",
  th: "ไทย",
};
