import { describe, expect, it } from "vitest";
import { readEnv, syncWorkerEnv } from "@/lib/worker-env";
import { asPostList, asPostOrNull } from "@/lib/safe-data";
import { mixFeed } from "@/lib/feed-mix";

describe("Cloudflare keys reach server code", () => {
  it("creates process.env when the Worker has none and copies text keys", () => {
    const g: Record<string, any> = {};
    syncWorkerEnv({ R2_PUBLIC_URL: "https://media.example.com", DB: { prepare() {} } }, g);
    expect(g["process"].env.R2_PUBLIC_URL).toBe("https://media.example.com");
    expect(g["process"].env.DB).toBeUndefined();
    expect(readEnv("R2_PUBLIC_URL", g)).toBe("https://media.example.com");
  });

  it("fills empty process.env values but keeps ones already set", () => {
    const g: Record<string, any> = { process: { env: { OWNER_UID: "keep", EMPTY: "" } } };
    syncWorkerEnv({ OWNER_UID: "other", EMPTY: "filled" }, g);
    expect(g["process"].env.OWNER_UID).toBe("keep");
    expect(g["process"].env.EMPTY).toBe("filled");
  });

  it("still finds a key when process.env is frozen", () => {
    const g: Record<string, any> = { process: { env: Object.freeze({}) } };
    syncWorkerEnv({ ALGOLIA_APP_ID: "APP1" }, g);
    expect(readEnv("ALGOLIA_APP_ID", g)).toBe("APP1");
  });

  it("returns an empty string for a missing key", () => {
    expect(readEnv("NOPE_KEY", {})).toBe("");
  });
});

describe("pages never receive undefined video data", () => {
  it("turns undefined or bad list answers into an empty list", () => {
    expect(asPostList(undefined)).toEqual([]);
    expect(asPostList({ error: true })).toEqual([]);
    expect(asPostList([{ id: "a1" }, null, 5])).toEqual([{ id: "a1" }]);
  });
  it("turns an undefined single post into null", () => {
    expect(asPostOrNull(undefined)).toBeNull();
    expect(asPostOrNull({ id: "abc" })).toEqual({ id: "abc" });
  });
  it("mixFeed handles a missing list", () => {
    expect(mixFeed(undefined as never, 1)).toEqual([]);
  });
});
