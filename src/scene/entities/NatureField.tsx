import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { NATURE_MEGA_PACK_URL } from "../../nature";
import type { NatureInstance } from "../../scatter/natureScatter";

/**
 * COV11 step-2 — courtyard-archetype nature scatter renderer.
 *
 * Each NatureInstance gets a scaled-down SkeletonUtils.clone of the
 * Mega_Nature.glb aggregate. Per-instance yaw + scale variance keeps
 * the clones from reading as identical copy-pastes.
 */
export function NatureField({ instances }: { instances: readonly NatureInstance[] }) {
	return (
		<>
			{instances.map((inst) => (
				<NatureMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function NatureMesh({ inst }: { inst: NatureInstance }) {
	const gltf = useGLTF(NATURE_MEGA_PACK_URL);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group
			position={[inst.position.x, 0, inst.position.y]}
			rotation={[0, inst.yaw, 0]}
			scale={[inst.scale, inst.scale, inst.scale]}
		>
			<primitive object={cloned} />
		</group>
	);
}

useGLTF.preload(NATURE_MEGA_PACK_URL);
