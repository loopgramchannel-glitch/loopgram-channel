// Cloudflare edge cache (Cache API) in front of the worker: visitors get a copy from the
// nearest data center, so Redis/D1 see ~1 request per page per data center per TTL.
/** Header public read server functions set so the edge may share their answer. */
export const EDGE_DATA_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400";

export type EdgeDirectives = { sMaxAge: number; swr: number; sie: number };

/** Parses a shared-cache policy; null when the response must not be stored at the edge. */
export function edgeDirectives(cc: string | null): EdgeDirectives | null {
  if (!cc || !/\bpublic\b/.test(cc) || /no-store|private/.test(cc)) return null;
  const n = (k: string) => Number(new RegExp(`${k}=(\\d+)`).exec(cc)?.[1] ?? 0);
  const sMaxAge = n("s-maxage");
  if (sMaxAge <= 0) return null;
  return { sMaxAge, swr: n("stale-while-revalidate"), sie: n("stale-if-error") };
}

/** fresh = serve; stale = serve + refresh in background; expired = must fetch (but may serve on error). */
export function edgeState(storedAt: number, d: EdgeDirectives, now = Date.now()): "fresh" | "stale" | "expired" {
  const age = (now - storedAt) / 1000;
  if (age < d.sMaxAge) return "fresh";
  if (age < d.sMaxAge + d.swr) return "stale";
  return "expired";
}

/** Edge cache key: pages and data are keyed by build so a deploy never serves HTML that points
 *  at page files from the previous build. Hashed /assets/ files are build-specific already. */
export function edgeKey(url: string, build: string): string {
  const u = new URL(url);
  if (u.pathname.startsWith("/assets/")) return u.toString();
  u.searchParams.set("__b", build);
  return u.toString();
}
