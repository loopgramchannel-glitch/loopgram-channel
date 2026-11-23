import { describe, expect, it } from "vitest";
import { asPostList, feedPosts } from "@/lib/safe-data";

describe("pages never crash on missing data", () => {
  it("feedPosts returns [] for undefined data", () => expect(feedPosts(undefined)).toEqual([]));
  it("feedPosts returns [] when pages are missing", () => expect(feedPosts({})).toEqual([]));
  it("feedPosts skips broken pages", () =>
    expect(feedPosts({ pages: [null, { posts: undefined }, { posts: [{ id: "a1" }] }] })).toEqual([{ id: "a1" }]));
  it("asPostList returns [] for an error answer", () => expect(asPostList({ error: "x" })).toEqual([]));
});
