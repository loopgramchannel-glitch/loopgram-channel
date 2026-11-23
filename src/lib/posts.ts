// Owner posts shown across the whole site (browser-safe schema). Stored in Redis `site:posts`.
import { z } from "zod";

const httpsUrl = z.string().trim().max(2000).refine((u) => u === "" || /^https:\/\//.test(u), "Must start with https://");

export const Post = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,64}$/),
  title: z.string().trim().max(200).default(""),
  text: z.string().trim().max(5000).default(""),
  videoUrl: httpsUrl.default(""),
  imageUrl: httpsUrl.default(""),
  category: z.string().trim().max(40).default(""),
  /** Video shape (width / height) measured in Studio at upload; 0 = unknown (measured in the browser). */
  ratio: z.number().min(0).max(10).default(0),
  /** Where an imported video came from ("tiktok:<id>" / "youtube:<id>"), used to stop saving it twice. */
  source: z.string().max(80).default(""),
  /** Hidden mixing key (hash of the original account), never shown to visitors; "" for phone uploads. */
  mix: z.string().max(24).default(""),
  pinned: z.boolean().default(false),
  published: z.boolean().default(true),
  createdAt: z.number().int().nonnegative(),
});
export type PostT = z.infer<typeof Post>;
export const Posts = z.array(Post).max(10000);

/** Newest first, pinned on top. */
export function sortPosts(list: PostT[]): PostT[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

/** A post needs something to show. */
export function postIsEmpty(p: Pick<PostT, "title" | "text" | "videoUrl" | "imageUrl">) {
  return !p.title && !p.text && !p.videoUrl && !p.imageUrl;
}

/** Hidden mixing key for an account name: a short hash, so the account name itself is never stored or shown. */
export function mixKey(handle: string): string {
  const h = handle.trim().replace(/^@/, "").toLowerCase();
  if (!h) return "";
  let x = 2166136261;
  for (let i = 0; i < h.length; i++) { x ^= h.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return `m${x.toString(36)}`;
}

/** Stable key for a TikTok or YouTube video link ("tiktok:<id>" / "youtube:<id>"); "" when unknown. */
export function sourceKey(url: string): string {
  const t = url.match(/tiktok\.com\/(?:@[^/?#]+\/)?(?:video|photo)\/(\d+)/);
  if (t) return `tiktok:${t[1]}`;
  const y = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return y ? `youtube:${y[1]}` : "";
}

/** The already-saved post for this source key, matching older posts by id or video link too. */
export function findDuplicate(list: Pick<PostT, "id" | "source" | "videoUrl" | "title">[], key: string) {
  if (!key) return undefined;
  const [kind, id] = key.split(":");
  return list.find((p) => p.source === key || (kind === "tiktok" && p.id === `tt-${id}`) || (kind === "youtube" && sourceKey(p.videoUrl) === key));
}

const POST_ID = /^[a-z0-9-]{3,64}$/;
const s = (v: unknown) => (typeof v === "string" ? v : "");
/** Fast, low-CPU version of Post.parse for data that was already validated when saved
 * (D1 rows / Redis cache). Fills the same defaults; returns null for unusable rows.
 * Why: Zod over hundreds of posts exceeds the Cloudflare free-plan CPU limit. */
export function fastPost(raw: unknown): PostT | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r["id"];
  const createdAt = r["createdAt"];
  if (typeof id !== "string" || !POST_ID.test(id)) return null;
  if (typeof createdAt !== "number" || !(createdAt >= 0)) return null;
  const ratio = r["ratio"];
  return {
    id, createdAt,
    title: s(r["title"]), text: s(r["text"]), videoUrl: s(r["videoUrl"]), imageUrl: s(r["imageUrl"]),
    category: s(r["category"]), source: s(r["source"]), mix: s(r["mix"]),
    ratio: typeof ratio === "number" && ratio >= 0 && ratio <= 10 ? ratio : 0,
    pinned: r["pinned"] === true,
    published: r["published"] !== false,
  } as PostT;
}
/** Fast list version of Posts.parse (skips bad rows instead of failing). */
export function fastPosts(raw: unknown): PostT[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PostT[] = [];
  for (const it of raw) { const p = fastPost(it); if (p) out.push(p); }
  return out;
}
