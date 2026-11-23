import { shareLink } from "@/lib/share";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Share2 } from "lucide-react";
import { PostThumb, PostVideo, postIsShort, useRatios } from "@/components/PostView";
import { ShortsPlayer } from "@/components/Shorts";
import { parseVideoSource } from "@/lib/video-source";
import { AdSlot } from "@/components/AdSlot";
import { PostTile } from "@/components/PostTile";
import { LinkedText } from "@/components/LinkedText";
import { postQuery, postsQuery, timeAgo } from "@/lib/posts-query";
import { nextUp, postShareMeta, shareUrlAt } from "@/lib/growth";
import { playerTime } from "@/lib/watch-history";
import { abs, videoJsonLd } from "@/lib/seo";
import { hourSeed, mixFeed } from "@/lib/feed-mix";
import { UpNextOverlay } from "@/components/UpNextOverlay";

export const Route = createFileRoute("/post/$id")({
  head: ({ loaderData, params }) => ({
    meta: postShareMeta(loaderData?.[1] ?? null).length > 1 ? postShareMeta(loaderData?.[1]) : [
      { title: "Watch — LoopgramChannel" },
      { name: "description", content: "Watch this LoopgramChannel video, then keep going with up-next videos." },
      { property: "og:title", content: "Watch — LoopgramChannel" },
      { property: "og:description", content: "Watch this LoopgramChannel video and more up next." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: abs(`/post/${params.id}`) }],
    scripts: (() => { const ld = videoJsonLd(loaderData?.[1]); return ld ? [{ type: "application/ld+json", children: JSON.stringify(ld) }] : []; })(),
  }),
  loader: ({ context, params }) => {
    // Instant open: the tapped video is already in the feed list, so show it now and recheck the database in the background.
    const qc = context.queryClient;
    const list = qc.getQueryData(postsQuery.queryKey);
    const hit = list?.find((p) => p.id === params.id);
    if (list && hit) {
      if (!qc.getQueryData(postQuery(params.id).queryKey)) qc.setQueryData(postQuery(params.id).queryKey, hit, { updatedAt: 0 });
      return [list, qc.getQueryData(postQuery(params.id).queryKey) ?? hit] as const;
    }
    return Promise.all([qc.ensureQueryData(postsQuery), qc.ensureQueryData(postQuery(params.id))]);
  },
  component: PostWatch,
});

