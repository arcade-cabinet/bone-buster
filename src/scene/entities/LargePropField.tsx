import { useGLTF } from "@react-three/drei";
import { chunkInstances, groupByUrl, InstancedMultiGltfField } from "@scene/render/InstancedField";
import { LARGE_PROPS } from "@world/largeProps";
import type { LargePropInstance } from "@world/scatter/largePropScatter";
import { useMemo } from "react";

/**
 * COV2 step-2 — anchor-piece scatter renderer.
 *
 * PB3 — migrated from one cloned `<primitive>` per instance to grouped
 * InstancedMultiGltfField. Some large-prop GLBs are multi-mesh (cages,
 * RVs); the multi variant preserves per-sub-mesh local transforms
 * inside each instance.
 *
 * Blocking entries push the player out via collision; that wiring is
 * still fed from BoneBusterScene via the CollisionContext blocker list
 * — InstancedMesh has no per-instance scene-graph identity, but the
 * collider list is computed independently from the LargePropInstance
 * array anyway, so this change doesn't affect collision.
 */
// PB3 fold — per-batch instance cap. Each batch becomes one
// InstancedMesh per sub-mesh; oversized URL groups split into N
// batches instead of getting truncated at MAX_PER_URL.
const MAX_PER_BATCH = 16;

export function LargePropField({ props }: { props: readonly LargePropInstance[] }) {
	const groups = useMemo(() => groupByUrl(props, (inst) => inst.def.url), [props]);

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

// A4 — tier 2 (map-mount). Large props are anchor pieces — 1-2
// per sector, immediately visible on map mount.
export function preloadLargeProps(): void {
	for (const def of LARGE_PROPS) useGLTF.preload(def.url);
}
