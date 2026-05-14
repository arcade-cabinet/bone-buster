import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { DECAL_VARIANTS_ALL } from "../../decals";
import type { DecalInstance } from "../../scatter/decalScatter";

/**
 * COV6 step-2 — renders wall-face decals.
 */
export function DecalField({ decals }: { decals: readonly DecalInstance[] }) {
	return (
		<>
			{decals.map((inst) => (
				<DecalMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function DecalMesh({ inst }: { inst: DecalInstance }) {
	const gltf = useGLTF(inst.url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[inst.position.x, inst.y, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

for (const url of DECAL_VARIANTS_ALL) useGLTF.preload(url);
