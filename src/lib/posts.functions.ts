// Owner posts: public read + owner-only Studio writes (requireOwner on every write).
// Durable copy lives in Cloudflare D1 table `posts`; Redis `site:posts` is the fast cache.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setResponseHeader } from "@tanstack/react-start/server";
import { EDGE_DATA_CACHE } from "./edge-cache";
import { Post, Posts, fastPost, fastPosts, postIsEmpty, sortPosts, type PostT } from "./posts";

const tok = z.object({ token: z.string().min(20).max(4096) });

async function owner(token: string) {
  const { requireOwner, AuthError } = await import("./auth.server");
  try { return await requireOwner(token); }
  catch (e) { if (e instanceof AuthError) throw new Error(`${e.status}: ${e.message}`); throw new Error("401: Could not verify session"); }
}

async function readDurable(): Promise<PostT[] | null> {
  const { d1 } = await import("./backend.server");
  const { isPublicEligible } = await import("./owner-content");
  try {
    const r = await d1<{ body: string; status: string }>("SELECT body, status FROM posts ORDER BY created_at DESC LIMIT 10000");
    const out: PostT[] = [];
    for (const it of r.results) {
      let p: PostT | null = null;
      try { p = fastPost(JSON.parse(it.body ?? "null")); } catch { /* skip bad row */ }
      // D1 status is authoritative: a REJECTED/DRAFT row can never be shown as published.
      if (p) out.push({ ...p, published: isPublicEligible(it.status, p.published) });
    }
    return out;
  } catch (e) {
    // Visible in Cloudflare logs instead of silently showing an empty feed.
    const { log } = await import("./log.server");
    log("error", "posts_d1_read_failed", { message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// Single-flight: when the cache is cold, concurrent requests in this instance share one D1 read.
let inflight: Promise<PostT[]> | null = null;
// L1: per-isolate copy so a traffic spike reads RAM instead of calling Redis on every request.
// Fresh for 60s; after that the stale copy is served instantly while ONE background refresh runs,
// so a traffic spike never waits on (or stampedes) Redis/D1. Hard limit 10 min.
const L1_MS = 60_000;
const L1_STALE_MS = 600_000;
let l1: { v: PostT[]; exp: number; at: number } | null = null;
let refreshing: Promise<void> | null = null;
export async function readPosts(): Promise<PostT[]> {
  const now = Date.now();
  if (l1 && l1.exp > now) return l1.v;
  if (l1 && now - l1.at < L1_STALE_MS) {
    refreshing ??= readPostsUncached()
      .then((v) => { if (v.length) l1 = { v, exp: Date.now() + L1_MS, at: Date.now() }; })
      .catch(() => {})
      .finally(() => { refreshing = null; });
    return l1.v;
  }
  const v = await readPostsUncached();
  if (v.length) l1 = { v, exp: Date.now() + L1_MS, at: Date.now() };
  return v;
}
async function readPostsUncached(): Promise<PostT[]> {
  const { redis } = await import("./backend.server");
  const raw = (await redis(["GET", "site:posts"]).catch(() => null)) as string | null;
  if (typeof raw === "string") { try { const c = fastPosts(JSON.parse(raw)); if (c && c.length) return c; } catch { /* fall through */ } }
  // Redis empty, expired or down: rebuild from the permanent copy (D1 is the source of truth).
  inflight ??= (async () => {
    const d = await readDurable();
    if (d && d.length) { void redis(["SET", "site:posts", JSON.stringify(d), "EX", POSTS_TTL]).catch(() => null); return d; }
    return [];
  })().finally(() => { inflight = null; });
  return inflight;
}
// The cache expires on its own so a missed write can never hide posts for longer than this.
const POSTS_TTL = 600;
async function writeCache(list: PostT[]) {
  const { redis } = await import("./backend.server");
  const ok = await redis(["SET", "site:posts", JSON.stringify(list), "EX", POSTS_TTL]).catch(() => null);
  // Write failed: drop the old copy so readers go straight to D1 instead of a stale list.
  if (ok !== "OK") await redis(["DEL", "site:posts"]).catch(() => null);
  pub = null;
  l1 = null;
  one.clear();
}

let pub: { v: PostT[]; exp: number } | null = null;
/** Public: published posts only. Fails soft to an empty list. */
export const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  try { setResponseHeader("cache-control", EDGE_DATA_CACHE); } catch { /* internal SSR call */ }
  if (pub && pub.exp > Date.now()) return pub.v;
  const v = sortPosts((await readPosts().catch(() => [])).filter((p) => p.published));
  pub = { v, exp: Date.now() + 15_000 };
  return v;
});

/** Public: one page (~20 posts) of the mixed home feed. Cursor comes from the previous page. */
export const getPostsPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ cursor: z.string().max(40).optional(), limit: z.number().int().min(1).max(50).optional(), c: z.string().max(40).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    try { setResponseHeader("cache-control", EDGE_DATA_CACHE); } catch { /* internal SSR call */ }
    const { pagePosts } = await import("./feed-page");
    if (!pub || pub.exp <= Date.now()) pub = { v: sortPosts((await readPosts().catch(() => [])).filter((p) => p.published)), exp: Date.now() + 15_000 };
    return pagePosts(pub.v, data);
  });

