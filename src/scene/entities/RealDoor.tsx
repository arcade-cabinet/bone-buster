import { playDoor, playDoorTick, playPortal } from "@audio/sfx";
import { dispatch } from "@engine/events";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { DOOR_VARIANTS, pickDoorUrl } from "@world/doors";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

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
	// POL18 — `rawProgress` tracks linear 0..1; `easedProgress` applies
	// an ease-out-with-overshoot curve for the visible motion. Keeping
	// the underlying linear progress preserves the cancel-mid-open
	// behavior (close-door speed feels symmetric); only the rendered
	// lift gets the spring shape.
	const rawProgress = useRef(unlocked ? 1 : 0);
	const didFireRef = useRef(unlocked);
	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const target = unlocked ? 1 : 0;
		const speed = 1 / 0.9; // 900 ms slower-than-locked-door open
		const delta =
			Math.sign(target - rawProgress.current) *
			Math.min(Math.abs(target - rawProgress.current), speed * dt);
		rawProgress.current += delta;
		if (unlocked && !didFireRef.current && rawProgress.current > 0.05) {
			didFireRef.current = true;
			// POL18 — layered open cue. The pre-POL18 path played
			// playPortal + playDoorTick which read as two isolated
			// effects. Layering playDoor adds the sub-bass groan so
			// the open reads as weight + mechanical click + portal
			// resolve.
			playDoor();
			playDoorTick();
			playPortal();
			// POL18 — threshold puff. Spawns a "pickup"-kind burst at
			// the door's base so dust kicks up as the door begins to
			// lift — reuses ParticleBurstField's existing channel
			// (pickup = 8 amber motes) rather than introducing a new
			// kind. The amber tone reads as "the world giving way."
			dispatch({
				type: "burst",
				x: position.x,
				y: position.y,
				kind: "pickup",
			});
		}
		// POL18 — ease-out-with-overshoot envelope. Linear `rawProgress`
		// is reshaped into a spring-eased visible position via a curve
		// that overshoots target ~6% at p≈0.85 then settles to 1.0.
		// Math: blend(linear, sin(p*π)*1.06) using bell weight `4p(1-p)`.
		const p = rawProgress.current;
		const bell = Math.max(0, 4 * p * (1 - p));
		const overshootBoost = Math.sin(p * Math.PI) * 0.06;
		const easedProgress = p + bell * overshootBoost;
		// Slide the door upward as it opens. The base Y matches the prior
		// procedural box height + offset so the canonical pose is the same.
		const baseY = 1.2;
		groupRef.current.position.set(position.x, baseY + easedProgress * 2.4, position.y);
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

// A4 — tier 2 (map-mount). Every door GLB is preloaded so the
// very first refLevel mount doesn't stutter.
export function preloadDoors(): void {
	for (const url of DOOR_VARIANTS) useGLTF.preload(url);
}
