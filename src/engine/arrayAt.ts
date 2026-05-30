/**
 * Indexed access that documents a proven in-bounds invariant: returns the
 * element, or throws loudly if the index is out of range. Use only where the
 * index is structurally guaranteed (loop body `i < length`, post-empty-check
 * `[0]`, `Math.floor(rng()*len)` with rng∈[0,1)). The throw never fires in
 * correct code — it converts a silent `undefined` into a diagnosable crash.
 *
 * CR-H1eng — extracted from engine.ts so the decomposed engine submodules
 * (gridGen / collision / sectors / spawn) share the one guard instead of
 * each redeclaring it.
 */
export function at<T>(a: readonly T[], i: number): T {
	const v = a[i];
	if (v === undefined) throw new RangeError(`index ${i} of ${a.length}`);
	return v;
}

/**
 * Bounds-checked array WRITE — the write twin of `at`. Assigns `a[i] = v` only
 * when `i` is in range, else throws (a raw `a[i] = v` on an out-of-range index
 * silently grows the array / punches a sparse hole). Use for grid-cell writes
 * where the column index is proven in-bounds by construction but the compiler
 * can't see it (`noUncheckedIndexedAccess` types the slot `T | undefined`).
 */
export function setAt<T>(a: T[], i: number, v: T): void {
	if (i < 0 || i >= a.length) throw new RangeError(`write index ${i} of ${a.length}`);
	a[i] = v;
}
