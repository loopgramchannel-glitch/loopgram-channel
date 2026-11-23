import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { edgeKey } from "./lib/edge-cache";
import { BUILD_ID } from "./lib/build-id";
import { readEnv, syncWorkerEnv } from "./lib/worker-env";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Public pages that are identical for every visitor: shared edge cache absorbs traffic spikes.
const EDGE_CACHE: [RegExp, string][] = [
  [/^\/$/, "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400"],
  [/^\/shorts$/, "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400"],
  [/^\/(explore|search)$/, "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400"],
  [/^\/post\/[a-z0-9-]{3,64}$/, "public, max-age=0, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400"],
];
const IMMUTABLE = /^\/assets\/.+\.[a-f0-9]{6,}\.|^\/assets\//;

export function cachePolicy(req: Request, res: Response): string | null {
  if (req.method !== "GET" || res.status !== 200) return null;
  if (res.headers.has("cache-control") || res.headers.has("set-cookie")) return null;
  if (req.headers.get("authorization")) return null;
  const url = new URL(req.url);
  if (IMMUTABLE.test(url.pathname)) return "public, max-age=31536000, immutable";
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return null;
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;
  for (const [re, v] of EDGE_CACHE) if (re.test(url.pathname)) return v;
  return null;
}

function withCache(req: Request, res: Response): Response {
  const v = cachePolicy(req, res);
  if (!v) return res;
  const out = new Response(res.body, res);
  out.headers.set("cache-control", v);
  return out;
}

// Firebase sign-in pages served from our own domain (see auth-domain.ts).
async function proxyFirebaseAuth(request: Request, env: unknown): Promise<Response> {
  const e = env as Record<string, string | undefined> | undefined;
  const target = (e?.["FIREBASE_AUTH_DOMAIN"] || readEnv("FIREBASE_AUTH_DOMAIN")).trim();
  if (!target) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("host"); headers.delete("cookie");
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(`https://${target}${url.pathname}${url.search}`, {
    method: request.method, headers, body: hasBody ? request.body : null, redirect: "manual",
  });
}

// ---- Edge shield: Cloudflare Cache API in front of every shareable GET ----
type Ctx = { waitUntil?: (p: Promise<unknown>) => void } | undefined;
const STORED_AT = "x-edge-stored-at";
function edgeCache(): Cache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  return c ?? null;
}
function shareable(req: Request): boolean {
  if (req.method !== "GET" || req.headers.get("authorization")) return false;
  const p = new URL(req.url).pathname;
  return !p.startsWith("/studio") && !p.startsWith("/login") && !p.startsWith("/api/");
}
async function store(cache: Cache, key: Request, res: Response) {
  try {
    const { edgeDirectives } = await import("./lib/edge-cache");
    const d = edgeDirectives(res.headers.get("cache-control"));
    if (!d || res.status !== 200 || res.headers.has("set-cookie")) return;
    const body = await res.arrayBuffer();
    const copy = new Response(body, res);
    copy.headers.set(STORED_AT, String(Date.now()));
    // Cache API keeps the entry until s-maxage; we extend it so stale copies remain available.
    copy.headers.set("cache-control", `public, max-age=${d.sMaxAge + Math.max(d.swr, d.sie)}`);
    await cache.put(key, copy);
  } catch { /* cache problems must never count as a failed request */ }
}
async function shielded(req: Request, ctx: Ctx, origin: () => Promise<Response>): Promise<Response> {
  const cache = edgeCache();
  if (!cache || !shareable(req)) return origin();
  const key = new Request(edgeKey(req.url, BUILD_ID), { method: "GET" });
  const wait = (p: Promise<unknown>) => ctx?.waitUntil?.call(ctx, p.catch(() => {}));
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) {
    const { edgeDirectives, edgeState } = await import("./lib/edge-cache");
    const at = Number(hit.headers.get(STORED_AT) ?? 0);
    const d = edgeDirectives(hit.headers.get("x-edge-policy"));
    const state = d ? edgeState(at, d) : "expired";
    if (state !== "expired") {
      if (state === "stale") wait(origin().then((r) => store(cache, key, r)).catch(() => {}));
      return restore(hit, "HIT");
    }
    try {
      const fresh = await origin();
      if (fresh.status >= 500) return restore(hit, "STALE-ON-ERROR");
      wait(store(cache, key, fresh.clone()));
      return fresh;
    } catch { return restore(hit, "STALE-ON-ERROR"); }
  }
  const res = await origin();
  wait(store(cache, key, res.clone()));
  return res;
}
function restore(hit: Response, status: string): Response {
  const out = new Response(hit.body, hit);
  const policy = out.headers.get("x-edge-policy");
  if (policy) out.headers.set("cache-control", policy);
  out.headers.delete(STORED_AT); out.headers.delete("x-edge-policy");
  out.headers.set("x-edge-cache", status);
  return out;
}
function keepPolicy(res: Response): Response {
  const cc = res.headers.get("cache-control");
  if (!cc) return res;
  const out = new Response(res.body, res);
  out.headers.set("x-edge-policy", cc);
  return out;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      syncWorkerEnv(env);
      const { isFirebaseAuthPath } = await import("./lib/auth-domain");
      if (isFirebaseAuthPath(new URL(request.url).pathname)) return await proxyFirebaseAuth(request, env);
      const db = (env as { DB?: unknown } | undefined)?.DB;
      if (db) { const { setNativeD1 } = await import("./lib/backend.server"); setNativeD1(db); }
      const kv = (env as { KV?: unknown } | undefined)?.KV;
      if (kv) { const { setNativeKV } = await import("./lib/backend.server"); setNativeKV(kv); }
      const handler = await getServerEntry();
      const response = await shielded(request, ctx as Ctx, async () =>
        keepPolicy(withCache(request, await handler.fetch(request, env, ctx))));
      // Background jobs run via POST /api/public/jobs (cron), never on visitor requests (CPU limit).
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "worker_request_failed", path: new URL(request.url).pathname, message: error instanceof Error ? error.message : String(error) }));
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
