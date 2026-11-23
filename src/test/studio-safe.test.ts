import { describe, expect, it } from "vitest";
import { arr, safeSettings } from "@/lib/studio-safe";

describe("studio safety", () => {
  it("missing settings become defaults", () => {
    const s = safeSettings(undefined);
    expect(s.topIds).toEqual([]);
    expect(s.maintenance).toBe(false);
  });
  it("broken settings become defaults", () => {
    expect(safeSettings({ topIds: "bad" }).topIds).toEqual([]);
  });
  it("arr never returns a non-array", () => {
    expect(arr(undefined)).toEqual([]);
    expect(arr(null)).toEqual([]);
    expect(arr([1])).toEqual([1]);
  });
});
