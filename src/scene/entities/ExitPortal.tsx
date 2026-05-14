"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";

/**
 * H9 — 5-hue goal palette. Reference uses `pallet[rotation*8/PI]` to
 * color the goal; we derive the hue from a 0-4 index so each ref
 * level reads with a distinct portal tint. Indigo/violet stay, plus
 * amber/teal/rose.
 */
const GOAL_HUES: readonly string[] = [
	OBJEXOOM_PALETTE.violet,
	OBJEXOOM_PALETTE.indigo,
	OBJEXOOM_PALETTE.amber,
	"#22d3a8", // teal
	"#f43f5e", // rose
];

/**
 * Spinning torus marking the level exit. Dim indigo until the key is
 * acquired; once unlocked it switches to the per-level hue and pulses
 * brighter.
 */
export function ExitPortal({
	position,
	unlocked,
	hueIndex,
}: {
	position: { x: number; y: number };
	unlocked: boolean;
	hueIndex: number;
}) {
	const ref = useRef<THREE.Mesh | null>(null);
	const hue = GOAL_HUES[hueIndex % GOAL_HUES.length];
	useFrame((s) => {
		if (!ref.current) return;
		ref.current.rotation.z = s.clock.elapsedTime * 0.6;
	});
	return (
		<mesh ref={ref} position={[position.x, 1.2, position.y]}>
			<torusGeometry args={[0.95, 0.22, 18, 32]} />
			<meshStandardMaterial
				color={unlocked ? hue : OBJEXOOM_PALETTE.indigo}
				emissive={unlocked ? hue : OBJEXOOM_PALETTE.indigo}
				emissiveIntensity={unlocked ? 1.4 : 0.3}
			/>
		</mesh>
	);
}
