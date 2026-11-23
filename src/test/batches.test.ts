import { describe, expect, it } from "vitest";
import { chunk, POST_DELETE_BATCH, MEDIA_DELETE_BATCH } from "@/lib/batches";

describe("bulk delete batches", () => {
  it("splits 1275 posts into batches no bigger than the server limit", () => {
    const ids = Array.from({ length: 1275 }, (_, i) => `p-${i}`);
    const parts = chunk(ids, POST_DELETE_BATCH);
    expect(parts.every((p) => p.length <= 1000 && p.length <= POST_DELETE_BATCH)).toBe(true);
    expect(parts.flat()).toEqual(ids);
  });
  it("media batches stay under the 500-file server limit", () => {
    expect(MEDIA_DELETE_BATCH).toBeLessThanOrEqual(500);
    expect(chunk(Array.from({ length: 501 }, (_, i) => i), MEDIA_DELETE_BATCH).length).toBe(11);
  });
});
