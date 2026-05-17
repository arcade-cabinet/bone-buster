import { useGLTF } from "@react-three/drei";
import { groupByUrl, InstancedMultiGltfField } from "@scene/render/InstancedField";
import { NATURE_PLANT_URLS } from "@world/nature";
import type { NatureInstance } from "@world/scatter/natureScatter";
import { useMemo } from "react";

/**
 * COV11 step-2 / PT2 — courtyard-archetype nature scatter renderer.
 *
 * PT2 — migrated from `SkeletonUtils.clone(Mega_Nature.glb)` per
 * instance (which dropped the entire 31-plant aggregate at every
 * spawn site) to per-plant InstancedMultiGltfField. Each
 * `NatureInstance` carries its own `url` (deterministic per id +
 * mapSeed via `pickNaturePlant`); we group by url and emit one
 * InstancedMultiGltfField per group. The renderer collapses N
 * instances of the same plant URL into a single InstancedMesh per
 * sub-mesh per draw call.
 *
 * Draw-call delta: pre-PT2 = N×31×subMeshes per courtyard. Post-PT2
 * = min(N, 31)×subMeshes per courtyard (roughly N×subMeshes for the
 * typical courtyard density of 4-8 instances × 5 sectors).
 */
const MAX_PER_BATCH = 32;

export function NatureField({ instances }: { instances: readonly NatureInstance[] }) {
	const groups = useMemo(() => groupByUrl(instances, (inst) => inst.url), [instances]);

	return (
		<>
			{groups.map(([url, items]) => (
				<InstancedMultiGltfField
					key={url}
					url={url}
					instances={items}
					maxInstances={MAX_PER_BATCH}
				/>
			))}
		</>
	);
}

// A4 — tier 3 (deferred). Nature scatter is courtyard-archetype only.
export function preloadNature(): void {
	for (const url of NATURE_PLANT_URLS) useGLTF.preload(url);
}
