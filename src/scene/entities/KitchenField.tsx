import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { KITCHEN_PROPS } from "../../kitchen";
import type { KitchenInstance } from "../../scatter/kitchenScatter";

/**
 * COV13 step-2 — kitchen-prop scatter renderer (library archetype only).
 * One cloned GLB per KitchenInstance, positioned + yawed per scatter.
 * Mirrors PropField / DebrisField conventions.
 */
export function KitchenField({ props }: { props: readonly KitchenInstance[] }) {
	return (
		<>
			{props.map((inst) => (
				<KitchenMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function KitchenMesh({ inst }: { inst: KitchenInstance }) {
	const gltf = useGLTF(inst.url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[inst.position.x, 0, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

for (const url of KITCHEN_PROPS) useGLTF.preload(url);
