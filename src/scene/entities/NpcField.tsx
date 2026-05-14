import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { NPC_URL_LIST, NPC_URLS } from "../../npcs";
import type { NpcInstance } from "../../scatter/npcScatter";

/**
 * COV14 step-2 — ambient NPC scatter renderer (library archetype).
 *
 * Pure set-dressing — no AI, no LOS, no damage. Each instance renders
 * the chibi GLB matching its NpcKind at the scatter's position with a
 * seeded yaw. Mirrors PropField / DebrisField conventions
 * (SkeletonUtils.clone per mount).
 */
export function NpcField({ instances }: { instances: readonly NpcInstance[] }) {
	return (
		<>
			{instances.map((inst) => (
				<NpcMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function NpcMesh({ inst }: { inst: NpcInstance }) {
	const gltf = useGLTF(NPC_URLS[inst.kind]);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[inst.position.x, 0, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

for (const url of NPC_URL_LIST) useGLTF.preload(url);
