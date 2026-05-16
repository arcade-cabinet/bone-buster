import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { ALL_PROPS } from "../../scatter/propPool";
import type { PropInstance } from "../../scatter/propScatter";

/**
 * E3 — renders the per-map decorative prop scatter. Each PropInstance
 * gets a cloned mesh at its world position with a deterministic yaw.
 *
 * The clone-per-instance pattern matches LampField / BarrelField /
 * EnemyMesh: drei's `useGLTF` returns a shared scene graph that
 * mutations would leak across consumers; `SkeletonUtils.clone` gives
 * each mount its own traversable tree even though these meshes don't
 * have skeletons (it handles plain meshes too and is consistent with
 * the rest of the renderer).
 *
 * Step-1 slice: props render as static set-dressing. The `blocking`
 * flag is plumbed through PropInstance.prop but the collision wiring
 * is not yet in this step — `spawnProps` chooses positions that
 * respect the 4-tile spawn/exit/key skip-radius so blocking props
 * don't strand the player. E3 step-2 will register blocking props
 * with the existing sector collision list.
 */
export function PropField({ props }: { props: readonly PropInstance[] }) {
	return (
		<>
			{props.map((inst) => (
				<PropMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function PropMesh({ inst }: { inst: PropInstance }) {
	const gltf = useGLTF(inst.prop.url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[inst.position.x, 0, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<primitive object={cloned} />
		</group>
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
