import { useGLTF } from "@react-three/drei";
import { groupByUrl, InstancedMultiGltfField } from "@scene/render/InstancedField";
import { isTrapVisible, type TrapInstance } from "@world/scatter/trapScatter";
import { TRAPS } from "@world/traps";
import { useMemo } from "react";

/**
 * COV8 step-2 — trap scatter renderer.
 *
 * PT1 — migrated from per-trap `<primitive>` mounts to grouped
 * InstancedMultiGltfField. Trap GLBs (spikes, blades, pressure-plates)
 * are static-static with no per-frame animation; one InstancedMesh per
 * (url, sub-mesh) drops the per-trap draw cost from N×subMeshes to
 * subMeshes per url.
 *
 * Visibility model: traps whose `disarmed` flag flipped are filtered
 * out of the per-batch instance list unless they're trigger-kind
 * (pressure plates stay visible after activation as a tell). The
 * `disarmedVersion` prop forces a re-memo whenever Scene mutates
 * trapsRef + bumps the version counter — without that signal, the
 * disarm visibility update would wait for the next ambient React
 * render (a latent bug in the pre-PT1 path that this slice also
 * fixes).
 */
const MAX_PER_BATCH = 32;

export function TrapField({
	traps,
	disarmedVersion: _disarmedVersion,
}: {
	traps: readonly TrapInstance[];
	/**
	 * Bumped by Scene on every sector-disarm so this component re-renders
	 * (the disarmed flag is mutated in place on the same `traps` array,
	 * so without the version-as-prop signal the filter wouldn't re-run).
	 * The value itself is unused — only the prop change matters.
	 */
	disarmedVersion: number;
}) {
	// Recomputed every render; the disarmedVersion prop change is what
	// triggers the parent to re-render this component, which re-runs
	// this filter and re-memoizes `groups` below. Cheap (< ~15 entries).
	const visible = traps.filter(isTrapVisible);
	const groups = useMemo(() => groupByUrl(visible, (inst) => inst.def.url), [visible]);

	return (
		<>
			{groups.map(([url, instances]) => (
				<InstancedMultiGltfField
					key={url}
					url={url}
					instances={instances}
					maxInstances={MAX_PER_BATCH}
				/>
			))}
		</>
	);
}

// A4 — tier 3 (deferred). Traps are sparse and player-discovered.
export function preloadTraps(): void {
	for (const def of TRAPS) useGLTF.preload(def.url);
}
