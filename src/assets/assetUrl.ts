/**
 * BASE_URL-aware asset URL resolver. Wraps every static asset path so
 * GitHub-Pages base prefixes (`/objexoom/`) and Capacitor `file://`
 * origins both resolve correctly.
 *
 * Usage: `A("/assets/models/foo.glb")` → `"/objexoom/assets/models/foo.glb"`
 * in prod-pages, `"/assets/models/foo.glb"` in dev.
 *
 * Originally local to `models.ts`; promoted here when `runHistory.ts`
 * needed the same prefix for the sql.js WASM URL.
 */

export const A = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
