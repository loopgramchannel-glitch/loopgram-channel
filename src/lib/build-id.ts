declare const __BUILD_ID__: string | undefined;

/** Changes on every build (set in vite.config.ts); "dev" in tests. */
export const BUILD_ID: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
