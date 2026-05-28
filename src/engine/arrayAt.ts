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