// Per-instance 15s memo for single-post checks (absorbs a viral video's burst; also memoises "not found").
const one = new Map<string, { v: PostT | null; exp: number }>();
/** Public watch page check: reads the authoritative D1 row, never the cached list,
 * so unpublished/deleted/rejected posts disappear immediately even if Redis or Algolia are stale. */
export const getPublicPost = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[a-z0-9-]{3,64}$/) }).parse(d))
  .handler(async ({ data }): Promise<PostT | null> => {
    try { setResponseHeader("cache-control", EDGE_DATA_CACHE); } catch { /* internal SSR call */ }
    const hit = one.get(data.id);
    if (hit && hit.exp > Date.now()) return hit.v;
    const { d1 } = await import("./backend.server");
    const { isPublicEligible } = await import("./owner-content");
    let v: PostT | null = null;
    try {
      const it = (await d1<{ body: string; status: string }>("SELECT body, status FROM posts WHERE id = ?1", [data.id])).results[0];
      const p = it ? Post.safeParse(JSON.parse(it.body ?? "null")) : null;
      v = it && p?.success && isPublicEligible(it.status, p.data.published) ? p.data : null;
    } catch {
      // D1 unavailable: fall back to the published list (which itself only holds eligible posts).
      v = (await readPosts().catch(() => [])).find((p) => p.id === data.id && p.published) ?? null;
    }
    if (one.size > 2000) one.clear();
    one.set(data.id, { v, exp: Date.now() + 15_000 });
    return v;
  });

export const studioPosts = createServerFn({ method: "POST" }).inputValidator((d: unknown) => tok.parse(d)).handler(async ({ data }) => {
  await owner(data.token);
  return sortPosts(await readPosts());
});

export const studioPostSave = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tok.extend({ post: Post }).parse(d))
  .handler(async ({ data }) => {
    const me = await owner(data.token);
    const { audit } = await import("./auth.server");
    const { d1, r2Probe } = await import("./backend.server");
    const { mediaKeyFromUrl, sniffMime, publishGate } = await import("./owner-content");
    const p = data.post;
    if (postIsEmpty(p)) throw new Error("400: Write something or attach a video or picture.");
    const base = process.env["R2_PUBLIC_URL"] ?? "";
    const check = async (url: string, label: string) => {
      if (!url) return null;
      const key = mediaKeyFromUrl(url, base);
      if (!key) throw new Error(`400: The ${label} must be uploaded from Studio.`);
      let probe;
      try { probe = await r2Probe(key); } catch { throw new Error(`503: Couldn't check the ${label} right now. Try again.`); }
      return { exists: probe.exists, mime: probe.head ? sniffMime(probe.head) : null };
    };
    // Video: our own upload is checked in storage; a pasted platform link must be one we know how to play.
    const { parseVideoSource } = await import("./video-source");
    const src = p.videoUrl ? parseVideoSource(p.videoUrl, { uploadBase: base || undefined }) : null;
    if (src && src.provider === "unknown") throw new Error("400: That video link isn't supported. Use YouTube, Vimeo, Dailymotion, Twitch, Streamable, Facebook or a direct .mp4 link.");
    const videoCheck = src?.provider === "loopgram" || (src && mediaKeyFromUrl(p.videoUrl, base)) ? await check(p.videoUrl, "video") : null;
    const gate = publishGate(p.published, videoCheck, await check(p.imageUrl, "picture"));
    if (gate.status === "REJECTED") {
      await audit(me, "post.rejected", `post:${p.id}`, "denied");
      const msg: Record<string, string> = {
        VIDEO_MISSING: "The video file isn't in storage yet — upload it again.",
        VIDEO_BAD_SIGNATURE: "That file isn't a real video (MP4, WebM or MOV).",
        IMAGE_MISSING: "The picture isn't in storage yet — upload it again.",
        IMAGE_BAD_SIGNATURE: "That file isn't a real picture (JPG, PNG or WebP).",
      };
      throw new Error(`400: ${msg[gate.reason!] ?? "This post couldn't be checked."}`);
    }
    // Permanent save first; only then refresh the cache. Same id = same item, so retries never duplicate.
    let changed = 0;
    let wasPublic = false;
    try {
      const now = Date.now();
      wasPublic = ((await d1<{ status: string }>("SELECT status FROM posts WHERE id = ?1", [p.id])).results[0]?.status) === "PUBLISHED";
      // Out-of-order guard: an older, delayed save can never overwrite a newer one.
      const r = await d1(
        `INSERT INTO posts (id, status, body, created_at, updated_at, updated_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, body = excluded.body, updated_at = excluded.updated_at, updated_by = excluded.updated_by
         WHERE posts.updated_at <= excluded.updated_at`,
        [p.id, gate.status, JSON.stringify(p), p.createdAt || now, now, me.uid],
      );
      changed = r.meta.changes ?? 1;
    } catch { throw new Error("502: Could not save (storage unavailable)."); }
    if (changed === 0) throw new Error("409: A newer version of this post was saved. Reload and try again.");
    const list = await readPosts();
    const exists = list.some((x) => x.id === p.id);
    await writeCache(exists ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]);
    await audit(me, exists ? "post.update" : "post.create", `post:${p.id}`, "ok");
    // Search follows the saved state; failures go to a retry set and the next reconcile fixes them.
    const { syncPost } = await import("./algolia.server");
    const search = await syncPost(p, gate.status).catch(() => "failed");
    const { purgePostPages } = await import("./cf-purge.server");
    await purgePostPages([p.id]);
    return { ok: true, status: gate.status, search };
  });

