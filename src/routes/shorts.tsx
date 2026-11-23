import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clapperboard } from "lucide-react";
import { Page } from "@/components/lg";
import { postIsShort, useRatios } from "@/components/PostView";
import { ShortTile, ShortsMark } from "@/components/Shorts";
import { postsQuery } from "@/lib/posts-query";
import { hourSeed, mixFeed } from "@/lib/feed-mix";

export const Route = createFileRoute("/shorts")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://loopgramchannel.com/shorts" }],
    meta: [
      { property: "og:url", content: "https://loopgramchannel.com/shorts" },
      { title: "Trending Shorts — LoopgramChannel" },
      { name: "description", content: "Browse viral, funny and trending Shorts on LoopgramChannel — new clips every hour." },
      { property: "og:title", content: "Trending Shorts — LoopgramChannel" },
      { property: "og:description", content: "Browse viral, funny and trending Shorts on LoopgramChannel — new clips every hour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: ShortsPage,
});

function ShortsPage() {
  const { data } = useSuspenseQuery(postsQuery);
  const ratios = useRatios(data.map((p) => p.videoUrl));
  const shorts = mixFeed(data, hourSeed()).filter((p) => postIsShort(p, ratios));
  if (!shorts.length) {
    return (
      <Page>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-primary shadow-glow"><Clapperboard className="h-9 w-9 text-primary-foreground" /></div>
          <h1 className="text-2xl font-bold">No Shorts yet</h1>
          <p className="text-sm text-muted-foreground">Vertical videos will show up here as soon as they're posted.</p>
          <Link to="/" className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground">Browse videos</Link>
        </div>
      </Page>
    );
  }
  return (
    <Page>
      <section className="py-3">
        <h1 className="flex items-center gap-2 px-4 text-lg font-bold"><ShortsMark />Shorts</h1>
        <div className="mt-2 grid grid-cols-2 gap-2 px-2 pb-6 sm:grid-cols-3 sm:px-4 lg:grid-cols-5 xl:grid-cols-6">
          {shorts.map((p) => <ShortTile key={p.id} post={p} className="w-full" />)}
        </div>
      </section>
    </Page>
  );
}
