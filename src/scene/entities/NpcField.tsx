import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { SkeletonUtils } from "three-stdlib";
import { NPC_URL_LIST, NPC_URLS } from "../../npcs";
import type { NpcInstance } from "../../scatter/npcScatter";

/**
 * COV14 step-2 — ambient NPC scatter renderer (library archetype).
 *
 * COV14 step-3 — chibi rigs ship with named animation clips
 * (idle / walk / attack). The library is supposed to read as
 * inhabited, not as a frozen wax-figure exhibit, so each chibi
 * plays its idle-loop clip on mount. No FSM, no LOS, no
 * interaction — purely visual ambient motion.
 *
 * Mirrors PropField / DebrisField conventions
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
	const groupRef = useRef<Group>(null);
	// Bind animations to the CLONED scene so each instance plays
	// independently (otherwise all chibis sync to one mixer).
	const { actions, names } = useAnimations(gltf.animations, groupRef);

	useEffect(() => {
		if (!actions || names.length === 0) return;
		// Prefer a clip whose name matches /idle/i; fall back to the
		// first clip if none matches — the chibi pack always ships
		// SOMETHING in the rest pose worth animating subtly.
		const idleName = names.find((n) => /idle/i.test(n)) ?? names[0];
		const action = actions[idleName];
		if (!action) return;
		// Phase-offset by inst.id so multiple chibis don't perfectly
		// sync — avoids the "uncanny chorus" effect.
		action.time = (inst.id % 100) * 0.03;
		action.play();
		return () => {
			action.fadeOut(0.2);
			action.stop();
		};
	}, [actions, names, inst.id]);

	return (
		<group
			ref={groupRef}
			position={[inst.position.x, 0, inst.position.y]}
			rotation={[0, inst.yaw, 0]}
		>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 3 (deferred). NPCs are library-archetype only.
export function preloadNpcs(): void {
	for (const url of NPC_URL_LIST) useGLTF.preload(url);
}
