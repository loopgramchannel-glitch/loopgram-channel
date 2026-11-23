// YouTube-Shorts style pieces: vertical 9:16 cards and the full-screen vertical player.
import { LinkedText } from "@/components/LinkedText";
import { attachSource } from "@/lib/hls-attach";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent as RTouchEvent } from "react";
import { AdSlot, useAdsAllowed } from "@/components/AdSlot";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ChevronLeft, ChevronRight, Home, Pause, Play, Share2, Volume2, VolumeX, X } from "lucide-react";
import type { PostT } from "@/lib/posts";
import { PostThumb, setCapturePaused, withAutoplay } from "@/components/PostView";
import { parseVideoSource } from "@/lib/video-source";
import { dragOffset, releaseStep } from "@/lib/swipe";
import { niceTitle } from "@/lib/discover";

export function ShortsMark({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground ${className}`}><Play className="h-2.5 w-2.5 fill-current" />Shorts</span>;
}

export function ShortTile({ post, className = "w-40 sm:w-48" }: { post: PostT; className?: string }) {
  const title = niceTitle(post, "");
  return (
    <Link to="/post/$id" params={{ id: post.id }} aria-label={title || "Short"} className={`group relative block shrink-0 overflow-hidden rounded-xl bg-black ${className}`}>
      <PostThumb post={post} fill className="aspect-[9/16] w-full transition-transform group-hover:scale-[1.03]" />
      {title && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-10">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{title}</h3>
      </div>}
    </Link>
  );
}

/** YouTube-style Shorts shelf: a small fixed grid (4 on phones, 6 on big screens), never a sideways scroller.
 *  "View all" opens the full vertical Shorts grid. */
export function ShortsShelf({ posts }: { posts: PostT[] }) {
  if (!posts.length) return null;
  return (
    <section className="py-3">
      <div className="flex items-center justify-between px-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShortsMark />Shorts</h2>
        <Link to="/" search={{ c: "Shorts" }} className="rounded-full px-3 py-1 text-sm font-semibold text-primary hover:bg-accent">View all</Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 px-2 sm:grid-cols-4 sm:px-4 lg:grid-cols-6">
        {posts.slice(0, 6).map((p, i) => <ShortTile key={p.id} post={p} className={`w-full ${i >= 4 ? "hidden lg:block" : ""}`} />)}
      </div>
    </section>
  );
}

/** Full Shorts section for the "All" tab: every Short, YouTube-style 9:16 grid with a heading. */
export function ShortsGrid({ posts, title = "Shorts" }: { posts: PostT[]; title?: string }) {
  if (!posts.length) return null;
  return (
    <section className="py-3">
      <h2 className="flex items-center gap-2 px-4 text-lg font-bold"><ShortsMark />{title}</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 px-2 pb-6 sm:grid-cols-3 sm:px-4 lg:grid-cols-5 xl:grid-cols-6">
        {posts.map((p) => <ShortTile key={p.id} post={p} className="w-full" />)}
      </div>
    </section>
  );
}

/** Full-screen player: one video at a time, switched with Next / Previous buttons (no vertical feed). */
type Slide = PostT | { ad: string };
const isAd = (x: Slide): x is { ad: string } => "ad" in x;

export function ShortsPlayer({ shorts: posts, startId, onShare }: { shorts: PostT[]; startId: string; onShare: (p: PostT) => void }) {
    const start = Math.max(0, posts.findIndex((p) => p.id === startId));
  const adsOn = useAdsAllowed("shorts");
  const { settings } = useAuth();
  const every = Math.max(1, settings?.adShortsEvery ?? 5);
  // Ad slides only go after the opened Short, so the starting position never shifts when ads switch on.
  const [cycles, setCycles] = useState(1);
  const base = useMemo<Slide[]>(() => {
    if (!adsOn) return posts;
    const out: Slide[] = [];
    posts.forEach((p, i) => { out.push(p); if (i >= start && (i - start + 1) % every === 0 && i < posts.length - 1) out.push({ ad: `ad-${i}` }); });
    return out;
  }, [posts, adsOn, every, start]);
  // Endless feed like YouTube: the list repeats as the viewer nears the end.
  const shorts = useMemo(() => {
    const out: { s: Slide; key: string }[] = [];
    for (let c = 0; c < cycles; c++) base.forEach((x) => out.push({ s: x, key: `${isAd(x) ? x.ad : x.id}-${c}` }));
    return out;
  }, [base, cycles]);
  const [active, setActive] = useState(start);
  useEffect(() => { if (base.length && active >= shorts.length - 3) setCycles((c) => c + 1); }, [active, shorts.length, base.length]);
  const [muted, setMuted] = useState(false);
  const navigate = useNavigate();
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    setCapturePaused(true); // stop background thumbnail work while watching
    return () => { document.body.style.overflow = ""; setCapturePaused(false); };
  }, []);
  // TikTok-style reel: the current Short follows the finger, the next/previous cover peeks in,
  // and on release it glides to the next video or springs back. Only the centre panel plays video.
  const trackRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const setY = (px: number, ms = 0) => {
    const el = trackRef.current; if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none";
    el.style.transform = `translate3d(0, ${px}px, 0)`;
  };
  const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const slide = (step: number) => {
    if (busy.current || !step) return;
    const target = activeRef.current + step;
    if (target < 0 || target >= shorts.length) { setY(0, 240); return; }
    busy.current = true;
    // TikTok: the old video's sound stops the instant the swipe commits — never two sounds at once.
    trackRef.current?.querySelectorAll("video").forEach((v) => { v.pause(); v.muted = true; });
    const h = trackRef.current?.clientHeight || window.innerHeight;
    const ms = reduced() ? 0 : 320;
    setY(-Math.sign(step) * h, ms);
    window.setTimeout(() => setActive(target), ms);
  };
  // New Short is in the centre panel: snap the track back before the browser paints.
  useLayoutEffect(() => { setY(0); busy.current = false; }, [active]);
  const goTo = (i: number) => slide(Math.min(shorts.length - 1, Math.max(0, i)) - activeRef.current);

  const touch = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null } | null>(null);
  const onTouchStart = (e: RTouchEvent) => {
    const t = e.touches[0];
    touch.current = t && !busy.current ? { x: t.clientX, y: t.clientY, t: Date.now(), axis: null } : null;
  };
  const onTouchMove = (e: RTouchEvent) => {
    const s = touch.current, t = e.touches[0]; if (!s || !t) return;
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.axis) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return; s.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x"; }
    if (s.axis !== "y") return;
    setY(dragOffset(dy, activeRef.current > 0, activeRef.current < shorts.length - 1));
  };
  const onTouchEnd = (e: RTouchEvent) => {
    const s = touch.current, t = e.changedTouches[0]; touch.current = null;
    if (!s || !t || s.axis !== "y") return;
    const step = releaseStep(t.clientX - s.x, t.clientY - s.y, Date.now() - s.t, trackRef.current?.clientHeight || window.innerHeight);
    if (step) slide(step); else setY(0, 240);
  };
  const onTouchCancel = () => { if (touch.current?.axis === "y") setY(0, 240); touch.current = null; };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); slide(1); } if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); slide(-1); } if (e.key === "Escape") navigate({ to: "/" }); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const navBtn = "grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-30";

  // Same element tree for all three panels, keyed by Short: when the next Short moves into the centre,
  // React keeps its <video> — already loaded and paused on frame 0:00 — and simply presses play.
  const panel = (idx: number, offset: -1 | 0 | 1) => {
    const item = shorts[idx]; if (!item) return null;
    const style = { transform: `translate3d(0, ${offset * 100}%, 0)` };
    const centre = offset === 0;
    return (
      <div key={item.key} aria-hidden={!centre || undefined} style={style} className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
        {isAd(item.s) ? (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950">
            {centre && <div className="w-full max-w-md px-2"><AdSlot kind="shorts" label={false} className="w-full" /></div>}
            <span className="absolute left-3 top-16 z-10 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[11px] font-bold text-black">Ad · Sponsored</span>
          </div>
        ) : (
          <ShortSlide post={item.s} active={centre} muted={muted} setMuted={setMuted} onShare={() => onShare(item.s as PostT)} />
        )}
      </div>
    );
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchCancel}
      className="fixed inset-0 z-[60] touch-none select-none overflow-hidden overscroll-none bg-black">
      <div ref={trackRef} className="absolute inset-0 will-change-transform">
        {panel(active - 1, -1)}
        {panel(active, 0)}
        {panel(active + 1, 1)}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link to="/" aria-label="Back to videos" className="flex h-11 items-center gap-1 rounded-full bg-black/50 pl-2 pr-4 text-sm font-semibold text-white hover:bg-black/70"><ArrowLeft className="h-6 w-6" />Back</Link>
          <Link to="/" aria-label="Home" className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"><Home className="h-5 w-5" /></Link>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white">{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</button>
          <Link to="/" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"><X className="h-6 w-6" /></Link>
        </div>
      </div>

      <button disabled={active === 0} onClick={() => goTo(active - 1)} aria-label="Previous video" className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 sm:left-6 ${navBtn}`}><ChevronLeft className="h-8 w-8" /></button>
      <button disabled={active >= shorts.length - 1} onClick={() => goTo(active + 1)} aria-label="Next video" className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 sm:right-6 ${navBtn}`}><ChevronRight className="h-8 w-8" /></button>
    </div>
  );
}

function ShortSlide({ post, active, muted, setMuted, onShare }: { post: PostT; active: boolean; muted: boolean; setMuted: (m: boolean) => void; onShare: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false); // a real video frame is on screen
  const activeRef = useRef(active);
  activeRef.current = active;
  const [more, setMore] = useState(false);
  const src = parseVideoSource(post.videoUrl);

  useEffect(() => {
    const v = ref.current; if (!v || src.embed) return;
    // TikTok: the Shorts above and below load in the background, so the swipe shows the real frame 0:00 — no thumbnail, no black.
    v.preload = "auto";
    const first = () => { if (v.paused) { try { v.currentTime = 0.001; } catch { /* not seekable yet */ } } };
    // Some phones (iPhone) only draw a frame after play() — play silently for an instant, then park on 0:00.
    const prime = () => {
      if (activeRef.current) return;
      v.muted = true;
      v.play().then(() => { if (!activeRef.current) { v.pause(); try { v.currentTime = 0; } catch { /* ignore */ } } }).catch(() => { /* autoplay blocked: frame shows once the user swipes */ });
    };
    v.addEventListener("loadedmetadata", first, { once: true });
    v.addEventListener("loadeddata", prime, { once: true });
    const detach = attachSource(v, post.videoUrl);
    // Free the decoder once this Short is no longer next to the screen.
    return () => { detach(); v.removeEventListener("loadeddata", prime); v.pause(); v.removeAttribute("src"); v.load(); };
  }, [post.videoUrl, src.embed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (!active) { v.pause(); v.muted = true; setPaused(false); try { v.currentTime = 0; } catch { /* ignore */ } return; }
    try { if (v.currentTime > 0.5) v.currentTime = 0; } catch { /* ignore */ }
    setPaused(false);
    v.muted = muted;
    let gone = false;
    const start = () => {
      if (gone) return;
      if (!v.currentSrc && !v.src) return; // source not set yet — "canplay" will call us again
      // Only one video may ever play: stop every other one first.
      document.querySelectorAll("video").forEach((o) => { if (o !== v && !o.paused) o.pause(); });
      v.play().catch((e: unknown) => {
        if (gone || (e as Error)?.name === "AbortError") return;
        v.muted = true; setMuted(true);
        v.play().catch(() => { if (!gone) setPaused(true); });
      });
    };
    start();
    v.addEventListener("canplay", start, { once: true });
    return () => { gone = true; v.removeEventListener("canplay", start); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.muted = active ? muted : true; }, [muted, active]);

  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); } };
  const rail = "flex flex-col items-center gap-1 text-xs font-medium text-white";
  const btn = "grid h-12 w-12 place-items-center rounded-full bg-white/15 hover:bg-white/25";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {src.embed ? (
        active ? <iframe src={withAutoplay(src.embed)} title={post.title || "Short"} className="absolute inset-0 h-full w-full border-0" allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share" referrerPolicy="strict-origin-when-cross-origin" />
          : <PostThumb post={post} className="absolute inset-0 h-full w-full" />
      ) : (
        <>
          <video ref={ref} playsInline loop preload="auto" draggable={false} muted
            onClick={toggle} onLoadedData={() => setReady(true)} onPlaying={() => setReady(true)} className="absolute inset-0 h-full w-full bg-black object-contain" />
          {/* Only if the video has no frame yet (very first open, slow network): a thin TikTok-style loading bar, never the thumbnail. */}
          {active && !ready && <div role="progressbar" aria-label="Loading video" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 overflow-hidden bg-white/10"><div className="h-full w-1/3 animate-[shortsload_1s_ease-in-out_infinite] bg-white/80" /></div>}
        </>
      )}
      {paused && !src.embed && <button onClick={toggle} aria-label="Play" className="absolute inset-0 grid place-items-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-black/50 text-white"><Play className="ml-1 h-10 w-10 fill-current" /></span></button>}

      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4 sm:bottom-6">
        <button onClick={onShare} className={rail}><span className={btn}><Share2 className="h-6 w-6" /></span>Share</button>
        {!src.embed && <button onClick={toggle} className={rail}><span className={btn}>{paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}</span>{paused ? "Play" : "Pause"}</button>}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pr-20 pt-16">
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setMore((m) => !m); }} onClick={() => setMore((m) => !m)} className="pointer-events-auto block cursor-pointer text-left text-sm text-white">
          <span className="font-semibold">{post.title || "Short"}</span>
          {post.text && <span className={`mt-1 block whitespace-pre-line text-white/85 ${more ? "max-h-[40vh] overflow-y-auto" : "line-clamp-2"}`}><LinkedText text={post.text} /></span>}
        </div>
      </div>
    </div>
  );
}