export const studioPostDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tok.extend({ id: z.string().max(64) }).parse(d))
  .handler(async ({ data }) => {
    const me = await owner(data.token);
    const { audit } = await import("./auth.server");
    const { d1 } = await import("./backend.server");
    const before = await readPosts();
    const target = before.find((x) => x.id === data.id);
    try {
      await d1("DELETE FROM posts WHERE id = ?1", [data.id]);
    } catch { throw new Error("502: Could not delete (storage unavailable)."); }
    await writeCache(before.filter((x) => x.id !== data.id));
    const { unindexPost } = await import("./algolia.server");
    await unindexPost(data.id).catch(() => {});
    // Also remove the post's video and picture from R2 so nothing is left behind.
    let filesDeleted = 0;
    if (target) {
      const { mediaKeyFromUrl } = await import("./owner-content");
      const base = process.env["R2_PUBLIC_URL"] ?? "";
      const keys = [target.videoUrl, target.imageUrl].map((u) => (u ? mediaKeyFromUrl(u, base) : null)).filter((k): k is string => !!k);
      if (keys.length) {
        const { deleteR2Keys } = await import("./r2-delete.server");
        filesDeleted = (await deleteR2Keys(keys).catch(() => ({ deleted: [] as string[] }))).deleted.length;
      }
    }
    await audit(me, "post.delete", `post:${data.id}`, "ok", { files: filesDeleted });
    const { purgePostPages } = await import("./cf-purge.server");
    await purgePostPages([data.id]);
    return { ok: true };
  });

/** Bulk delete: removes many posts from D1, the cache and search; optionally their files in R2 too. */
export const studioPostsDeleteMany = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tok.extend({ ids: z.array(z.string().max(64)).min(1).max(1000), deleteFiles: z.boolean().default(true) }).parse(d))
  .handler(async ({ data }) => {
    const me = await owner(data.token);
    const { audit } = await import("./auth.server");
    const { d1 } = await import("./backend.server");
    const ids = [...new Set(data.ids)];
    const before = await readPosts();
    try {
      for (let i = 0; i < ids.length; i += 90) {
        const chunk = ids.slice(i, i + 90);
        await d1(`DELETE FROM posts WHERE id IN (${chunk.map((_, j) => `?${j + 1}`).join(",")})`, chunk);
      }
    } catch { throw new Error("502: Could not delete (storage unavailable)."); }
    const gone = new Set(ids);
    await writeCache(before.filter((x) => !gone.has(x.id)));
    const { unindexPost } = await import("./algolia.server");
    await Promise.all(ids.map((id) => unindexPost(id).catch(() => {})));
    const { purgePostPages } = await import("./cf-purge.server");
    await purgePostPages(ids);
    let files = { deleted: [] as string[], failed: [] as string[] };
    if (data.deleteFiles) {
      const { mediaKeyFromUrl } = await import("./owner-content");
      const base = process.env["R2_PUBLIC_URL"] ?? "";
      const keys = before.filter((p) => gone.has(p.id)).flatMap((p) => [p.videoUrl, p.imageUrl]).map((u) => (u ? mediaKeyFromUrl(u, base) : null)).filter((k): k is string => !!k);
      const { deleteR2Keys } = await import("./r2-delete.server");
      files = await deleteR2Keys(keys).catch(() => files);
    }
    await audit(me, "post.delete.bulk", `${ids.length} posts`, "ok", { files: files.deleted.length });
    return { ok: true, deleted: ids.length, filesDeleted: files.deleted.length, filesFailed: files.failed.length };
  });

