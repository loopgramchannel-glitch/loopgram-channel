// Home + Explore showcase pieces: featured spotlight, Shorts reel, Top 10 row, topic tiles, photo wall.
import { Link } from "@tanstack/react-router";
import { Play, ChevronRight } from "lucide-react";
import type { PostT } from "@/lib/posts";
import { PostThumb } from "@/components/PostView";
import { ShortTile } from "@/components/Shorts";
import { useReveal } from "@/lib/infinite";
import { niceTitle } from "@/lib/discover";

export function SectionHead({ title, sub, to }: { title: string; sub?: string; to?: "/shorts" }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold leading-tight sm:text-xl">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground sm:text-sm">{sub}</p>}
      </div>
      {to && <Link to={to} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-accent">See all<ChevronRight className="h-4 w-4" /></Link>}
    </div>
  );
}

/** Big spotlight card that opens Home: blurred backdrop, the picture shown whole, title and Watch now. */
export function FeaturedHero({ post }: { post: PostT }) {
  const title = niceTitle(post, "Today's featured video");
  return (
    <section aria-label="Featured video" className="px-2 pb-4 pt-1 sm:px-4">
      <Link to="/post/$id" params={{ id: post.id }} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-scrim shadow-elegant sm:aspect-[21/9]">
        {post.imageUrl && <img src={post.imageUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />}
        <PostThumb post={post} className="absolute inset-y-0 right-0 h-full w-full !bg-transparent transition-transform duration-500 group-hover:scale-[1.03] sm:w-3/5" />
        <div className="absolute inset-0 bg-hero-fade" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:max-w-xl sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-foreground" />Featured
          </span>
          <h2 className="mt-2 line-clamp-2 text-xl font-extrabold leading-tight text-scrim-foreground sm:text-3xl">{title}</h2>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-scrim-foreground px-4 py-2 text-sm font-bold text-scrim transition-transform group-hover:scale-105">
            <Play className="h-4 w-4 fill-current" />Watch now
          </span>
        </div>
      </Link>
    </section>
  );
}

/** Same size as the big box, shown for a moment while the owner's pick loads. */
export function FeaturedHeroSkeleton() {
  return <div aria-hidden className="px-2 pb-4 pt-1 sm:px-4"><div className="aspect-[4/3] animate-pulse rounded-2xl bg-secondary sm:aspect-[21/9]" /></div>;
}

/** Sideways, finger-scrollable row of Shorts with snap stops. */
export function ShortsReel({ posts, title = "Trending Shorts", sub }: { posts: PostT[]; title?: string; sub?: string }) {
  if (!posts.length) return null;
  return (
    <section className="pb-6">
      <SectionHead title={title} {...(sub ? { sub } : {})} to="/shorts" />
      <div className="scrollbar-none flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4">
        {posts.map((p) => <ShortTile key={p.id} post={p} className="w-[34vw] max-w-44 snap-start sm:w-40" />)}
      </div>
    </section>
  );
}

/** Numbered Top 10 row: big outlined rank beside each picture. */
export function TopTen({ posts }: { posts: PostT[] }) {
  if (!posts.length) return null;
  return (
    <section id="top" className="scroll-mt-16 pb-6">
      <SectionHead title="Top 10 right now" sub="The hottest picks right now" />
      <ol className="scrollbar-none flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-px-4 px-4">
        {posts.slice(0, 10).map((p, i) => (
          <li key={p.id} className="flex shrink-0 snap-start items-end">
            <span aria-hidden className="rank-outline -mr-3 select-none text-[5.5rem] font-black leading-[0.8] sm:text-[7rem]">{i + 1}</span>
            <Link to="/post/$id" params={{ id: p.id }} aria-label={`Number ${i + 1}: ${niceTitle(p, "Video")}`} className="group relative block w-24 overflow-hidden rounded-xl bg-scrim shadow-elegant sm:w-32">
              <PostThumb post={p} className="aspect-[9/16] w-full !object-cover transition-transform group-hover:scale-105" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TopTenSkeleton() {
  return (
    <div aria-hidden className="pb-6">
      <div className="mx-4 mb-3 h-6 w-40 animate-pulse rounded bg-secondary" />
      <div className="flex gap-4 overflow-hidden px-4">{[0, 1, 2, 3].map((k) => <div key={k} className="aspect-[9/16] w-24 shrink-0 animate-pulse rounded-xl bg-secondary sm:w-32" />)}</div>
    </div>
  );
}

export type Topic = { label: string; hint: string; icon: typeof Play; tone: 1 | 2 | 3 | 4 | 5; to: "/" | "/shorts" | "/explore" | "/search"; c?: string; hash?: string };

const TONE: Record<Topic["tone"], string> = {
  1: "bg-tone-1/12 text-tone-1",
  2: "bg-tone-2/12 text-tone-2",
  3: "bg-tone-3/12 text-tone-3",
  4: "bg-tone-4/12 text-tone-4",
  5: "bg-tone-5/12 text-tone-5",
};

export function TopicTiles({ topics }: { topics: Topic[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 pb-6 sm:grid-cols-3 lg:grid-cols-6">
      {topics.map(({ label, hint, icon: Icon, tone, to, c, hash }) => (
        <Link key={label} to={to} search={to === "/" ? (c ? { c } : {}) : {}} {...(hash ? { hash } : {})} className="group flex items-center gap-3 rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}><Icon className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{label}</span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Dense photo wall (3 across on phones), newest first; loads more as you scroll. */
export function PhotoWall({ posts }: { posts: PostT[] }) {
  const { shown, more, ref } = useReveal(posts.length, posts[0]?.id, 18);
  if (!posts.length) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 sm:gap-1.5 sm:px-4 md:grid-cols-4 lg:grid-cols-6">
        {posts.slice(0, shown).map((p) => (
          <Link key={p.id} to="/post/$id" params={{ id: p.id }} aria-label={niceTitle(p, "Video")} className="group relative block overflow-hidden bg-scrim sm:rounded-lg">
            <PostThumb post={p} className="aspect-[3/4] w-full !object-cover transition-transform group-hover:scale-105" />
            <Play className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-scrim-foreground text-scrim-foreground drop-shadow" />
          </Link>
        ))}
      </div>
      {more && <div ref={ref} className="grid grid-cols-3 gap-0.5 pt-0.5 sm:gap-1.5 sm:px-4 md:grid-cols-4 lg:grid-cols-6" aria-hidden>
        {[0, 1, 2].map((k) => <div key={k} className="aspect-[3/4] animate-pulse bg-secondary sm:rounded-lg" />)}
      </div>}
    </>
  );
}
