// One page of the home feed, cut server-side from the hourly mix so visitors download ~20 posts at a time.
// Cursor "seed:offset" pins the hourly mix seed, so later pages never repeat or skip posts when the hour changes.
import { hourSeed, mixFeed } from "./feed-mix";
import type { PostT } from "./posts";

export const FEED_PAGE = 20;
export const FEED_PAGE_MAX = 50;

export type FeedPage = { posts: PostT[]; next: string | null; cats: string[] };

export function parseCursor(cursor: string | undefined, now = Date.now()): { seed: number; offset: number } {
  const m = /^(\d{1,12}):(\d{1,6})$/.exec(cursor ?? "");
  return m ? { seed: Number(m[1]), offset: Number(m[2]) } : { seed: hourSeed(now), offset: 0 };
}

/** `list` = published posts. Category "Shorts"/"Videos" are split in the browser (shape is measured there). */
export function pagePosts(list: PostT[], opts: { cursor?: string | undefined; limit?: number | undefined; c?: string | undefined }, now = Date.now()): FeedPage {
  const { seed, offset } = parseCursor(opts.cursor, now);
  const limit = Math.max(1, Math.min(FEED_PAGE_MAX, opts.limit ?? FEED_PAGE));
  const mixed = mixFeed(list, seed);
  const c = opts.c;
  const inCat = c && c !== "Shorts" && c !== "Videos" ? mixed.filter((p) => p.category === c) : mixed;
  const posts = inCat.slice(offset, offset + limit);
  const end = offset + posts.length;
  return {
    posts,
    next: end < inCat.length ? `${seed}:${end}` : null,
    cats: offset === 0 ? [...new Set(mixed.map((p) => p.category).filter(Boolean))] : [],
  };
}
