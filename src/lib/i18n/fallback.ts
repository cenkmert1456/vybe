import type { Dict, TKey } from "./types";

/**
 * Interpolation for `{placeholder}` values inside translation strings, e.g.
 * `t("common.kmAway", { km: 4 })` → "4 km away". Unknown placeholders are left
 * untouched (never render as undefined).
 */
export function interpolate(
  template: string | undefined,
  params?: Record<string, string | number>,
): string {
  if (!template) return "";
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

/**
 * Safe key resolution: active-language dict → English fallback → the raw key
 * itself. Never throws, never returns undefined, never leaks `null`.
 */
export function resolveText(
  dict: Dict,
  en: Dict,
  key: TKey,
  params?: Record<string, string | number>,
): string {
  const raw = dict[key] ?? en[key] ?? key;
  return interpolate(raw, params);
}
