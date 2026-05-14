"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import { playDoorTick, playPortal } from "../../sfx";

/**
 * H7 — RealDoor at the goal. A wide animated portal frame that slides
 * upward when the player has the key. Mirrors the reference's
 * `RealDoor` class which gates level-clear behind passing through.
 *
 * Also used for the going_back second door at the player spawn (H8) —
 * passing through it triggers MISSION COMPLETE.
 */
export function RealDoor({
	position,
	unlocked,
}: {
	position: { x: number; y: number };
	unlocked: boolean;
}) {
	const meshRef = useRef<THREE.Mesh | null>(null);
	const progressRef = useRef(unlocked ? 1 : 0);
	const didFireRef = useRef(unlocked);
	useFrame((_, dt) => {
		if (!meshRef.current) return;
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
		const baseY = 1.2;
		meshRef.current.position.set(position.x, baseY + progressRef.current * 2.4, position.y);
	});
	return (
		<mesh
			ref={(node) => {
				meshRef.current = node;
			}}
		>
			<boxGeometry args={[2.2, 2.4, 0.18]} />
			<meshStandardMaterial
				color={unlocked ? OBJEXOOM_PALETTE.violet : OBJEXOOM_PALETTE.door}
				emissive={unlocked ? OBJEXOOM_PALETTE.violet : OBJEXOOM_PALETTE.indigo}
				emissiveIntensity={unlocked ? 1.0 : 0.25}
				roughness={0.4}
				metalness={0.2}
			/>
		</mesh>
	);
}
