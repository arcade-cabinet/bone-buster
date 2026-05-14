import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import type { LampInstance } from "../../lampScatter";
import { LAMP_VARIANTS_OFF, LAMP_VARIANTS_ON, lampUrlFor } from "../../lampScatter";

/**
 * COV1 — renders the per-map lamp scatter. Each LampInstance gets a
 * cloned mesh at its world position; E4 (later) will attach a scoped
 * pointLight to the subset with `on: true`.
 *
 * The clone-per-instance pattern matches BarrelMesh/EnemyMesh: drei's
 * useGLTF returns a shared scene graph that mutations would leak
 * across consumers; SkeletonUtils.clone gives each mount its own
 * traversable tree.
 */
export function LampField({ lamps }: { lamps: readonly LampInstance[] }) {
	return (
		<>
			{lamps.map((lamp) => (
				<LampMesh key={lamp.id} lamp={lamp} />
			))}
		</>
	);
}

function LampMesh({ lamp }: { lamp: LampInstance }) {
	const url = lampUrlFor(lamp);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[lamp.position.x, 0, lamp.position.y]}>
			<primitive object={cloned} />
		</group>
	);
}

// Preload both off + on variants so the first lamp doesn't stall the
// render loop. The on/off symmetry means flipping the `on` flag at
// runtime (E4) won't hit a cold fetch either. The URLs already flow
// through assetUrl.A() inside lampScatter.ts.
for (const url of [...LAMP_VARIANTS_OFF, ...LAMP_VARIANTS_ON]) {
	useGLTF.preload(url);
}
