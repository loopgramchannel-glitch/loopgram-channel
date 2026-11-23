// "For You" mix: posts are dealt in rounds, one video per group (original account, or 30-minute
// batch for phone uploads/older posts) per round, in a fresh random order each round, so the same
// account never plays twice in a row while another is left. Seeded hourly; pinned posts stay on top.
import type { PostT } from "./posts";

const BATCH_MS = 30 * 60 * 1000;

/** Which group a post belongs to: its hidden account key, else the 30-minute batch it was posted in. */
export function mixGroup(p: Pick<PostT, "createdAt" | "category"> & { mix?: string }): string {
  return p.mix ? `a${p.mix}` : `b${Math.floor(p.createdAt / BATCH_MS)}`;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function shuffle<X>(a: X[], r: () => number): X[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Same seed → same order on server and browser (no flicker); the seed changes every hour. */
export function hourSeed(now = Date.now()) { return Math.floor(now / 3_600_000); }

export function mixFeed<T extends Pick<PostT, "pinned" | "createdAt" | "category">>(list: T[], seed: number, group: (p: T) => string = mixGroup): T[] {
  if (!Array.isArray(list)) return [];
  const pinned = list.filter((p) => p.pinned);
  const r = rng(seed);
  const buckets = new Map<string, T[]>();
  for (const p of list) { if (p.pinned) continue; const k = group(p); (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(p); }
  // Each account's own videos in a random order too, so the round picks are not newest-first.
  const queues = [...buckets.entries()].map(([g, v]) => ({ g, v: shuffle([...v], r) }));
  const out: T[] = [];
  let last = "";
  for (;;) {
    const round = shuffle(queues.filter((q) => q.v.length), r);
    if (!round.length) break;
    // A new round never starts with the account that ended the previous one.
    if (round.length > 1 && round[0]!.g === last) { const k = 1 + Math.floor(r() * (round.length - 1)); [round[0], round[k]] = [round[k]!, round[0]!]; }
    for (const q of round) out.push(q.v.shift()!);
    last = round[round.length - 1]!.g;
  }
  return [...pinned, ...out];
}
