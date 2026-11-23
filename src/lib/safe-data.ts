// Normalises server answers before pages use them: the video list is always an array and a
// single post is always an object or null — never undefined (React Query rejects undefined data).
import type { PostT } from "./posts";

export function asPostList(v: unknown): PostT[] {
  return Array.isArray(v) ? (v.filter((p) => p && typeof p === "object" && typeof (p as PostT).id === "string") as PostT[]) : [];
}

export function asPostOrNull(v: unknown): PostT | null {
  return v && typeof v === "object" && typeof (v as PostT).id === "string" ? (v as PostT) : null;
}

/** Joins infinite-feed pages into one list; tolerates missing data/pages/posts (never throws). */
export function feedPosts(data: unknown): PostT[] {
  const pages = (data as { pages?: unknown } | null | undefined)?.pages;
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((pg) => asPostList((pg as { posts?: unknown } | null | undefined)?.posts));
}
