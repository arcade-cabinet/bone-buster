import { useGLTF } from "@react-three/drei";
import { InstancedMultiGltfField } from "@scene/render/InstancedField";
import { ALL_PROPS } from "@world/scatter/propPool";
import type { PropInstance } from "@world/scatter/propScatter";
import { useMemo } from "react";

/**
 * E3 — renders the per-map decorative prop scatter.
 *
 * PB3 — migrated from one cloned `<primitive>` per instance to grouped
 * InstancedMultiGltfField (one InstancedMesh per sub-mesh per url, N
 * instances drawn in 1 GPU call each via setMatrixAt). Multi-mesh GLBs
 * (cages, RVs, loot props with 21-27 sub-meshes) preserve their per-
 * sub-mesh local transforms inside the instance via
 * `instance × localMatrix × vertex` composition.
 *
 * Previously: 1 draw call per (instance × sub-mesh). E.g. loot/Books.glb
 * has 27 sub-meshes — at 5 placements that's 135 draw calls. Now: 27
 * draw calls regardless of placement count.
 *
 * Step-1 slice: props still render as static set-dressing. The
 * `blocking` flag on prop.blocking is plumbed but collision wiring
 * happens via `spawnProps` choosing positions that respect the
 * 4-tile spawn/exit/key skip-radius; per-instance collider registration
 * isn't in this step.
 */
const MAX_PER_URL = 64;

export function PropField({ props }: { props: readonly PropInstance[] }) {
	const groups = useMemo(() => {
		const byUrl = new Map<string, PropInstance[]>();
		for (const inst of props) {
			let bucket = byUrl.get(inst.prop.url);
			if (!bucket) {
				bucket = [];
				byUrl.set(inst.prop.url, bucket);
			}
			bucket.push(inst);
		}
		return Array.from(byUrl.entries());
	}, [props]);

	return (
		<>
			{groups.map(([url, instances]) => (
				<InstancedMultiGltfField
					key={url}
					url={url}
					instances={instances}
					maxInstances={MAX_PER_URL}
				/>
			))}
		</>
	);
}

// A4 — tier 2 (map-mount). Preload every prop URL so the first
// sector doesn't stall. ALL_PROPS pulls from PROP_CATALOGUE
// (the 30-entry master list); per-archetype buckets reference
// subsets of the same prop instances so preloading the master
// covers them.
export function preloadProps(): void {
	for (const prop of ALL_PROPS) {
		useGLTF.preload(prop.url);
	}
}
