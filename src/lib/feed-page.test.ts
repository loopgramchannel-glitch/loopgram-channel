import { describe, expect, it } from "vitest";
import { pagePosts, parseCursor } from "./feed-page";
import type { PostT } from "./posts";

const mk = (i: number, category = ""): PostT => ({ id: `p-${i}xx`, title: `t${i}`, text: "", videoUrl: "", imageUrl: "", category, ratio: 0, source: "", mix: `m${i % 7}`, pinned: false, published: true, createdAt: 1_000_000 + i * 1000 });
const all = Array.from({ length: 627 }, (_, i) => mk(i, i % 3 ? "" : "Music"));

describe("feed pages", () => {
  it("sends 20 posts per page by default", () => {
    expect(pagePosts(all, {}).posts).toHaveLength(20);
  });
  it("walking every page returns all 627 posts exactly once", () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 100; i++) {
      const p = pagePosts(all, { cursor });
      seen.push(...p.posts.map((x) => x.id));
      if (!p.next) break;
      cursor = p.next;
    }
    expect(seen).toHaveLength(627);
    expect(new Set(seen).size).toBe(627);
  });
  it("keeps the same order when the hour changes mid-scroll", () => {
    const first = pagePosts(all, {}, 0);
    const later = pagePosts(all, { cursor: first.next! }, 10 * 3_600_000);
    const fresh = pagePosts(all, { limit: 40 }, 0);
    expect(later.posts.map((p) => p.id)).toEqual(fresh.posts.slice(20).map((p) => p.id));
  });
  it("filters by category and caps page size at 50", () => {
    const m = pagePosts(all, { c: "Music", limit: 999 });
    expect(m.posts).toHaveLength(50);
    expect(m.posts.every((p) => p.category === "Music")).toBe(true);
  });
  it("bad cursor starts from the top", () => {
    expect(parseCursor("junk").offset).toBe(0);
  });
});
