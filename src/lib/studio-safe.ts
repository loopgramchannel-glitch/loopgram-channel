// Studio safety helpers: turn missing/broken server answers into safe defaults so panels never crash.
import { SiteSettings, type SiteSettingsT } from "./studio.functions";

/** Always a full settings object; bad or missing input → defaults. */
export function safeSettings(raw: unknown): SiteSettingsT {
  const r = SiteSettings.safeParse(raw && typeof raw === "object" ? raw : {});
  return r.success ? r.data : SiteSettings.parse({});
}

/** Always an array. */
export function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
