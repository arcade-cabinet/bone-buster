/**
 * CR-F6 — URL-flag parsing extracted from Shell.tsx into pure, testable
 * functions. These are the ONLY external-input boundary in the whole app
 * (the security review's note), so the parse rules are pinned by unit
 * tests in bonebuster-urlFlags.test.ts.
 *
 * R8b — URL parameter migration. The post-rebrand canonical names are
 * `bonebusterSeed` / `bonebusterArchetype` / `bonebusterDebug`; the legacy
 * `objexoom*` names are accepted as fallbacks so existing bookmarks + e2e
 * harness URLs keep working. The new param wins when both are present.
 *
 * The `*FromHref` functions are pure (take an href string); the `*FromUrl`
 * wrappers read `window.location.href` and are the only window-coupled bit.
 */

/**
 * Parse the base seed from an href, or null if absent/invalid. Accepts ONLY
 * a non-negative decimal integer string (`/^[0-9]+$/`) — rejects negatives,
 * hex (`0xff`), scientific (`1e9`), NaN, empty — then masks to unsigned
 * 32-bit. A rejected/absent seed returns null so the caller can fall back.
 */
export function parseSeedFromHref(href: string): number | null {
	let raw: string | null;
	try {
		const url = new URL(href);
		raw = url.searchParams.get("bonebusterSeed") ?? url.searchParams.get("objexoomSeed");
	} catch {
		return null;
	}
	if (raw && /^[0-9]+$/.test(raw)) {
		return Number.parseInt(raw, 10) & 0xffffffff;
	}
	return null;
}

/** Parse the archetype override from an href, or null if absent/unparseable. */
export function parseArchetypeFromHref(href: string): string | null {
	try {
		const url = new URL(href);
		return url.searchParams.get("bonebusterArchetype") ?? url.searchParams.get("objexoomArchetype");
	} catch {
		return null;
	}
}

/**
 * Whether the debug-hook flag is present in an href. Pure form; the caller
 * is responsible for the production-build gate (see `debugHooksEnabled`).
 */
export function hasDebugFlagInHref(href: string): boolean {
	try {
		const params = new URL(href).searchParams;
		return params.has("bonebusterDebug") || params.has("objexoomDebug");
	} catch {
		return false;
	}
}

// --- window-coupled wrappers (the only bits that read global location) ---

/** Base seed from the live URL, falling back to a wall-clock seed. */
export function readBaseSeedFromUrl(): number {
	if (typeof window === "undefined") return Date.now() & 0xffffffff;
	return parseSeedFromHref(window.location.href) ?? Date.now() & 0xffffffff;
}

/** Archetype override from the live URL, or null. */
export function readArchetypeFromUrl(): string | null {
	if (typeof window === "undefined") return null;
	return parseArchetypeFromHref(window.location.href);
}

/**
 * SEED2 — the map seed PHRASE from the live URL. `?bonebusterSeed=<value>`
 * is used directly as the phrase (legacy numeric values are accepted as a
 * phrase string — they hash the same way via cyrb128). When absent, returns
 * null so the caller mints a phrase (SEED3: from the event PRNG / New Game
 * modal; for now a deterministic default keeps the harness stable).
 */
export function readSeedPhraseFromUrl(): string | null {
	if (typeof window === "undefined") return null;
	try {
		const url = new URL(window.location.href);
		const raw = url.searchParams.get("bonebusterSeed") ?? url.searchParams.get("objexoomSeed");
		return raw && raw.length > 0 ? raw : null;
	} catch {
		return null;
	}
}

/**
 * Debug hooks are installed ONLY in non-production builds AND only when the
 * flag is present — so the `window.__bonebuster` cheat surface can never
 * leak into a shipped build regardless of URL.
 */
export function debugHooksEnabled(): boolean {
	if (typeof window === "undefined") return false;
	if (process.env.NODE_ENV === "production") return false;
	return hasDebugFlagInHref(window.location.href);
}

/**
 * VIS-AUTO — capture mode. When the debug flag is present we enable the WebGL
 * `preserveDrawingBuffer` so the e2e harness can read the painted canvas back
 * (via `drawImage(canvas)` for the scene-ready luminance poll, and so CDP
 * captures are frame-stable). Unlike `debugHooksEnabled`, this is NOT gated on
 * NODE_ENV — the post-deploy Pages smoke test runs the PRODUCTION build with
 * `?bonebusterDebug` and still needs a readable buffer. `preserveDrawingBuffer`
 * is not a cheat surface, so exposing it on the flagged URL is safe; it carries
 * a small per-frame cost, hence it stays OFF for normal play (no flag).
 */
export function captureModeEnabled(): boolean {
	if (typeof window === "undefined") return false;
	return hasDebugFlagInHref(window.location.href);
}
