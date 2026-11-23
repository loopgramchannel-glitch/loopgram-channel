// Cloudflare hands keys to the Worker on `env`, while server code reads `process.env`.
// syncWorkerEnv() makes sure process.env exists and holds every text key, on every request,
// so a missing Node shim or an unpopulated process.env can never leave the site without its keys.
type ProcLike = { env?: Record<string, string | undefined> };
type G = { process?: ProcLike; __workerEnv?: Record<string, string> };

export function syncWorkerEnv(env: unknown, g: G = globalThis as unknown as G): number {
  if (!env || typeof env !== "object") return 0;
  let proc = g.process;
  if (!proc) { proc = { env: {} }; try { g.process = proc; } catch { /* read-only global */ } }
  if (!proc.env) { try { proc.env = {}; } catch { /* read-only */ } }
  const pe = proc.env ?? {};
  const keep: Record<string, string> = g.__workerEnv ?? {};
  let n = 0;
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    keep[k] = v;
    if (!pe[k]) { try { pe[k] = v; n++; } catch { /* frozen env: readEnv() still finds it */ } }
  }
  g.__workerEnv = keep;
  return n;
}

/** Reads a key from process.env, falling back to the Worker env captured by syncWorkerEnv(). */
export function readEnv(k: string, g: G = globalThis as unknown as G): string {
  return g.process?.env?.[k] || g.__workerEnv?.[k] || "";
}
