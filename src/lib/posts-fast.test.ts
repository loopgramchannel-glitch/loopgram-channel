import { describe, it, expect } from "vitest";
import { fastPost, fastPosts, Post } from "./posts";

describe("fastPost", () => {
  it("matches Post.parse defaults for a saved post", () => {
    const raw = { id: "abc-1", createdAt: 5, videoUrl: "https://x.com/a.mp4" };
    expect(fastPost(raw)).toEqual(Post.parse(raw));
  });
  it("rejects rows without a valid id", () => {
    expect(fastPost({ id: "A!", createdAt: 1 })).toBeNull();
  });
  it("keeps all 627 posts", () => {
    const list = Array.from({ length: 627 }, (_, i) => ({ id: `post-${i}`, createdAt: i }));
    expect(fastPosts(list)?.length).toBe(627);
  });
});
