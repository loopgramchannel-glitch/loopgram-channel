// Browser-safe Google SEO helpers: absolute URLs, sitemap XML and JSON-LD.
import type { PostT } from "./posts";
import { parseVideoSource } from "./video-source";

export const SITE_URL = "https://loopgramchannel.com";
export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const httpsOnly = (u?: string) => (u && /^https:\/\//i.test(u) ? u : "");

export const STATIC_PATHS = ["/", "/shorts", "/explore"];

export function postThumb(p: Pick<PostT, "imageUrl" | "videoUrl">): string {
  return httpsOnly(p.imageUrl) || httpsOnly(p.videoUrl ? parseVideoSource(p.videoUrl).thumb : undefined);
}

/** sitemap.xml with video extensions; published posts only. */
export function sitemapXml(posts: PostT[]): string {
  const live = posts.filter((p) => p.published);
  const statics = STATIC_PATHS.map((p) => `<url><loc>${esc(abs(p))}</loc></url>`);
  const items = live.map((p) => {
    const thumb = postThumb(p);
    const title = p.title || "LoopgramChannel video";
    const desc = (p.text || title).replace(/\s+/g, " ").slice(0, 2000);
    const video = thumb
      ? `<video:video><video:thumbnail_loc>${esc(thumb)}</video:thumbnail_loc><video:title>${esc(title.slice(0, 100))}</video:title><video:description>${esc(desc)}</video:description>${
          p.videoUrl ? `<video:player_loc>${esc(abs(`/post/${p.id}`))}</video:player_loc>` : ""
        }<video:publication_date>${new Date(p.createdAt).toISOString()}</video:publication_date></video:video>`
      : "";
    return `<url><loc>${esc(abs(`/post/${p.id}`))}</loc><lastmod>${new Date(p.createdAt).toISOString()}</lastmod>${video}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${[...statics, ...items].join("")}</urlset>`;
}

/** schema.org VideoObject for one watch page (null when Google's required thumbnail is missing). */
export function videoJsonLd(p: PostT | null | undefined) {
  if (!p) return null;
  const thumb = postThumb(p);
  if (!thumb) return null;
  const name = p.title || "LoopgramChannel video";
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    description: (p.text || name).replace(/\s+/g, " ").slice(0, 500),
    thumbnailUrl: [thumb],
    uploadDate: new Date(p.createdAt).toISOString(),
    url: abs(`/post/${p.id}`),
    embedUrl: abs(`/post/${p.id}`),
    ...(httpsOnly(p.videoUrl) && /\.(mp4|m3u8)(\?|$)/i.test(p.videoUrl) ? { contentUrl: p.videoUrl } : {}),
    publisher: { "@type": "Organization", name: "LoopgramChannel", logo: { "@type": "ImageObject", url: abs("/icon-512.png") } },
  };
}

export const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LoopgramChannel",
  url: abs("/"),
  potentialAction: { "@type": "SearchAction", target: `${abs("/search")}?q={search_term_string}`, "query-input": "required name=search_term_string" },
};
