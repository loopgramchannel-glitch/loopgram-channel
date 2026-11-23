import { describe, expect, it } from "vitest";
import { chunk, purgeUrls } from "@/lib/cf-purge";
import { cachePolicy } from "@/server";

const html = () => new Response("<p>x</p>", { headers: { "content-type": "text/html" } });
const get = (p: string) => new Request(`https://loopgramchannel.com${p}`);

describe("edge cache TTL", () => {
  it("home and shorts are cached 5 minutes with 1 day stale-while-revalidate", () => {
    for (const p of ["/", "/shorts"]) expect(cachePolicy(get(p), html())).toContain("s-maxage=300, stale-while-revalidate=86400");
  });
  it("search results are edge-cached per query", () => {
    expect(cachePolicy(get("/search?q=dance"), html())).toContain("s-maxage=300");
  });
});

describe("purge on publish/delete", () => {
  it("flushes the feeds and the changed post, plain and build-keyed", () => {
    const u = purgeUrls(["abc-1"], "b9", ["loopgramchannel.com"]);
    expect(u).toContain("https://loopgramchannel.com/");
    expect(u).toContain("https://loopgramchannel.com/shorts?__b=b9");
    expect(u).toContain("https://loopgramchannel.com/post/abc-1");
    expect(u).toContain("https://loopgramchannel.com/post/abc-1?__b=b9");
  });
  it("ignores invalid ids", () => {
    expect(purgeUrls(["../x"], "b", ["h"]).some((x) => x.includes("post"))).toBe(false);
  });
  it("sends at most 30 URLs per call", () => {
    expect(chunk(Array.from({ length: 61 }, (_, i) => i)).map((c) => c.length)).toEqual([30, 30, 1]);
  });
});
