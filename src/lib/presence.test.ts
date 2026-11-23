import { describe, it, expect } from "vitest";
import { isOnline, canDelete, ONLINE_MS } from "./presence";
describe("presence", () => {
  it("online when seen within 90 seconds", () => { expect(isOnline(1_000_000 - 89_000, 1_000_000)).toBe(true); });
  it("offline after 90 seconds", () => { expect(isOnline(1_000_000 - ONLINE_MS, 1_000_000)).toBe(false); expect(isOnline(null, 1)).toBe(false); });
  it("owner account cannot be deleted", () => { expect(canDelete("own", "me", "own")).toBe(false); expect(canDelete("me", "me", "own")).toBe(false); expect(canDelete("u1", "me", "own")).toBe(true); });
});
