// Small envelope button in the top bar: opens a little box with the channel email.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, X } from "lucide-react";
import { ADVERTISE_EMAIL } from "@/lib/advertise";

export function EmailButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const copy = async () => { try { await navigator.clipboard.writeText(ADVERTISE_EMAIL); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };
  return (
    <div ref={box} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} aria-label="Email us" aria-expanded={open} title="Email us" className="inline-flex shrink-0 items-center rounded-full p-1.5 hover:bg-accent sm:p-2">
        <Mail className="h-5 w-5 shrink-0" />
      </button>
      {open && (
        <div role="dialog" aria-label="Email us" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border bg-card p-3 text-card-foreground shadow-xl">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Mail className="h-4 w-4" /></span>
            <p className="flex-1 text-sm font-bold">Email us</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-2 break-all rounded-lg bg-secondary px-3 py-2 text-sm font-medium">{ADVERTISE_EMAIL}</p>
          <div className="mt-2 flex gap-2">
            <a href={`mailto:${ADVERTISE_EMAIL}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Mail className="h-3.5 w-3.5" />Send email</a>
            <button onClick={copy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-semibold hover:bg-accent">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
