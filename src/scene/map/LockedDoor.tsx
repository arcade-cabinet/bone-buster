import { playDoor, playDoorTick } from "@audio/sfx";
import { useFrame } from "@react-three/fiber";
import { TILE } from "@shared/constants";
import { BONE_BUSTER_PALETTE } from "@styles/tokens/index";
import { useRef } from "react";
import type * as THREE from "three";
import { WALL_HEIGHT } from "../constants";

/**
 * Grid-map locked door cell. Slides upward over 600 ms when `open`
 * goes true. Fires the door + tick SFX on the rising edge.
 */
export function LockedDoor({
	position,
	open,
}: {
	position: { x: number; z: number };
	open: boolean;
}) {
	const meshRef = useRef<THREE.Mesh | null>(null);
	const progressRef = useRef(open ? 1 : 0);
	const didFireRef = useRef(open);
	useFrame((_, dt) => {
		if (!meshRef.current) return;
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
		const baseY = WALL_HEIGHT / 2;
		meshRef.current.position.set(position.x, baseY + progressRef.current * WALL_HEIGHT, position.z);
	});
	return (
		<mesh
			ref={(node) => {
				meshRef.current = node;
			}}
		>
			<boxGeometry args={[TILE * 0.95, WALL_HEIGHT * 0.95, TILE * 0.25]} />
			<meshStandardMaterial
				color={BONE_BUSTER_PALETTE.amber}
				emissive={BONE_BUSTER_PALETTE.amber}
				emissiveIntensity={open ? 0.08 : 0.55}
				roughness={0.5}
			/>
		</mesh>
	);
}
