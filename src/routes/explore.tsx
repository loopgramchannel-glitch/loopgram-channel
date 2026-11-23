import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Flame, Gamepad2, Music2, Newspaper, Film, Mic, Trophy, Sparkles, Clapperboard, Clock, Search } from "lucide-react";
import { Page } from "@/components/lg";
import { PhotoWall, SectionHead, TopTen, TopTenSkeleton, TopicTiles, type Topic } from "@/components/Discover";
import { pickTopTen } from "@/lib/discover";
import { useShowcase } from "@/hooks/useShowcase";
import { hourSeed, mixFeed } from "@/lib/feed-mix";
import { postsQuery } from "@/lib/posts-query";
import { AdSlot } from "@/components/AdSlot";

export const Route = createFileRoute("/explore")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://loopgramchannel.com/explore" }],
    meta: [
      { property: "og:url", content: "https://loopgramchannel.com/explore" },
      { title: "Explore Trending Videos — LoopgramChannel" },
      { name: "description", content: "Trending videos and categories on LoopgramChannel: music, gaming, news and more." },
      { property: "og:title", content: "Explore Trending Videos — LoopgramChannel" },
      { property: "og:description", content: "Trending videos and categories on LoopgramChannel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: Explore,
});

const ICONS: Record<string, typeof Flame> = { music: Music2, gaming: Gamepad2, news: Newspaper, movies: Film, podcasts: Mic, sports: Trophy };

function Explore() {
  const { data } = useSuspenseQuery(postsQuery);
  const show = useShowcase();
  const cats = [...new Set(data.map((p) => p.category).filter(Boolean))];
  // A different hourly shuffle than Home, so Explore never mirrors the Home feed.
  const auto = mixFeed(data, hourSeed() + 7919);
  const top = show ? pickTopTen(data, show.topIds, auto) : [];
  const newest = [...data].sort((a, b) => b.createdAt - a.createdAt);
  const topics: Topic[] = [
    { label: "Top 10", hint: "Hot this hour", icon: Flame, tone: 3, to: "/explore", hash: "top" },
    { label: "Shorts", hint: "Swipe & watch", icon: Sparkles, tone: 1, to: "/shorts" },
    { label: "Videos", hint: "Full-length", icon: Clapperboard, tone: 2, to: "/", c: "Videos" },
    { label: "New", hint: "Just posted", icon: Clock, tone: 4, to: "/explore", hash: "new" },
    ...cats.map((c, i): Topic => ({ label: c, hint: "Category", icon: ICONS[c.toLowerCase()] ?? Sparkles, tone: (((i + 4) % 5) + 1) as Topic["tone"], to: "/", c })),
  ];
  return (
    <Page>
      <header className="px-4 pb-5 pt-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Discover</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Explore</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find something new to watch.</p>
        <Link to="/search" className="mt-4 flex items-center gap-3 rounded-full border bg-card px-4 py-3 text-sm text-muted-foreground shadow-elegant transition-colors hover:bg-accent">
          <Search className="h-4 w-4 shrink-0" />Search videos
        </Link>
      </header>
      <TopicTiles topics={topics} />
      {data.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Nothing posted yet.</p> : <>
        {show ? <TopTen posts={top} /> : <TopTenSkeleton />}
        <AdSlot kind="home" className="px-4 pb-6" />
        <section id="new" className="scroll-mt-16 pb-6">
          <SectionHead title="Just posted" sub="The newest uploads first" />
          <PhotoWall posts={newest} />
        </section>
      </>}
    </Page>
  );
}
