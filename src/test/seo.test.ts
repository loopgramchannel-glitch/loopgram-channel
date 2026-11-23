import { describe, it, expect } from "vitest";
import { sitemapXml, videoJsonLd } from "@/lib/seo";
import type { PostT } from "@/lib/posts";

const post = (o: Partial<PostT> = {}): PostT => ({ id: "abc-1", title: "Cat & dog", text: "Funny", videoUrl: "https://media.loopgramchannel.com/a.mp4", imageUrl: "https://media.loopgramchannel.com/a.jpg", category: "", ratio: 0, source: "", mix: "", pinned: false, published: true, createdAt: 1700000000000, ...o });

describe("Google SEO", () => {
  it("sitemap lists published videos with absolute URLs", () => {
    const xml = sitemapXml([post()]);
    expect(xml).toContain("<loc>https://loopgramchannel.com/post/abc-1</loc>");
    expect(xml).toContain("<video:title>Cat &amp; dog</video:title>");
  });
  it("sitemap excludes unpublished videos", () => {
    expect(sitemapXml([post({ published: false })])).not.toContain("/post/abc-1");
  });
  it("VideoObject has Google's required fields", () => {
    const ld = videoJsonLd(post())!;
    expect(ld["@type"]).toBe("VideoObject");
    expect(ld.thumbnailUrl).toEqual(["https://media.loopgramchannel.com/a.jpg"]);
    expect(ld.uploadDate).toBe("2023-11-14T22:13:20.000Z");
  });
  it("no VideoObject without a thumbnail", () => {
    expect(videoJsonLd(post({ imageUrl: "", videoUrl: "" }))).toBeNull();
  });
});
