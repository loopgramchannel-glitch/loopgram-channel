// Studio → Home & Explore: owner picks the video in the Home big box and the Explore Top 10.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Search, Star, Trophy, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { studioOverview, studioSaveSettings, type SiteSettingsT } from "@/lib/studio.functions";
import { postsQuery } from "@/lib/posts-query";
import { PostThumb } from "@/components/PostView";
import { niceTitle } from "@/lib/discover";
import type { PostT } from "@/lib/posts";

function Box({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-4"><h2 className="font-bold">{title}</h2><p className="mb-3 text-xs text-muted-foreground">{sub}</p>{children}</section>;
}

function Thumb({ p }: { p: PostT }) {
  return <span className="block h-14 w-10 shrink-0 overflow-hidden rounded-md bg-secondary"><PostThumb post={p} className="h-full w-full !object-cover" /></span>;
}

export function ShowcasePanel() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const tok = async () => { const t = await getToken(); if (!t) throw new Error("Signed out"); return t; };
  const q = useQuery({ queryKey: ["studio", "overview"], queryFn: async () => studioOverview({ data: { token: await tok() } }) });
  const posts = useQuery(postsQuery);
  const [f, setF] = useState<SiteSettingsT | null>(null);
  const [find, setFind] = useState("");
  useEffect(() => { if (q.data && !f) setF(q.data.settings as SiteSettingsT); }, [q.data]);
  const m = useMutation({
    mutationFn: async () => studioSaveSettings({ data: { token: await tok(), settings: f! } }),
    onSuccess: () => { toast.success("Saved. Visitors see it on their next page load."); qc.invalidateQueries({ queryKey: ["studio"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message.replace(/^\d{3}:\s*/, "") : "Could not save"),
  });
  if (!f || !posts.data) return <p className="text-sm text-muted-foreground">{q.isError || posts.isError ? "Could not load." : "Loading…"}</p>;
  const all = posts.data;
  const byId = new Map(all.map((p) => [p.id, p]));
  const hero = f.heroId ? byId.get(f.heroId) : undefined;
  const top = f.topIds.map((id) => byId.get(id)).filter((p): p is PostT => !!p);
  const setTop = (ids: string[]) => setF({ ...f, topIds: ids.slice(0, 10) });
  const move = (i: number, d: -1 | 1) => { const ids = top.map((p) => p.id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j]!, ids[i]!]; setTop(ids); };
  const needle = find.trim().toLowerCase();
  const list = needle ? all.filter((p) => `${p.title} ${p.text}`.toLowerCase().includes(needle)) : all;
  const btn = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold hover:bg-accent disabled:opacity-40";

  return (
    <div className="max-w-2xl space-y-4">
      <Box title="Big box on Home" sub="The large video at the top of your Home page.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.heroOn} onChange={(e) => setF({ ...f, heroOn: e.target.checked })} /> Show the big box</label>
        <div className={`mt-3 flex items-center gap-3 rounded-lg bg-secondary p-2 ${f.heroOn ? "" : "opacity-50"}`}>
          {hero ? <><Thumb p={hero} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{niceTitle(hero, "Video")}</span>
            <button type="button" onClick={() => setF({ ...f, heroId: "" })} className={btn}><X className="h-3 w-3" />Use automatic</button></>
            : <span className="p-2 text-sm text-muted-foreground">Automatic — a different video every hour. Pick one below with <Star className="inline h-3.5 w-3.5" /> Big box.</span>}
        </div>
      </Box>

      <Box title="Top 10 on Explore" sub={`Your picks show first, in this order. Empty places fill automatically. ${top.length}/10 chosen.`}>
        {top.length === 0 ? <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Automatic — pick videos below with <Trophy className="inline h-3.5 w-3.5" /> Top 10.</p> : (
          <ol className="space-y-1.5">
            {top.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-secondary p-1.5">
                <span className="w-6 text-center text-lg font-black">{i + 1}</span><Thumb p={p} />
                <span className="min-w-0 flex-1 truncate text-sm">{niceTitle(p, "Video")}</span>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 hover:bg-accent disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Move down" disabled={i === top.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 hover:bg-accent disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label="Remove from Top 10" onClick={() => setTop(top.filter((x) => x.id !== p.id).map((x) => x.id))} className="rounded p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ol>
        )}
        {top.length > 0 && <button type="button" onClick={() => setTop([])} className={`${btn} mt-2`}>Clear — use automatic</button>}
      </Box>

      <button onClick={() => m.mutate()} disabled={m.isPending} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>

      <Box title="Your videos" sub="Choose which video goes in the big box or the Top 10, then press Save changes.">
        <label className="mb-3 flex items-center gap-2 rounded-lg border px-3"><Search className="h-4 w-4 text-muted-foreground" />
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a video" aria-label="Find a video" className="h-10 flex-1 bg-transparent text-sm outline-none" /></label>
        {list.length === 0 && <p className="text-sm text-muted-foreground">No videos found.</p>}
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {list.map((p) => {
            const isHero = f.heroId === p.id, inTop = f.topIds.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary">
                <Thumb p={p} /><span className="min-w-0 flex-1 truncate text-sm">{niceTitle(p, "Video")}</span>
                <button type="button" onClick={() => setF({ ...f, heroId: isHero ? "" : p.id, heroOn: true })} className={`${btn} ${isHero ? "bg-primary text-primary-foreground" : ""}`}><Star className="h-3 w-3" />Big box</button>
                <button type="button" disabled={!inTop && top.length >= 10} onClick={() => setTop(inTop ? top.filter((x) => x.id !== p.id).map((x) => x.id) : [...top.map((x) => x.id), p.id])} className={`${btn} ${inTop ? "bg-primary text-primary-foreground" : ""}`}><Trophy className="h-3 w-3" />{inTop ? "In Top 10" : "Top 10"}</button>
              </li>
            );
          })}
        </ul>
      </Box>
    </div>
  );
}
