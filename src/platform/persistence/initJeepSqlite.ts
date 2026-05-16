/**
 * STO1b — one-shot web-platform setup for @capacitor-community/sqlite.
 *
 * On web, the plugin delegates to jeep-sqlite (a custom-element-based
 * WASM SQLite shim that persists into IndexedDB). The setup sequence
 * is:
 *   1. Register the `<jeep-sqlite>` custom element (defineCustomElements).
 *   2. Append a `<jeep-sqlite>` instance to the document so the plugin
 *      can find it.
 *   3. Wait for the element to fire its ready event (or poll the
 *      customElements registry).
 *   4. Call `CapacitorSQLite.initWebStore()` to bring up the
 *      IndexedDB-backed persistence layer.
 *
 * Called once from `app/main.tsx` BEFORE React mounts. Native builds
 * skip every step — `Capacitor.getPlatform() === "ios" | "android"`
 * means the native plugin handles persistence and the jeep-sqlite
 * shim is irrelevant.
 *
 * Failure mode: any step throwing leaves the global `__bonebusterJeepSqliteReady`
 * flag as `false`. Consumers (`createDatabase`) read the flag and fall
 * back to `InMemoryDatabase` so the game still boots — the only loss
 * is run-history persistence on web until the next page reload.
 */

import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite } from "@capacitor-community/sqlite";

declare global {
	interface Window {
		__bonebusterJeepSqliteReady?: boolean;
	}
}

let initPromise: Promise<boolean> | null = null;

/**
 * Idempotent — multiple callers receive the same in-flight promise.
 * Resolves with `true` when jeep-sqlite + initWebStore are ready,
 * `false` if any step failed (caller falls back to InMemory).
 */
export function ensureJeepSqliteReady(): Promise<boolean> {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		if (typeof window === "undefined") return false;
		// Skip on native — the native plugin owns persistence.
		const platform = Capacitor.getPlatform();
		if (platform !== "web") {
			window.__bonebusterJeepSqliteReady = true;
			return true;
		}
		try {
			const { defineCustomElements } = await import("jeep-sqlite/loader");
			defineCustomElements(window);
			// Inject the element if it isn't already in the DOM. The
			// plugin discovers it via document.querySelector at runtime;
			// without it the initWebStore call hangs.
			// `wasmPath` attribute is REQUIRED — jeep-sqlite's default
			// `/assets` doesn't match this repo's wasm location at
			// `/assets/wasm/` (scripts/prepare-web-wasm.mjs copies the
			// sql.js WASM there at postinstall + prebuild). Setting the
			// attribute reroutes jeep-sqlite's internal locateFile to
			// our existing wasm directory; otherwise the WASM fetch
			// returns an HTML 404 page and the WebAssembly compile
			// fails with "expected magic word 00 61 73 6d, found
			// 3c 21 64 6f" (= "<!do" from the SPA 404 fallback).
			if (!document.querySelector("jeep-sqlite")) {
				const el = document.createElement("jeep-sqlite");
				el.setAttribute("wasmPath", "/assets/wasm");
				document.body.appendChild(el);
			}
			// customElements.whenDefined resolves once the constructor is
			// registered — gives jeep-sqlite a tick to wire up its
			// internal IndexedDB bridge before initWebStore runs.
			await customElements.whenDefined("jeep-sqlite");
			await CapacitorSQLite.initWebStore();
			window.__bonebusterJeepSqliteReady = true;
			return true;
		} catch (err) {
			console.warn("[STO1b] jeep-sqlite init failed; falling back to in-memory:", err);
			window.__bonebusterJeepSqliteReady = false;
			return false;
		}
	})();
	return initPromise;
}

/**
 * Synchronous read of the readiness flag. Returns `false` before
 * `ensureJeepSqliteReady()` has resolved; use the async function
 * itself for true wait-for-ready semantics.
 */
export function isJeepSqliteReady(): boolean {
	if (typeof window === "undefined") return false;
	return Boolean(window.__bonebusterJeepSqliteReady);
}
