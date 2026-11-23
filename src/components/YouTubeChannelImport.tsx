// Studio: bring many wide (16:9) videos from one YouTube channel. Shorts are left out automatically.
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Youtube } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { studioYouTubeChannelImport } from "@/lib/posts.functions";
import { YT_COUNTS } from "@/lib/youtube-channel";

export function YouTubeChannelImport({ onChange }: { onChange: () => void }) {
  const { getToken } = useAuth();
  const [channel, setChannel] = useState("");
  const [count, setCount] = useState<number>(50);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const token = await getToken(); if (!token) throw new Error("Not signed in");
      const r = await studioYouTubeChannelImport({ data: { token, channel: channel.trim(), count } });
      toast.success(r.added ? `Added ${r.added} wide YouTube videos` : "No new wide videos found");
      onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message.replace(/^\d{3}: /, "") : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><Youtube className="h-4 w-4 text-primary" />YouTube channel import</div>
      <p className="text-xs text-muted-foreground">Only wide (16:9) videos come in. Shorts are skipped, and videos already added are never doubled.</p>
      <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="youtube.com/@channelname" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        {YT_COUNTS.map((n) => (
          <button key={n} type="button" onClick={() => setCount(n)} className={`rounded-full border px-3 py-1 text-xs ${count === n ? "bg-primary text-primary-foreground" : ""}`}>{n}</button>
        ))}
        <button type="button" disabled={busy || !channel.trim()} onClick={go} className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Importing…</> : "Import"}
        </button>
      </div>
    </div>
  );
}
