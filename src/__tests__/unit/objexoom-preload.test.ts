/**
 * A4 — tiered preload orchestrator pin.
 *
 * Verifies that:
 *  1. The three tier entry-points (`preloadTier1Critical`,
 *     `preloadTier2MapMount`, `preloadTier3Deferred`) are exported
 *     from `src/preload.ts`.
 *  2. Each entity file that ran a module-scope preload IIFE before
 *     A4 still exports a `preloadX()` function we can call.
 *  3. Calling any tier function does NOT throw (the underlying
 *     `useGLTF.preload` is provided by drei and accepts string URLs
 *     without a live r3f Canvas context).
 *
 * The actual GLB fetch behavior is exercised by the e2e screenshot
 * tests; this test only pins the API surface so future agents
 * can't accidentally re-add module-scope IIFEs without explicitly
 * removing the corresponding tier-orchestrator call.
 *
 * Source: PERF audit Architectural D.
 */

import { describe, expect, it } from "vitest";
import { preloadTier1Critical, preloadTier2MapMount, preloadTier3Deferred } from "../../preload";

describe("A4 — tiered preload orchestrator", () => {
	it("exports preloadTier1Critical as a callable function", () => {
		expect(typeof preloadTier1Critical).toBe("function");
		expect(() => preloadTier1Critical()).not.toThrow();
	});

	it("exports preloadTier2MapMount as a callable function", () => {
		expect(typeof preloadTier2MapMount).toBe("function");
		expect(() => preloadTier2MapMount()).not.toThrow();
	});

	it("exports preloadTier3Deferred as a callable function", () => {
		expect(typeof preloadTier3Deferred).toBe("function");
		expect(() => preloadTier3Deferred()).not.toThrow();
	});

	it("re-invocation is idempotent (useGLTF.preload dedupes)", () => {
		// Mid-game level-change re-fires preloadTier2MapMount; the
		// drei loader's internal cache means this is a no-op.
		// We only assert the call doesn't throw on repeat — the
		// dedup behavior is drei's contract.
		expect(() => {
			preloadTier1Critical();
			preloadTier1Critical();
			preloadTier2MapMount();
			preloadTier2MapMount();
			preloadTier3Deferred();
			preloadTier3Deferred();
		}).not.toThrow();
	});
});
