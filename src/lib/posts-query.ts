// Shared posts query (used by /posts, /post/$id and the home shelf) so all views share one cache entry.
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { getPosts, getPostsPage, getPublicPost } from "@/lib/posts.functions";
import type { FeedPage } from "@/lib/feed-page";
import { asPostList, asPostOrNull } from "@/lib/safe-data";

// Always a list (never undefined), so no page can crash with "data is undefined"; real errors still throw.
export const postsQuery = queryOptions({ queryKey: ["posts"], queryFn: async () => asPostList(await getPosts()), staleTime: 30_000 });

/** One post, checked against its authoritative database state (unpublished/deleted → null). */
export const postQuery = (id: string) =>
  queryOptions({ queryKey: ["post", id], queryFn: async () => asPostOrNull(await getPublicPost({ data: { id } })), staleTime: 15_000 });

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  const steps: [number, string][] = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [n, u] of steps) if (s >= n) { const v = Math.floor(s / n); return `${v} ${u}${v > 1 ? "s" : ""} ago`; }
  return "just now";
}

/** Home feed, 20 posts per page; the next page loads as the viewer scrolls. */
export const feedQuery = (c?: string) =>
  infiniteQueryOptions({
    queryKey: ["feed", c ?? ""],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const r = (await getPostsPage({ data: { cursor: pageParam, ...(c ? { c } : {}) } })) as Partial<FeedPage> | undefined;
      return { posts: asPostList(r?.posts), next: typeof r?.next === "string" ? r.next : null, cats: Array.isArray(r?.cats) ? r.cats : [] };
    },
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: 30_000,
  });
