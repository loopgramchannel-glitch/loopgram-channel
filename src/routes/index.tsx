import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Page } from "@/components/lg";
import { VideoFeed } from "@/components/VideoFeed";
import { feedQuery } from "@/lib/posts-query";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { ContinueWatching } from "@/components/ContinueWatching";
import { siteJsonLd } from "@/lib/seo";
import { AdvertiseBox } from "@/components/AdvertiseBox";
import { feedPosts } from "@/lib/safe-data";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ c: z.string().max(40).optional() }),
  head: () => ({
    scripts: [{ type: "application/ld+json", children: JSON.stringify(siteJsonLd) }],
    links: [{ rel: "canonical", href: "https://loopgramchannel.com/" }],
    meta: [
      { property: "og:url", content: "https://loopgramchannel.com/" },
      { title: "LoopgramChannel — Trending Shorts, Viral Videos, Gaming & Music" },
      { name: "description", content: "Watch the hottest trending Shorts, viral creator clips, funny videos, music and gaming highlights on LoopgramChannel. Fast HD streaming, non-stop feed." },
      { property: "og:title", content: "LoopgramChannel — Trending Shorts, Viral Videos, Gaming & Music" },
      { property: "og:description", content: "Trending Shorts, viral clips, music and gaming — non-stop on LoopgramChannel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loaderDeps: ({ search }) => ({ c: search.c }),
  loader: async ({ context, deps }) => { await context.queryClient.ensureInfiniteQueryData(feedQuery(deps.c)); },
  component: Home,
});

function Home() {
  const { c } = Route.useSearch();
  const data = feedPosts(useSuspenseInfiniteQuery(feedQuery(c)).data);
  return (
    <Page>
      <h1 className="sr-only">LoopgramChannel videos</h1>
      <VideoFeed c={c} footer={<div className="pt-4"><AdvertiseBox /></div>}>
        <ContinueWatching posts={data} />
      </VideoFeed>
    </Page>
  );
}
