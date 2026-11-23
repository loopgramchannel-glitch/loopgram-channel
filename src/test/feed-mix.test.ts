import { describe, expect, it } from "vitest";
import { mixFeed, mixGroup } from "@/lib/feed-mix";
import { mixKey } from "@/lib/posts";

const mk = (g: string, n: number, pinned = false) => Array.from({ length: n }, (_, i) => ({ id: `${g}${i}`, g, pinned, createdAt: i, category: "" }));

describe("for you mix", () => {
  it("never shows the same creator twice in a row when others exist", () => {
    const out = mixFeed([...mk("a", 20), ...mk("b", 20), ...mk("c", 20)], 7, (p) => p.g);
    for (let i = 1; i < out.length; i++) expect(out[i]!.g).not.toBe(out[i - 1]!.g);
  });
  it("keeps pinned posts first and loses nothing", () => {
    const out = mixFeed([...mk("a", 5), ...mk("p", 1, true)], 3, (p) => p.g);
    expect(out[0]!.id).toBe("p0");
    expect(out).toHaveLength(6);
  });
  it("same seed gives the same order", () => {
    const l = [...mk("a", 10), ...mk("b", 10)];
    expect(mixFeed(l, 5, (p) => p.g).map((p) => p.id)).toEqual(mixFeed(l, 5, (p) => p.g).map((p) => p.id));
  });
  it("deals one video per account per round, in a different order each round", () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const out = mixFeed([...mk("a", 13), ...mk("b", 14), ...mk("c", 15)], seed, (p) => p.g);
      expect(out).toHaveLength(42);
      // First 13 rounds hold all three accounts exactly once each.
      for (let k = 0; k < 13; k++) expect(new Set(out.slice(k * 3, k * 3 + 3).map((p) => p.g)).size).toBe(3);
      const orders = new Set(Array.from({ length: 13 }, (_, k) => out.slice(k * 3, k * 3 + 3).map((p) => p.g).join("")));
      expect(orders.size).toBeGreaterThan(1); // not the same fixed 1-2-3 cycle every round
    }
  });
  it("a different hour gives a different order", () => {
    const l = [...mk("a", 10), ...mk("b", 10), ...mk("c", 10)];
    expect(mixFeed(l, 1, (p) => p.g).map((p) => p.id)).not.toEqual(mixFeed(l, 2, (p) => p.g).map((p) => p.id));
  });
  it("two imported accounts get different hidden groups; phone uploads group by time", () => {
    expect(mixGroup({ createdAt: 0, category: "", mix: mixKey("@dogs") })).not.toBe(mixGroup({ createdAt: 0, category: "", mix: mixKey("skate") }));
    expect(mixKey("@Dogs")).toBe(mixKey("dogs"));
    expect(mixKey("dogs")).not.toContain("dogs");
    expect(mixGroup({ createdAt: 0, category: "" })).toBe("b0");
  });
});