/** Studio: bring in many wide (16:9) videos from one YouTube channel as YouTube links, in one save. */
export const studioYouTubeChannelImport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tok.extend({ channel: z.string().min(2).max(300), count: z.number().int().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const me = await owner(data.token);
    const { channelQuery, longVideosPlaylist, ytPostId, isoSeconds, isWideVideo } = await import("./youtube-channel");
    const key = process.env["YOUTUBE_API_KEY"] || process.env["GOOGLE_API_KEY"];
    if (!key) throw new Error("503: YouTube key isn't set up.");
    const q = channelQuery(data.channel);
    if (!q) throw new Error("400: Paste a YouTube channel link like youtube.com/@name.");
    const api = async (path: string, params: Record<string, string>) => {
      const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
      for (const [k, v] of Object.entries({ ...params, key })) u.searchParams.set(k, v);
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
      const j = (await r.json().catch(() => ({}))) as any;
      if (!r.ok) throw new Error(`502: YouTube said: ${j?.error?.message ?? r.status}`);
      return j;
    };
    const ch = await api("channels", { part: "snippet", ...("id" in q ? { id: q.id } : { forHandle: q.forHandle }) });
    const channelId: string | undefined = ch.items?.[0]?.id;
    if (!channelId) throw new Error("404: That YouTube channel wasn't found.");
    const existing = await readPosts();
    const have = new Set(existing.map((p) => p.source));
    const fresh: PostT[] = [];
    let pageToken = "", scanned = 0, skipped = 0;
    while (fresh.length < data.count && scanned < 2000) {
      const pl = await api("playlistItems", { part: "contentDetails", playlistId: longVideosPlaylist(channelId), maxResults: "50", ...(pageToken ? { pageToken } : {}) })
        .catch((e) => { if (scanned === 0) throw new Error("404: This channel has no long videos."); throw e; });
      const ids: string[] = (pl.items ?? []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
      scanned += ids.length;
      if (ids.length) {
        const vs = await api("videos", { part: "snippet,contentDetails,status", id: ids.join(",") });
        for (const v of vs.items ?? []) {
          if (fresh.length >= data.count) break;
          const src = `youtube:${v.id}`;
          if (have.has(src) || !v.status?.embeddable || !isWideVideo(isoSeconds(v.contentDetails?.duration ?? ""))) { skipped++; continue; }
          have.add(src);
          fresh.push(Post.parse({
            id: ytPostId(v.id), title: String(v.snippet?.title ?? "").slice(0, 200), text: String(v.snippet?.description ?? "").slice(0, 5000),
            videoUrl: `https://www.youtube.com/watch?v=${v.id}`, ratio: 1.778, source: src, published: true,
            createdAt: Date.parse(v.snippet?.publishedAt ?? "") || Date.now(),
          }));
        }
      }
      pageToken = pl.nextPageToken ?? "";
      if (!pageToken) break;
    }
    if (existing.length + fresh.length > 10000) throw new Error("400: That would go over the 10,000 post limit.");
    if (fresh.length) {
      const { d1Batch } = await import("./backend.server");
      const now = Date.now();
      for (let i = 0; i < fresh.length; i += 50) {
        await d1Batch(fresh.slice(i, i + 50).map((p) => ({
          sql: "INSERT OR IGNORE INTO posts (id, status, body, created_at, updated_at, updated_by) VALUES (?1, 'PUBLISHED', ?2, ?3, ?4, ?5)",
          params: [p.id, JSON.stringify(p), p.createdAt, now, me.uid],
        })));
      }
      await writeCache(sortPosts([...fresh, ...existing]));
      const { syncPost } = await import("./algolia.server");
      for (let i = 0; i < fresh.length; i += 10) await Promise.allSettled(fresh.slice(i, i + 10).map((p) => syncPost(p, "PUBLISHED")));
      const { audit } = await import("./auth.server");
      await audit(me, "post.youtube.channel", channelId, "ok", { added: fresh.length });
    }
    return { added: fresh.length, skipped };
  });
