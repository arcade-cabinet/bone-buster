import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { DOOR_VARIANTS, pickDoorUrl } from "../../doors";
import { playDoorTick, playPortal } from "../../sfx";

/**
 * H7 — RealDoor at the goal. A wide animated portal that slides
 * upward when the player has the key. Mirrors the reference's
 * `RealDoor` class which gates level-clear behind passing through.
 *
 * COV7 step-2: the door is now rendered as one of 6 PSX Mega Pack II
 * Doors & Gates GLBs picked deterministically from `pickDoorUrl
 * (mapSeed)` — each refLevel + procedural run reads a different door
 * style. The slide-upward animation drives the group's Y position;
 * the cloned GLB scene rides along.
 *
 * Also used for the going_back second door at the player spawn (H8) —
 * passing through it triggers MISSION COMPLETE.
 */
export function RealDoor({
	position,
	unlocked,
	mapSeed,
}: {
	position: { x: number; y: number };
	unlocked: boolean;
	/**
	 * COV7 — seed for picking the door GLB variant. The H7 exit and H8
	 * spawn doors live on the same map so we XOR the spawn-door's seed
	 * to land on a different variant of the same pack.
	 */
	mapSeed: number;
}) {
	const url = pickDoorUrl(mapSeed);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	const groupRef = useRef<THREE.Group | null>(null);
	const progressRef = useRef(unlocked ? 1 : 0);
	const didFireRef = useRef(unlocked);
	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const target = unlocked ? 1 : 0;
		const speed = 1 / 0.9; // 900 ms slower-than-locked-door open
		const delta =
			Math.sign(target - progressRef.current) *
			Math.min(Math.abs(target - progressRef.current), speed * dt);
		progressRef.current += delta;
		if (unlocked && !didFireRef.current && progressRef.current > 0.05) {
			didFireRef.current = true;
			playPortal();
			// K7 — RealDoor mechanical tick on the open transition.
			playDoorTick();
		}
		// Slide the door upward as it opens. The base Y matches the prior
		// procedural box height + offset so the canonical pose is the same.
		const baseY = 1.2;
		groupRef.current.position.set(position.x, baseY + progressRef.current * 2.4, position.y);
	});
	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		>
			<primitive object={cloned} />
		</group>
	);
}

// Preload every door GLB so the very first refLevel mount doesn't stutter.
for (const url of DOOR_VARIANTS) useGLTF.preload(url);
