import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import type { TrapInstance } from "../../scatter/trapScatter";
import { TRAPS } from "../../traps";

/**
 * COV8 step-2 — trap scatter renderer.
 *
 * One cloned GLB per TrapInstance, positioned + yawed per the scatter's
 * per-map deterministic layout. Matches the PropField / DebrisField /
 * LargePropField shape (SkeletonUtils.clone per mount; primitive-wrapped
 * under a group).
 *
 * Disarmed traps drop their group opacity to ~30% so the player can
 * visually confirm a sector is safe. The transparency is applied at
 * group level — every child mesh inherits via materials' transparent flag.
 */
export function TrapField({ traps }: { traps: readonly TrapInstance[] }) {
	return (
		<>
			{traps.map((inst) => (
				<TrapMesh key={inst.id} inst={inst} />
			))}
		</>
	);
}

function TrapMesh({ inst }: { inst: TrapInstance }) {
	const gltf = useGLTF(inst.def.url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	// Disarmed state is mutable per-frame; reading inst.disarmed inline
	// gives us live visual feedback without re-rendering. R3F re-evaluates
	// the group's `visible` attribute every render — but for a scatter
	// that doesn't re-render per frame, the visual cue is "this trap got
	// faded to half-tint until level reset" rather than per-frame fade.
	return (
		<group
			position={[inst.position.x, 0, inst.position.y]}
			rotation={[0, inst.yaw, 0]}
			visible={!inst.disarmed || inst.def.kind === "trigger"}
		>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 3 (deferred). Traps are sparse and player-discovered.
export function preloadTraps(): void {
	for (const def of TRAPS) useGLTF.preload(def.url);
}
