// Pure helpers for the Studio YouTube channel import (browser + server safe).
export const YT_COUNTS = [50, 100, 200, 500] as const;
export const YT_MAX = 500;

/** "@name", "youtube.com/@name", "/channel/UC…" or a bare "UC…" id → API lookup; null when unreadable. */
export function channelQuery(raw: string): { forHandle: string } | { id: string } | null {
  const s = raw.trim();
  if (!s) return null;
  const id = s.match(/(?:^|\/channel\/)(UC[A-Za-z0-9_-]{22})/);
  if (id) return { id: id[1]! };
  const h = s.match(/(?:youtube\.com\/)?@([A-Za-z0-9._-]{3,100})/) ?? s.match(/^([A-Za-z0-9._-]{3,100})$/);
  return h ? { forHandle: `@${h[1]}` } : null;
}

/** Channel id "UC…" → its long-videos-only playlist "UULF…" (YouTube leaves Shorts and lives out of it). */
export function longVideosPlaylist(channelId: string): string {
  return "UULF" + channelId.slice(2);
}

/** Post id for a YouTube video: ids are case-sensitive, post ids are lowercase, so hex-encode. */
export function ytPostId(videoId: string): string {
  return "yt-" + [...videoId].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

/** ISO 8601 duration ("PT1H2M3S") → seconds. */
export function isoSeconds(d: string): number {
  const m = d.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0));
}

/** Wide (16:9) only: anything 3 minutes or shorter could be a Short, so it is left out. */
export const isWideVideo = (seconds: number) => seconds > 180;
