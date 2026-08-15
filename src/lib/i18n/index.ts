/**
 * Public i18n API. Existing imports of `@/lib/i18n` keep working unchanged:
 *
 *   import { I18nProvider, useI18n, type TKey } from "@/lib/i18n";
 *   import { LANG_CODES, LOCALES, LANGUAGE_NAMES, type Lang } from "@/lib/i18n";
 *
 * The implementation is split into small modules (types, fallback, context,
 * locales/*) so the translation dictionary can keep growing without a single
 * 4,000+ line file.
 */
export {
  LANG_CODES,
  LOCALES,
  RTL_LANGS,
  matchLang,
  type Lang,
  type TKey,
  type Dict,
  type PartialDict,
} from "./types";
export { LANGUAGE_NAMES } from "./locales";
export { I18nProvider, useI18n, type I18nContextValue } from "./context";