function PostWatch() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(postsQuery);
  // Authoritative check: the post comes from its own database row, not the cached list.
  const { data: post } = useSuspenseQuery(postQuery(id));
  const [more, setMore] = useState(false);
  const [ended, setEnded] = useState(false);
  const [atTime, setAtTime] = useState(false);
  useEffect(() => { setMore(false); setEnded(false); setAtTime(false); window.scrollTo(0, 0); }, [id]);
  const ratios = useRatios(data.map((p) => p.videoUrl).concat(post?.videoUrl ? [post.videoUrl] : []));
  // Decide the player once, before any video starts, so it never swaps players mid-play (the 1-second restart bug).
  const shape = useRef<{ id: string; short: boolean } | null>(null);
  const frozen = useRef<{ id: string; list: NonNullable<typeof post>[] } | null>(null);
  const known = !!post && (!post.videoUrl || !!post.ratio || parseVideoSource(post.videoUrl).embed !== null && !!parseVideoSource(post.videoUrl).embed || ratios[post.videoUrl] !== undefined);
  if (post && known && shape.current?.id !== id) shape.current = { id, short: postIsShort(post, ratios) };
  const isShort = !!post && shape.current?.id === id && shape.current.short;

  if (!post) return <div className="p-8 text-center"><p className="mb-3">This video isn't available.</p><Link to="/" className="text-primary">Browse videos</Link></div>;
  const upNext = data.filter((p) => p.id !== id && !(postIsShort(p, ratios)));
  const share = () => {
    const base = `${location.origin}/post/${post.id}`;
    const t = atTime && playerTime.id === post.id ? playerTime.t : 0;
    shareLink({ title: post.title, text: `Watch ${post.title || "this"} on LoopgramChannel`, url: shareUrlAt(base, t) });
  };
  const next = nextUp(upNext);
  if (shape.current?.id !== id) return <div className="relative h-[60vh] w-full overflow-hidden bg-black"><PostThumb post={post} fill className="h-full w-full" /></div>;
  // Vertical (9:16) videos open full screen like TikTok; swipe or arrows move between Shorts.
  if (isShort) {
    // Freeze the Shorts list once per opened video: later shape checks must never reorder the feed mid-play.
    if (frozen.current?.id !== id) {
      // Same mixed order as the feed (one video per account per round): the tapped Short stays in its place and the player starts there.
      const shorts = mixFeed(data, hourSeed()).filter((p) => p.id === id || postIsShort(p, ratios));
      frozen.current = { id, list: shorts.some((p) => p.id === id) ? shorts : [post, ...shorts] };
    }
    const list = frozen.current.list;
    const shareShort = async (p: typeof post) => {
      shareLink({ title: p.title, text: `Watch ${p.title || "this"} on LoopgramChannel`, url: `${location.origin}/post/${p.id}` });
    };
    return <ShortsPlayer shorts={list} startId={id} onShare={(p) => { void shareShort(p); }} />;
  }
  const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent";
  const isFile = post.videoUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(post.videoUrl);
  const srcInfo = post.videoUrl ? parseVideoSource(post.videoUrl) : null;
  const ext = srcInfo && srcInfo.embed ? srcInfo : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 lg:flex-row lg:px-6 lg:pt-4">
      <div className="contents lg:block lg:min-w-0 lg:flex-1">
        {/* Sticky player: stays pinned under the header while the page scrolls (mobile), like YouTube. */}
        <div className="bg-background">
          {post.videoUrl ? <PostVideo url={post.videoUrl} id={post.id} onEnded={() => setEnded(true)} />
            : post.imageUrl ? <img src={post.imageUrl} alt={post.title} className="max-h-[70vh] w-full object-contain sm:rounded-xl" /> : null}
        </div>
        <div className="px-3 pt-3 lg:px-0">
          {ended && next && <UpNextOverlay key={id} next={next} onCancel={() => setEnded(false)} />}
          <h1 className="text-lg font-bold leading-snug sm:text-xl">{post.title || "Video"}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="scrollbar-none -mx-3 flex w-full gap-2 overflow-x-auto px-3 sm:mx-0 sm:ml-auto sm:w-auto sm:px-0">
              <button onClick={() => { share() }} className={pill}><Share2 className="h-4 w-4" />Share</button>
              <label className={`${pill} cursor-pointer`}><input type="checkbox" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} className="accent-primary" />Share at current time</label>
              {isFile && <a href={post.videoUrl} download className={pill}><Download className="h-4 w-4" />Download</a>}
              {ext && <a href={post.videoUrl} target="_blank" rel="noopener noreferrer" className={pill}><ExternalLink className="h-4 w-4" />Open on {ext.label}</a>}
            </div>
          </div>
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMore((m) => !m); } }} onClick={() => setMore((m) => !m)} className="mt-3 block w-full cursor-pointer rounded-xl bg-secondary p-3 text-left text-sm hover:bg-accent/70">
            <p className="font-semibold" suppressHydrationWarning>{timeAgo(post.createdAt)}{post.category ? ` · #${post.category}` : ""}</p>
            {post.text && <p className={`mt-1 whitespace-pre-line ${more ? "" : "line-clamp-2"}`}><LinkedText text={post.text} /></p>}
            {post.text && post.text.length > 120 && <span className="mt-1 inline-block font-semibold">{more ? "Show less" : "...more"}</span>}
          </div>
          <AdSlot kind="watch" className="mt-4" />
        </div>
      </div>
      <aside className="px-3 pb-6 lg:w-[400px] lg:shrink-0 lg:px-0">
        <AdSlot kind="detail" className="mb-4" />
        <h2 className="mb-2 font-bold">Up next</h2>
        <div className="space-y-2">{upNext.length ? upNext.map((p) => <PostTile key={p.id} post={p} compact />) : <p className="text-sm text-muted-foreground">No other videos yet.</p>}</div>
      </aside>
    </div>
  );
}
