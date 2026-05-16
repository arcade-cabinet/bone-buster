import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { DEBRIS_VARIANTS } from "../../debris";
import type { DebrisInstance } from "../../scatter/debrisScatter";

/**
 * COV5 step-2 — renders the per-map debris scatter. One cloned mesh
 * per DebrisInstance at world position + yaw. Mirrors PropField /
 * LampField / FloorTileField for consistency.
 */
export function DebrisField({ debris }: { debris: readonly DebrisInstance[] }) {
	return (
		<>
			{debris.map((inst) => (
				<DebrisMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function DebrisMesh({ inst }: { inst: DebrisInstance }) {
	const gltf = useGLTF(inst.url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[inst.position.x, 0, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 3 (deferred). Debris is visual flavor in sector bodies
// — not strictly needed for the first frame.
export function preloadDebris(): void {
	for (const url of DEBRIS_VARIANTS) useGLTF.preload(url);
}
