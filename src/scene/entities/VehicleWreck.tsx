import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { pickVehicleUrl, VEHICLE_VARIANTS } from "../../vehicles";

/**
 * COV10 step-2 — courtyard-archetype RV wreck.
 *
 * One wrecked vehicle prop placed at a sector centroid when the
 * archetype is "courtyard" (PRD §COV10). The variant is deterministic
 * per map seed via pickVehicleUrl. Mounted from ObjexoomScene only
 * when `archetype === "courtyard"`.
 *
 * Yaw is also seeded deterministically so the wreck rests at a
 * different angle per map without re-rolling per frame. The wreck
 * is collision-flat — the player can walk through it; the visual
 * weight is the point, not the obstacle.
 */
export function VehicleWreck({
	position,
	seed,
}: {
	position: { x: number; y: number };
	seed: number;
}) {
	const url = pickVehicleUrl(seed);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	// Seeded yaw — same seed → same orientation.
	const yaw = useMemo(
		() => (((seed * 1103515245 + 12345) >>> 0) / 0xffffffff) * Math.PI * 2,
		[seed],
	);
	return (
		<group position={[position.x, 0, position.y]} rotation={[0, yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

for (const url of VEHICLE_VARIANTS) useGLTF.preload(url);
