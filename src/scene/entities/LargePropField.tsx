import { useGLTF } from "@react-three/drei";
import { LARGE_PROPS } from "@world/largeProps";
import type { LargePropInstance } from "@world/scatter/largePropScatter";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";

/**
 * COV2 step-2 — anchor-piece scatter renderer.
 *
 * One cloned GLB per LargePropInstance, positioned and yawed per the
 * scatter's per-map deterministic layout. Mirrors PropField / DebrisField
 * shape (SkeletonUtils.clone per mount; primitive-wrapped under a group).
 *
 * Blocking entries push the player out via collision; that wiring is
 * fed from ObjexoomScene via the CollisionContext blocker list.
 */
export function LargePropField({ props }: { props: readonly LargePropInstance[] }) {
	return (
		<>
			{props.map((inst) => (
				<LargePropMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function LargePropMesh({ inst }: { inst: LargePropInstance }) {
	const gltf = useGLTF(inst.def.url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[inst.position.x, 0, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 2 (map-mount). Large props are anchor pieces — 1-2
// per sector, immediately visible on map mount.
export function preloadLargeProps(): void {
	for (const def of LARGE_PROPS) useGLTF.preload(def.url);
}
