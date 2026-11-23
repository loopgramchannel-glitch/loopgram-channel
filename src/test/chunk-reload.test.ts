import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../lib/chunk-reload";
import { edgeKey } from "../lib/edge-cache";

describe("old page files after a deploy", () => {
  it("recognises the missing page file error", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x.lovable.app/assets/explore-CtFgHS1s.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it("a new build never reuses a cached page from the old build", () => {
    expect(edgeKey("https://x.com/explore", "b1")).not.toBe(edgeKey("https://x.com/explore", "b2"));
    expect(edgeKey("https://x.com/explore?q=a", "b1")).toBe("https://x.com/explore?q=a&__b=b1");
  });

  it("hashed asset files keep their own key", () => {
    expect(edgeKey("https://x.com/assets/explore-CtFgHS1s.js", "b1")).toBe("https://x.com/assets/explore-CtFgHS1s.js");
  });
});
