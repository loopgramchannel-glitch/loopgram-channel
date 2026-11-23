// Pure helper: which page URLs to flush from Cloudflare when posts change (tested).
export const SITE_HOSTS = ["loopgramchannel.com", "www.loopgramchannel.com"];
const FEEDS = ["/", "/shorts", "/explore", "/search"];

/** Every URL a visitor may have cached for these posts: plain (CDN) and build-keyed (edge shield). */
export function purgeUrls(ids: string[], build: string, hosts = SITE_HOSTS): string[] {
  const paths = [...FEEDS, ...[...new Set(ids)].filter((id) => /^[a-z0-9-]{3,64}$/.test(id)).map((id) => `/post/${id}`)];
  const out: string[] = [];
  for (const h of hosts) for (const p of paths) {
    out.push(`https://${h}${p}`);
    out.push(`https://${h}${p}?__b=${encodeURIComponent(build)}`);
  }
  return out;
}

/** Cloudflare accepts at most 30 URLs per purge call. */
export function chunk<T>(list: T[], size = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
