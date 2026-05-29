import { PROP_MODELS } from "@assets/models";
import { playDoor, playDoorTick } from "@audio/sfx";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { WALL_HEIGHT } from "../constants";

/**
 * Grid-map locked door cell. VIS5 — renders the PSX `props/door_locked.glb`
 * (was a procedural amber box) per the OVERHAUL2 "nothing procedural where a PSX
 * model exists" rule; mirrors RealDoor's useGLTF + SkeletonUtils.clone pattern.
 * Slides upward over 600 ms when `open` goes true; fires the door + tick SFX on
 * the rising edge. A load failure is caught by the Shell's AssetErrorBoundary
 * (ERR1) — the door GLB sits under the scene Suspense.
 */
const DOOR_LOCKED_URL = PROP_MODELS.doorLocked;

export function LockedDoor({
	position,
	open,
}: {
	position: { x: number; z: number };
	open: boolean;
}) {
	const groupRef = useRef<THREE.Group | null>(null);
	const progressRef = useRef(open ? 1 : 0);
	const didFireRef = useRef(open);
	const gltf = useGLTF(DOOR_LOCKED_URL);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const target = open ? 1 : 0;
		const speed = 1 / 0.6; // 600 ms full travel
		progressRef.current +=
			Math.sign(target - progressRef.current) *
			Math.min(Math.abs(target - progressRef.current), speed * dt);
		if (open && !didFireRef.current && progressRef.current > 0.05) {
			didFireRef.current = true;
			playDoor();
			// K7 — mechanical tick pairs with the heavy door boom.
			playDoorTick();
		}
		// Slide the whole door group upward as it opens (was the box mesh's Y).
		groupRef.current.position.set(position.x, progressRef.current * WALL_HEIGHT, position.z);
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

useGLTF.preload(DOOR_LOCKED_URL);
