import { useGLTF } from "@react-three/drei";
import { groupByUrl, InstancedMultiGltfField } from "@scene/render/InstancedField";
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
const MAX_PER_URL = 16;

export function LargePropField({ props }: { props: readonly LargePropInstance[] }) {
	const groups = useMemo(() => groupByUrl(props, (inst) => inst.def.url), [props]);

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

// A4 — tier 2 (map-mount). Large props are anchor pieces — 1-2
// per sector, immediately visible on map mount.
export function preloadLargeProps(): void {
	for (const def of LARGE_PROPS) useGLTF.preload(def.url);
}
