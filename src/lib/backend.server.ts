// Server-only clients: Cloudflare KV, Cloudflare D1, R2. Env read per call (Workers).
import { AwsClient } from "aws4fetch";
import { readEnv } from "./worker-env";

const env = readEnv;

// ---------- Cloudflare Workers KV (replaces Upstash Redis) ----------
// Same `redis([...])` call shape as before so callers stay unchanged; commands are mapped onto KV.
// Uses the native env.KV binding when present (in-network, sub-ms reads), else the KV REST API.
// Lists / sets / sorted sets are stored as JSON values (only low-traffic Studio data uses them).
// Circuit breaker (per isolate): after BREAK_AFTER consecutive failures, skip KV for BREAK_MS. Callers fail open.
const BREAK_AFTER = 3, BREAK_MS = 15_000;
let redisFails = 0, redisOpenUntil = 0;
export function redisCircuitOpen(now = Date.now()): boolean { return now < redisOpenUntil; }
export function redisRecord(ok: boolean, now = Date.now()): void {
  if (ok) { redisFails = 0; return; }
  if (++redisFails >= BREAK_AFTER) { redisOpenUntil = now + BREAK_MS; redisFails = 0; }
}
export function redisCircuitReset(): void { redisFails = 0; redisOpenUntil = 0; }

