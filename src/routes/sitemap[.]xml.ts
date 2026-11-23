import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { readPosts } = await import("@/lib/posts.functions");
        const posts = await readPosts().catch(() => []);
        return new Response(sitemapXml(posts), {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" },
        });
      },
    },
  },
});
