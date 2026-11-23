// YouTube-style home feed: category chips, 16:9 video grid, Shorts shelf and AdSense in-feed slots.
import { Link } from "@tanstack/react-router";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { PostTile } from "@/components/PostTile";
import { feedQuery } from "@/lib/posts-query";
import { postIsShort, useRatios } from "@/components/PostView";
import { ShortTile, ShortsGrid } from "@/components/Shorts";
import { AdSlot } from "@/components/AdSlot";
import { adPositions } from "@/lib/ads";
import { useAuth } from "@/hooks/useAuth";
import type { PostT } from "@/lib/posts";
import { useReveal } from "@/lib/infinite";
import { FeaturedHero, FeaturedHeroSkeleton, SectionHead, ShortsReel } from "@/components/Discover";
import { pickHero } from "@/lib/discover";
import { useShowcase } from "@/hooks/useShowcase";
import { feedPosts } from "@/lib/safe-data";

export function VideoGrid({ list, views }: { list: PostT[]; views: Record<string, { views?: number } | undefined> }) {
  const { settings } = useAuth();
  const adAt = new Set(adPositions(list.length, settings?.adFeedEvery ?? 8));
  const { shown, more, ref } = useReveal(list.length, list[0]?.id);
  return (
    <>
      <div className="grid grid-cols-1 gap-y-8 pb-6 sm:grid-cols-2 sm:gap-x-4 sm:px-4 lg:grid-cols-3 xl:grid-cols-4">
        {list.slice(0, shown).map((p, i) => (
          <Fragment key={p.id}>
            <PostTile post={p} views={views[p.id]?.views} />
            {adAt.has(i) && <AdSlot kind="feed" className="px-4 sm:px-0" />}
          </Fragment>
        ))}
      </div>
      {more && <div ref={ref} className="grid grid-cols-1 gap-y-8 pb-6 sm:grid-cols-2 sm:gap-x-4 sm:px-4 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((k) => <div key={k} className="aspect-video animate-pulse bg-secondary sm:rounded-xl" />)}
      </div>}
    </>
  );
}

export function VideoFeed({ c, children, footer }: { c?: string | undefined; children?: ReactNode; footer?: ReactNode }) {
  const feed = useSuspenseInfiniteQuery(feedQuery(c));
  const show = useShowcase();
  // Already mixed on the server; pages are joined in order.
  const data = feedPosts(feed.data);
  const more = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const el = more.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage(); }, { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data.length]);
  const ratios = useRatios(data.map((p) => p.videoUrl));
  const short = (p: PostT) => postIsShort(p, ratios);
  const stats = {};
  const cats = feed.data.pages[0]?.cats ?? [];
  const inCat = c && c !== "Shorts" && c !== "Videos" ? data.filter((p) => p.category === c) : data;
  const shorts = inCat.filter(short);
  const videos = inCat.filter((p) => !short(p));
  const chip = (on: boolean) => `shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-inverse text-inverse-foreground" : "bg-secondary hover:bg-accent"}`;
  const empty = (t: string) => <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t}</p>;
  const hero = !c && show?.heroOn ? pickHero(data, show.heroId) : undefined;
  const rest = hero ? inCat.filter((p) => p.id !== hero.id) : inCat;
  const restShorts = rest.filter(short);
  const restVideos = rest.filter((p) => !short(p));
  return (
    <>
      {hero ? <FeaturedHero post={hero} /> : !c && !show && data.length > 0 && <FeaturedHeroSkeleton />}
      <div className="scrollbar-none sticky top-14 z-20 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" search={{}} className={chip(!c)}>All</Link>
        <Link to="/" search={{ c: "Shorts" }} className={chip(c === "Shorts")}>Shorts</Link>
        <Link to="/" search={{ c: "Videos" }} className={chip(c === "Videos")}>Videos</Link>
        {cats.map((x) => <Link key={x} to="/" search={{ c: x }} className={chip(c === x)}>{x}</Link>)}
      </div>
      {inCat.length === 0 ? empty("Nothing posted here yet.")
        : c === "Shorts" ? (shorts.length
          ? <div className="grid grid-cols-2 gap-2 px-2 pb-6 sm:grid-cols-3 sm:px-4 lg:grid-cols-5 xl:grid-cols-6">{shorts.map((p) => <ShortTile key={p.id} post={p} className="w-full" />)}</div>
          : empty("No Shorts yet."))
        : c === "Videos" ? (videos.length ? <VideoGrid list={videos} views={stats} /> : empty("No videos yet."))
        : (
          <>
            <ShortsReel posts={restShorts.slice(0, 12)} sub="Swipe sideways for more" />
            {children}
            {restVideos.length > 0 && <SectionHead title="Latest videos" />}
            <VideoGrid list={restVideos.slice(0, 8)} views={stats} />
            <AdSlot kind="home" className="px-4 pb-6" />
            {restShorts.length > 12 && <ShortsGrid posts={restShorts.slice(12)} title="More" />}
            <VideoGrid list={restVideos.slice(8)} views={stats} />
          </>
        )}
      {hasNextPage && <div ref={more} aria-hidden className="grid grid-cols-1 gap-y-8 pb-6 sm:grid-cols-2 sm:gap-x-4 sm:px-4 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((k) => <div key={k} className="aspect-video animate-pulse bg-secondary sm:rounded-xl" />)}
      </div>}
      {feed.isFetchNextPageError && <button className="mx-auto mb-6 block rounded-full bg-secondary px-4 py-2 text-sm font-semibold" onClick={() => void fetchNextPage()}>Try again</button>}
      {!hasNextPage && footer}
    </>
  );
}
