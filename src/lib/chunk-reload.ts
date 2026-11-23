// After a new deploy, page files from the previous build disappear. A tab (or a cached page)
// still pointing at them gets "Failed to fetch dynamically imported module": reload once to
// pick up the new build instead of leaving a blank screen.
const FLAG = "lg:chunk-reload";
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk \S+ failed/i;

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : (err as { message?: unknown }).message;
  return CHUNK_ERROR.test(String(msg ?? err));
}

/** Reloads the page at most once per short window; returns true when a reload was started. */
export function reloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(FLAG)) return false;
    sessionStorage.setItem(FLAG, "1");
  } catch { /* storage blocked: still reload */ }
  window.location.reload();
  return true;
}

export function installChunkReload() {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });
  window.addEventListener("unhandledrejection", (e) => { if (isChunkLoadError(e.reason)) reloadOnce(); });
  window.addEventListener("error", (e) => { if (isChunkLoadError(e.error ?? e.message)) reloadOnce(); });
  window.addEventListener("load", () => setTimeout(() => {
    try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
  }, 10_000));
}