type NativeKV = { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void>; delete: (k: string) => Promise<void> };
let nativeKv: NativeKV | null = null;
export function setNativeKV(kv: unknown): void {
  const k = kv as NativeKV | undefined;
  if (k && typeof k.get === "function" && typeof k.put === "function") nativeKv = k;
}
export function kvNative(): boolean { return !!nativeKv; }
export function kvConfigured(): boolean {
  return !!nativeKv || !!(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_KV_NAMESPACE_ID") && env("CLOUDFLARE_GLOBAL_API_KEY") && env("CLOUDFLARE_EMAIL"));
}
function kvUrl(key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/storage/kv/namespaces/${env("CLOUDFLARE_KV_NAMESPACE_ID")}/values/${encodeURIComponent(key)}`;
}
const kvHeaders = () => ({ "X-Auth-Email": env("CLOUDFLARE_EMAIL") ?? "", "X-Auth-Key": env("CLOUDFLARE_GLOBAL_API_KEY") ?? "" });
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  if (!kvConfigured() || redisCircuitOpen()) throw new Error("KV unavailable");
  try { const v = await fn(); redisRecord(true); return v; } catch (e) { redisRecord(false); throw e; }
}
export async function kvGet(key: string): Promise<string | null> {
  return guard(async () => {
    if (nativeKv) return nativeKv.get(key);
    const r = await fetch(kvUrl(key), { headers: kvHeaders(), signal: AbortSignal.timeout(2500) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`KV get ${r.status}`);
    return r.text();
  });
}
export async function kvPut(key: string, value: string, ttlSec?: number): Promise<void> {
  const ttl = ttlSec ? Math.max(60, Math.floor(ttlSec)) : undefined; // KV minimum TTL is 60s
  return guard(async () => {
    if (nativeKv) return nativeKv.put(key, value, ttl ? { expirationTtl: ttl } : undefined);
    const r = await fetch(kvUrl(key) + (ttl ? `?expiration_ttl=${ttl}` : ""), { method: "PUT", headers: { ...kvHeaders(), "Content-Type": "text/plain" }, body: value, signal: AbortSignal.timeout(2500) });
    if (!r.ok) throw new Error(`KV put ${r.status}`);
  });
}
export async function kvDelete(key: string): Promise<void> {
  return guard(async () => {
    if (nativeKv) return nativeKv.delete(key);
    const r = await fetch(kvUrl(key), { method: "DELETE", headers: kvHeaders(), signal: AbortSignal.timeout(2500) });
    if (!r.ok && r.status !== 404) throw new Error(`KV delete ${r.status}`);
  });
}

// Structured values: { t: type, v: data, x: expiresAtMs? }
type Box = { t: "s" | "l" | "set" | "z"; v: unknown; x?: number };
async function readBox(key: string): Promise<Box | null> {
  const raw = await kvGet(key);
  if (raw == null) return null;
  try { const b = JSON.parse(raw) as Box; if (b && b.t) { if (b.x && b.x < Date.now()) return null; return b; } } catch { /* plain string */ }
  return { t: "s", v: raw };
}
async function writeBox(key: string, b: Box): Promise<void> {
  const ttl = b.x ? Math.ceil((b.x - Date.now()) / 1000) : undefined;
  await kvPut(key, b.t === "s" && !b.x ? String(b.v) : JSON.stringify(b), ttl);
}
const num = (v: string | number) => (v === "-inf" ? -Infinity : v === "+inf" ? Infinity : Number(v));

async function runCmd(cmd: (string | number)[]): Promise<unknown> {
  const op = String(cmd[0]).toUpperCase(), key = String(cmd[1] ?? "");
  switch (op) {
    case "PING": await kvGet("lg:ping"); return "PONG";
    case "GET": { const b = await readBox(key); return b && b.t === "s" ? String(b.v) : null; }
    case "SET": {
      const opts = cmd.slice(3).map(String);
      const ex = opts.findIndex((o) => o.toUpperCase() === "EX");
      const ttl = ex >= 0 ? Number(opts[ex + 1]) : undefined;
      if (opts.some((o) => o.toUpperCase() === "NX") && (await readBox(key))) return null;
      await writeBox(key, { t: "s", v: String(cmd[2]), ...(ttl ? { x: Date.now() + ttl * 1000 } : {}) });
      return "OK";
    }
    case "DEL": await kvDelete(key); return 1;
    case "INCRBY": {
      const b = await readBox(key);
      const n = Number(b?.v ?? 0) + Number(cmd[2]);
      await writeBox(key, { t: "s", v: String(n), ...(b?.x ? { x: b.x } : { x: Date.now() + 3600_000 }) });
      return n;
    }
    case "EXPIRE": {
      const b = await readBox(key); if (!b) return 0;
      if (cmd[3] && String(cmd[3]).toUpperCase() === "NX" && b.x && b.x < Date.now() + 3500_000) return 0;
      b.x = Date.now() + Number(cmd[2]) * 1000; await writeBox(key, b); return 1;
    }
    case "LPUSH": {
      const b = await readBox(key); const l = (b?.t === "l" ? (b.v as string[]) : []);
      l.unshift(...cmd.slice(2).map(String).reverse()); await writeBox(key, { t: "l", v: l }); return l.length;
    }
    case "LTRIM": {
      const b = await readBox(key); if (!b || b.t !== "l") return "OK";
      const l = b.v as string[]; const stop = Number(cmd[3]);
      await writeBox(key, { t: "l", v: l.slice(Number(cmd[2]), stop < 0 ? l.length + stop + 1 : stop + 1) }); return "OK";
    }
    case "LRANGE": {
      const b = await readBox(key); const l = b?.t === "l" ? (b.v as string[]) : [];
      const stop = Number(cmd[3]); return l.slice(Number(cmd[2]), stop < 0 ? l.length + stop + 1 : stop + 1);
    }
    case "LLEN": { const b = await readBox(key); return b?.t === "l" ? (b.v as string[]).length : 0; }
    case "SADD": case "SREM": {
      const b = await readBox(key); const s = new Set(b?.t === "set" ? (b.v as string[]) : []);
      for (const m of cmd.slice(2).map(String)) op === "SADD" ? s.add(m) : s.delete(m);
      await writeBox(key, { t: "set", v: [...s] }); return 1;
    }
    case "SMEMBERS": { const b = await readBox(key); return b?.t === "set" ? b.v : []; }
    case "ZADD": case "ZREM": case "ZREMRANGEBYSCORE": {
      const b = await readBox(key); const z = (b?.t === "z" ? (b.v as Record<string, number>) : {});
      if (op === "ZADD") for (let i = 2; i + 1 < cmd.length; i += 2) z[String(cmd[i + 1])] = Number(cmd[i]);
      else if (op === "ZREM") for (const m of cmd.slice(2)) delete z[String(m)];
      else { const lo = num(cmd[2]!), hi = num(cmd[3]!); for (const [m, s] of Object.entries(z)) if (s >= lo && s <= hi) delete z[m]; }
      await writeBox(key, { t: "z", v: z }); return 1;
    }
    case "ZCOUNT": case "ZRANGEBYSCORE": {
      const b = await readBox(key); const z = (b?.t === "z" ? (b.v as Record<string, number>) : {});
      const lo = num(cmd[2]!), hi = num(cmd[3]!);
      const hits = Object.entries(z).filter(([, s]) => s >= lo && s <= hi).sort((a, c) => a[1] - c[1]);
      if (op === "ZCOUNT") return hits.length;
      return cmd.slice(4).map(String).some((o) => o.toUpperCase() === "WITHSCORES") ? hits.flatMap(([m, s]) => [m, String(s)]) : hits.map(([m]) => m);
    }
    default: throw new Error(`Unsupported KV command ${op}`);
  }
}

/** Runs one command against KV. Fails open with null. */
export async function redis(cmd: (string | number)[]): Promise<unknown> {
  try { return await runCmd(cmd); } catch { return null; }
}

/** Several commands in order. Fails open with nulls. */
export async function redisPipeline(cmds: (string | number)[][]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const c of cmds) out.push(await redis(c));
  return out;
}

/** Like redisPipeline, but reports whether every command really ran. */
export async function redisPipelineChecked(cmds: (string | number)[][]): Promise<{ ok: boolean; out: unknown[] }> {
  if (!cmds.length) return { ok: false, out: [] };
  const out: unknown[] = []; let ok = true;
  for (const c of cmds) { try { out.push(await runCmd(c)); } catch { ok = false; out.push(null); } }
  return { ok, out };
}

/** Fixed-window rate limit in one round trip; fails open if Redis is down. */
// Local tally per isolate: Redis is synced every SYNC_EVERY requests (batched INCRBY) instead of on
// every request, removing a Redis round trip from most API calls. Global count stays accurate within SYNC_EVERY.
const SYNC_EVERY = 10;
const rl = new Map<string, { pending: number; known: number }>();
export async function rateLimit(ip: string, limit = 120, windowSec = 60): Promise<boolean> {
  const key = `rl:${ip}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  let e = rl.get(key);
  if (!e) {
    if (rl.size > 5000) rl.clear();
    e = { pending: 0, known: 0 };
    rl.set(key, e);
  }
  e.pending++;
  if (e.known + e.pending > limit) return false;
  // Near the limit, sync every request so cross-instance overshoot shrinks to in-flight requests only.
  const nearLimit = e.known + e.pending > limit - SYNC_EVERY;
  if (!nearLimit && e.pending < SYNC_EVERY && e.known + e.pending > 1) return true;
  const inc = e.pending;
  e.pending = 0;
  const [n] = await redisPipeline([["INCRBY", key, inc], ["EXPIRE", key, windowSec, "NX"]]);
  if (typeof n === "number") e.known = n;
  else e.known += inc;
  return typeof n !== "number" || n <= limit;
}

/** In-memory sliding-window limiter (per isolate). No network calls, so reads never depend on Redis. */
const sw = new Map<string, number[]>();
export function localRateLimit(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  if (sw.size > 10_000) sw.clear();
  const hits = (sw.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) { sw.set(key, hits); return false; }
  hits.push(now);
  sw.set(key, hits);
  return true;
}

// ---------- Cloudflare D1 (permanent database, HTTP API) ----------
export type D1Stmt = { sql: string; params?: (string | number | null)[] };
export type D1Result<T = Record<string, unknown>> = { results: T[]; meta: { changes?: number; rows_read?: number } };
// Native D1 binding (env.DB), captured per request in src/server.ts. In-process, no API rate limit.
type NativeStmt = { bind: (...a: unknown[]) => NativeStmt; all: () => Promise<{ results: unknown[]; meta: Record<string, number> }> };
type NativeD1 = { prepare: (sql: string) => NativeStmt; batch: (s: NativeStmt[]) => Promise<{ results: unknown[]; meta: Record<string, number> }[]> };
let nativeDb: NativeD1 | null = null;
export function setNativeD1(db: unknown): void {
  const d = db as NativeD1 | undefined;
  if (d && typeof d.prepare === "function" && typeof d.batch === "function") nativeDb = d;
}
export function d1Native(): boolean { return !!nativeDb; }
export function d1Configured(): boolean {
  return !!nativeDb || !!(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_D1_DATABASE_ID") && (env("CLOUDFLARE_D1_TOKEN") || (env("CLOUDFLARE_GLOBAL_API_KEY") && env("CLOUDFLARE_EMAIL"))));
}
function d1AuthHeaders(): Record<string, string> {
  const gk = env("CLOUDFLARE_GLOBAL_API_KEY"), em = env("CLOUDFLARE_EMAIL");
  if (gk && em) return { "X-Auth-Email": em, "X-Auth-Key": gk, "Content-Type": "application/json" };
  return { Authorization: `Bearer ${env("CLOUDFLARE_D1_TOKEN")}`, "Content-Type": "application/json" };
}
/** Runs statements in one round trip. Several statements run as one transaction (all or nothing). */
export async function d1Batch(stmts: D1Stmt[]): Promise<D1Result[]> {
  if (nativeDb) {
    const db = nativeDb;
    const prepared = stmts.map((s) => db.prepare(s.sql).bind(...(s.params ?? [])));
    const out = prepared.length === 1 ? [await prepared[0]!.all()] : await db.batch(prepared);
    return out.map((r) => ({ results: r.results as Record<string, unknown>[], meta: r.meta ?? {} }));
  }
  if (!d1Configured()) throw new Error("D1 not configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_D1_TOKEN)");
  const url = `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/d1/database/${env("CLOUDFLARE_D1_DATABASE_ID")}/query`;
  const body = stmts.length === 1 ? { sql: stmts[0]!.sql, params: stmts[0]!.params ?? [] } : { batch: stmts.map((s) => ({ sql: s.sql, params: s.params ?? [] })) };
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST", signal: AbortSignal.timeout(6000),
        headers: d1AuthHeaders(),
        body: JSON.stringify(body),
      });
      const t = await r.text();
      if (r.ok) {
        const j = JSON.parse(t) as { success: boolean; result: D1Result[]; errors?: { message: string }[] };
        if (j.success) return j.result;
        throw new Error(`D1 error: ${j.errors?.[0]?.message ?? "unknown"}`);
      }
      last = `D1 ${r.status}: ${t.slice(0, 300)}`;
      if (r.status < 500 && r.status !== 429) break; // permanent (bad SQL, constraint, permission)
    } catch (e) { last = String(e); if (/D1 error/.test(last)) break; }
    await new Promise((res) => setTimeout(res, 150 * 2 ** attempt));
  }
  throw new Error(last);
}
export async function d1<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): Promise<D1Result<T>> {
  return (await d1Batch([{ sql, params }]))[0] as D1Result<T>;
}
/** Per-isolate throttle for side jobs triggered by views : true at most once per window per key. */
const sideJobAt = new Map<string, number>();
export function onceEvery(key: string, ms: number): boolean {
  const now = Date.now();
  if (now - (sideJobAt.get(key) ?? 0) < ms) return false;
  if (sideJobAt.size > 5000) sideJobAt.clear();
  sideJobAt.set(key, now);
  return true;
}

// ---------- R2 ----------
function r2() {
  return new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    region: "auto", service: "s3",
  });
}
/** Checks an owner file in R2: does it exist, and what do its first bytes say it is. */
export async function r2Probe(key: string): Promise<{ exists: boolean; head: Uint8Array | null }> {
  const url = `${env("R2_ENDPOINT").replace(/\/$/, "")}/${env("R2_BUCKET_NAME")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const r = await r2().fetch(url, { headers: { Range: "bytes=0-63" }, signal: AbortSignal.timeout(5000) });
  if (r.status === 404) return { exists: false, head: null };
  if (!r.ok && r.status !== 206) throw new Error(`R2 probe ${r.status}`);
  return { exists: true, head: new Uint8Array(await r.arrayBuffer()) };
}

export function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
}
