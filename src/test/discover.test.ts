import { describe, expect, it } from "vitest";
import { niceTitle, pickFeatured } from "@/lib/discover";

describe("niceTitle", () => {
  it("hides saved file-name codes and uses the description instead", () => {
    expect(niceTitle({ title: "798bffcd4aba4640072c383c53f5933e 1795206768198", text: "why is this so funny" }, "Video")).toBe("why is this so funny");
  });
  it("falls back when both are empty or codes", () => {
    expect(niceTitle({ title: "798bffcd4aba4640072c383c53f5933e", text: "" }, "Video")).toBe("Video");
  });
  it("keeps real titles", () => {
    expect(niceTitle({ title: "How I feel with this jacket", text: "" }, "Video")).toBe("How I feel with this jacket");
  });
});

describe("pickFeatured", () => {
  it("skips posts without a real title or picture", () => {
    const list = [
      { id: "a", title: "798bffcd4aba4640072c383c53f5933e", text: "", imageUrl: "x.jpg" },
      { id: "b", title: "Real one", text: "", imageUrl: "" },
      { id: "c", title: "Spotlight", text: "", imageUrl: "y.jpg" },
    ];
    expect(pickFeatured(list)?.id).toBe("c");
  });
});

import { pickHero, pickTopTen } from "@/lib/discover";

describe("owner picks for Home and Explore", () => {
  const list = [
    { id: "a", title: "A", text: "", imageUrl: "a.jpg" },
    { id: "b", title: "B", text: "", imageUrl: "b.jpg" },
    { id: "c", title: "C", text: "", imageUrl: "c.jpg" },
  ];
  it("big box shows the video the owner chose", () => expect(pickHero(list, "c")?.id).toBe("c"));
  it("big box goes back to automatic when the chosen video is gone", () => expect(pickHero(list, "gone")?.id).toBe("a"));
  it("Top 10 starts with the owner's picks in their order, then fills automatically", () => {
    expect(pickTopTen(list, ["c", "gone", "a"], [list[1]!, list[0]!, list[2]!]).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });
  it("Top 10 never shows more than 10", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `p${i}` }));
    expect(pickTopTen(many, [], many)).toHaveLength(10);
  });
});
