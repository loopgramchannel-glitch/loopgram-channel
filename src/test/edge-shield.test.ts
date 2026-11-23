import { describe, expect, it } from "vitest";
import { EDGE_DATA_CACHE, edgeDirectives, edgeState } from "../lib/edge-cache";

describe("edge shield", () => {
  it("public video data is shared at the edge for 30s and served stale for a day", () => {
    expect(edgeDirectives(EDGE_DATA_CACHE)).toEqual({ sMaxAge: 300, swr: 86400, sie: 86400 });
  });
  it("never stores private or no-store answers", () => {
    expect(edgeDirectives("private, s-maxage=300")).toBeNull();
    expect(edgeDirectives("no-store")).toBeNull();
    expect(edgeDirectives(null)).toBeNull();
  });
  it("fresh, then stale (refresh in background), then expired", () => {
    const d = { sMaxAge: 30, swr: 60, sie: 0 };
    expect(edgeState(0, d, 10_000)).toBe("fresh");
    expect(edgeState(0, d, 40_000)).toBe("stale");
    expect(edgeState(0, d, 100_000)).toBe("expired");
  });
});
