import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type Showcase = { heroOn: boolean; heroId: string; topIds: string[] };
const AUTO: Showcase = { heroOn: true, heroId: "", topIds: [] };

/** Owner's Home big box / Explore Top 10 picks. null while loading; falls back to automatic after 2.5s. */
export function useShowcase(): Showcase | null {
  const { settings } = useAuth();
  const [late, setLate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLate(true), 2500); return () => clearTimeout(t); }, []);
  if (settings) return { heroOn: settings.heroOn ?? true, heroId: settings.heroId ?? "", topIds: settings.topIds ?? [] };
  return late ? AUTO : null;
}
