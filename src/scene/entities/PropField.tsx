import { useGLTF } from "@react-three/drei";
import { chunkInstances, groupByUrl, InstancedMultiGltfField } from "@scene/render/InstancedField";
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
// PB3 fold — per-batch instance cap. PropField runs at 64-per-batch
// (4× LargePropField) because regular props are smaller GLBs with
// fewer sub-meshes, so the per-batch fixed cost is lower.
const MAX_PER_BATCH = 64;

export function PropField({ props }: { props: readonly PropInstance[] }) {
	const groups = useMemo(() => groupByUrl(props, (inst) => inst.prop.url), [props]);

	return (
		<>
			{groups.flatMap(([url, instances]) =>
				chunkInstances(instances, MAX_PER_BATCH).map((batch, index) => (
					<InstancedMultiGltfField
						// biome-ignore lint/suspicious/noArrayIndexKey: chunk index is stable per (url, props.length) — chunkInstances always partitions in the same order, and the batch position within a URL group is the right identity. The url prefix already namespaces by group; the index disambiguates between batches of the same URL.
						key={`${url}:${index}`}
						url={url}
						instances={batch}
						maxInstances={MAX_PER_BATCH}
					/>
				)),
			)}
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
