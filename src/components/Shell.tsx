import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { InstallButton } from "./InstallButton";
import { EmailButton } from "./EmailButton";
import { InstallBanner } from "./InstallBanner";
import { LogIn, LogOut, Clapperboard, Home, Search, UserCircle2, Menu, Compass, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AdSlot } from "./AdSlot";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shorts", label: "Shorts", icon: Clapperboard },
  { to: "/explore", label: "Explore", icon: Compass },
] as const;
const MORE: readonly { to: "/explore"; label: string; icon: typeof Compass }[] = [];

export function Shell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const auth = useAuth();
  const onSearch = useRouterState({ select: (s) => s.location.pathname === "/search" });
  const [offline, setOffline] = useState(false);
  const [wide, setWide] = useState(true);
  // Data saver was removed: clear the old switch so no phone stays in no-animation mode.
  useEffect(() => { document.documentElement.classList.remove("lite"); }, []);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    on(); addEventListener("online", on); addEventListener("offline", on);
    if ("serviceWorker" in navigator) {
      const h = location.hostname;
      const blocked = !import.meta.env.PROD || window.self !== window.top || /^(id-)?preview--/.test(h) || /(^|\.)lovableproject(-dev)?\.com$/.test(h) || /(^|\.)beta\.lovable\.dev$/.test(h) || new URLSearchParams(location.search).get("sw") === "off";
      if (blocked) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.active?.scriptURL.endsWith("/sw.js") && r.unregister())).catch(() => {});
      else navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => { removeEventListener("online", on); removeEventListener("offline", on); };
  }, []);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 bg-background px-2 sm:gap-4 sm:px-4">
        <button onClick={() => setWide((w) => !w)} aria-label="Toggle menu" className="hidden rounded-full p-2 hover:bg-secondary md:inline-flex"><Menu className="h-6 w-6" /></button>
        <Link to="/" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-base font-bold tracking-tighter min-[400px]:text-lg" aria-label="LoopgramChannel home">
          <img src="/icon.svg" alt="" className="h-6 w-6 shrink-0 min-[400px]:h-7 min-[400px]:w-7" /><span>LoopgramChannel</span>
        </Link>
        {onSearch ? <div className="flex-1" /> : <Link to="/search" search={{ q: "" }} aria-label="Search" className="mx-auto hidden h-10 min-w-0 max-w-[640px] flex-1 items-center overflow-hidden rounded-full border border-input text-muted-foreground hover:border-ring sm:flex">
          <span className="flex-1 truncate px-4 text-base">Search</span>
          <span className="flex h-full w-16 items-center justify-center border-l border-input bg-secondary"><Search className="h-5 w-5 text-foreground" /></span>
        </Link>}
        {!onSearch && <Link to="/search" search={{ q: "" }} aria-label="Search" className="ml-auto shrink-0 rounded-full p-1.5 hover:bg-secondary sm:hidden"><Search className="h-5 w-5 shrink-0" /></Link>}
        <div className="flex shrink-0 items-center gap-0 sm:gap-1">
          <InstallButton />
          <EmailButton />
          {!auth.user && (
            <Link to="/login" aria-label="Sign in" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary p-1.5 sm:px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"><UserCircle2 className="h-5 w-5 shrink-0" /><span className="hidden sm:inline">Sign in</span></Link>
          )}
          {auth.user && auth.role === "owner" && (
            <Link to="/studio" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary p-1.5 text-sm font-medium hover:bg-accent sm:px-3" aria-label="Open Studio" title="Create"><Plus className="h-5 w-5 shrink-0" /><span className="hidden sm:inline">Create</span></Link>
          )}
          {auth.user && (
            <button onClick={async () => { await qc.cancelQueries(); await auth.signOut(); nav({ to: "/", replace: true }); }} className="shrink-0 rounded-full p-1.5 hover:bg-secondary sm:p-2" aria-label={`Sign out ${auth.user.email ?? ""}`} title="Sign out"><LogOut className="h-5 w-5 shrink-0" /></button>
          )}
        </div>
      </header>
      <div className="flex">
        <nav className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col overflow-y-auto px-1 pt-1 md:flex ${wide ? "xl:w-60 xl:px-3" : ""} w-[72px]`} aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`flex w-16 flex-col items-center gap-1 rounded-lg py-4 text-[10px] hover:bg-secondary ${wide ? "xl:w-full xl:flex-row xl:gap-6 xl:px-3 xl:py-2.5 xl:text-sm" : ""}`} activeProps={{ className: "font-medium xl:bg-secondary" }} activeOptions={{ exact: n.to === "/" }}>
              <n.icon className="h-6 w-6 shrink-0" />{n.label}
            </Link>
          ))}
          {wide && <div className="hidden xl:block">
            <hr className="my-3 border-border" />
            <p className="px-3 pb-1 font-medium">Explore</p>
            {MORE.map((n) => (
              <Link key={n.label} to={n.to} className="flex w-full items-center gap-6 rounded-lg px-3 py-2.5 text-sm hover:bg-secondary"><n.icon className="h-6 w-6" />{n.label}</Link>
            ))}
            <hr className="my-3 border-border" />
            <p className="px-3 text-xs text-muted-foreground">© 2026 LoopgramChannel</p>
          </div>}
          <AdSlot kind="sidebar" label={false} className="mt-auto hidden w-52 pb-3 xl:block" />
        </nav>
        <main className="min-w-0 flex-1">
          {offline && <p className="bg-secondary px-4 py-2 text-center text-xs">You're offline. Showing saved content where available.</p>}
          {children}
        </main>
      </div>
      <InstallBanner />
      <footer className="mt-8">
        <div aria-hidden className="md:hidden" style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }} />
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background md:hidden" aria-label="Main mobile" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground" activeProps={{ className: "!text-foreground font-medium" }} activeOptions={{ exact: n.to === "/" }}>
            <n.icon className="h-5 w-5 shrink-0" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
