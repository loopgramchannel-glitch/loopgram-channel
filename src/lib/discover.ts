import type { PostT } from "@/lib/posts";

/** Saved file names (long hex codes) are not real titles; fall back to the description or a friendly label. */
export function niceTitle(p: Pick<PostT, "title" | "text">, fallback: string): string {
  const junk = (s: string) => !s.trim() || /^[0-9a-f]{16,}(\s+\d+)?$/i.test(s.trim());
  if (!junk(p.title)) return p.title;
  if (!junk(p.text)) return p.text.slice(0, 90);
  return fallback;
}

/** The post the Home spotlight shows: first one (in feed order) with a real title and a picture. */
export function pickFeatured<T extends Pick<PostT, "title" | "text" | "imageUrl">>(list: T[]): T | undefined {
  return list.find((p) => p.imageUrl && niceTitle(p, "") !== "") ?? list.find((p) => p.imageUrl) ?? list[0];
}

/** Home big box: the owner's chosen post when it's still published, otherwise the automatic pick. */
export function pickHero<T extends Pick<PostT, "id" | "title" | "text" | "imageUrl">>(list: T[], heroId: string): T | undefined {
  return (heroId && list.find((p) => p.id === heroId)) || pickFeatured(list);
}

/** Explore Top 10: the owner's picks first, in their order (deleted ones skipped), then the automatic list fills the rest. */
export function pickTopTen<T extends Pick<PostT, "id">>(list: T[], ids: string[], auto: T[]): T[] {
  const byId = new Map(list.map((p) => [p.id, p]));
  const chosen = ids.map((id) => byId.get(id)).filter((p): p is T => !!p);
  const seen = new Set(chosen.map((p) => p.id));
  return [...chosen, ...auto.filter((p) => !seen.has(p.id))].slice(0, 10);
}
