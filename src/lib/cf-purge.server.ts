// Flushes changed pages from Cloudflare's cache right after a Studio publish/edit/delete.
// Only called from owner-verified Studio functions. Failures never block the save (pages expire in 5 min anyway).
import { BUILD_ID } from "./build-id";
import { chunk, purgeUrls } from "./cf-purge";
import { readEnv } from "./worker-env";

export async function purgePostPages(ids: string[]): Promise<{ purged: number; failed: number }> {
  const zone = readEnv("CLOUDFLARE_ZONE_ID"), email = readEnv("CLOUDFLARE_EMAIL"), key = readEnv("CLOUDFLARE_GLOBAL_API_KEY");
  if (!zone || !email || !key) return { purged: 0, failed: 0 };
  let purged = 0, failed = 0;
  for (const files of chunk(purgeUrls(ids.slice(0, 200), BUILD_ID))) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
        method: "POST",
        headers: { "X-Auth-Email": email, "X-Auth-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(5000),
      });
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; errors?: { message?: string }[] };
      if (r.ok && j.success) purged += files.length;
      else { failed += files.length; console.error(JSON.stringify({ level: "error", event: "cf_purge_failed", status: r.status, error: j.errors?.[0]?.message ?? "" })); }
    } catch (e) { failed += files.length; console.error(JSON.stringify({ level: "error", event: "cf_purge_failed", error: String(e).slice(0, 200) })); }
  }
  return { purged, failed };
}
