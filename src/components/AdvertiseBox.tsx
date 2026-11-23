import { useState } from "react";
import { Briefcase, Check, Copy, Mail } from "lucide-react";
import { ADVERTISE_EMAIL, advertiseMailto } from "@/lib/advertise";

export function AdvertiseBox() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(ADVERTISE_EMAIL); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  return (
    <section aria-label="Advertise with LoopgramChannel" className="mx-2 mb-4 mt-2 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:mx-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Briefcase className="h-5 w-5 shrink-0" /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Advertise with us</p>
            <h2 className="text-base font-bold leading-tight sm:text-lg">Promote your business on LoopgramChannel</h2>
            <p className="mt-1 text-sm text-muted-foreground">Get your brand, products or music seen by our viewers. Email us for sponsored videos and promotions.</p>
            <p className="mt-1 break-all text-sm font-medium">{ADVERTISE_EMAIL}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a href={advertiseMailto()} className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:flex-none"><Mail className="h-4 w-4 shrink-0" />Email us</a>
          <button onClick={copy} className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm font-semibold hover:bg-accent md:flex-none">{copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}{copied ? "Copied" : "Copy email"}</button>
        </div>
      </div>
    </section>
  );
}
