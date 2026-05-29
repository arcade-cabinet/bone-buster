/**
 * STO1a — KV settings persistence via `@capacitor/preferences`.
 *
 * Why this facade exists:
 *   - On native (iOS/Android), Capacitor Preferences maps to
 *     NSUserDefaults / SharedPreferences (the platform-native KV
 *     store) — survives app restart, sandboxed per-app, no quota
 *     hassles.
 *   - On web, Capacitor Preferences's web implementation wraps
 *     `localStorage` under a `CapacitorStorage.` key namespace —
 *     same API surface, same persistence guarantees as the rest of
 *     the app's storage layer.
 *
 * App code MUST go through this module instead of touching
 * `localStorage` directly. The reason is twofold:
 *   1. The Capacitor abstraction handles the web ↔ native split
 *      transparently; calling `localStorage.setItem` from app code
 *      would work on web but silently no-op on native (Capacitor's
 *      native runtime doesn't ship a `Window.localStorage` that
 *      writes to disk reliably across cold starts).
 *   2. The API surface is async by design — even on web — so we
 *      get a uniform programming model and a single seam to swap
 *      backends later (e.g. for encrypted-at-rest preferences).
 *
 * For STRUCTURED data (run history rows), see the future STO1b
 * migration to `@capacitor-community/sqlite`. Preferences is for KV
 * configuration ONLY — settings, last-seen-difficulty, flags, etc.
 */

import { Preferences } from "@capacitor/preferences";

/**
 * Read a single key as a string. Returns `null` if the key is unset
 * or if the underlying store throws (e.g. quota exhaustion on web,
 * locked keychain on native).
 */
export async function readPref(key: string): Promise<string | null> {
	try {
		const { value } = await Preferences.get({ key });
		return value ?? null;
	} catch {
		return null;
	}
}

/**
 * Write a single key. Silently drops on failure — preferences are
 * "best effort persist"; the app must never gate gameplay on a
 * successful write.
 */
export async function writePref(key: string, value: string): Promise<void> {
	try {
		await Preferences.set({ key, value });
	} catch {
		// Quota / locked store / private-mode — accept the loss.
	}
}

/**
 * Remove a single key. Silently drops on failure.
 */
export async function removePref(key: string): Promise<void> {
	try {
		await Preferences.remove({ key });
	} catch {
		// Same rationale as writePref.
	}
}

/**
 * Read + parse a JSON-shaped key. Returns `null` if the key is
 * unset OR if the value fails JSON.parse (corrupt blob). Caller is
 * responsible for narrowing the unknown to the expected shape — use
 * a runtime validator (zod, custom guard) before trusting the value.
 */
export async function readJsonPref<T = unknown>(key: string): Promise<T | null> {
	const raw = await readPref(key);
	if (raw === null) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/**
 * Write a JSON-serializable value. Stringifies eagerly so any
 * circular-reference or BigInt failure surfaces here. M-7: a stringify
 * failure is NOT a Capacitor error (so nothing else would log it) — dev-log
 * it before swallowing, otherwise a non-serializable payload silently never
 * persists and the bug is invisible.
 */
export async function writeJsonPref<T>(key: string, value: T): Promise<void> {
	let raw: string;
	try {
		raw = JSON.stringify(value);
	} catch (err) {
		if (import.meta.env.DEV) {
			console.warn(`[bonebuster] writeJsonPref("${key}") — value not JSON-serializable:`, err);
		}
		return;
	}
	await writePref(key, raw);
}
