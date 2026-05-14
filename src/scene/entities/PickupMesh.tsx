"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import type { Pickup } from "../../engine";

/**
 * Floating pickup mesh — bobs + spins. Each `pickup.kind` renders as a
 * distinct silhouette so the player learns to recognize health vs ammo
 * vs flashlight from across a sector without needing labels.
 *
 *   health        — amber cross (two bars)
 *   chaingunAmmo  — indigo battery cell with end caps
 *   shotgunAmmo   — amber shell pair with brass primers
 *   flashlight    — parchment cylinder with amber lens
 */
export function PickupMesh({
	pickup,
	register,
}: {
	pickup: Pickup;
	register: (group: THREE.Group | null) => void;
}) {
	const ref = useRef<THREE.Group | null>(null);
	useEffect(() => {
		register(ref.current);
		return () => register(null);
	}, [register]);
	useFrame((s) => {
		if (!ref.current) return;
		ref.current.rotation.y = s.clock.elapsedTime * 1.4;
		ref.current.position.y = 0.7 + Math.sin(s.clock.elapsedTime * 2 + pickup.id) * 0.1;
	});

	return (
		<group
			ref={(node) => {
				ref.current = node;
			}}
			position={[pickup.position.x, 0.7, pickup.position.y]}
		>
			{pickup.kind === "health" && (
				<>
					{/* D2 — amber cross. Two crossed bars in brand amber. */}
					<mesh>
						<boxGeometry args={[0.5, 0.15, 0.15]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={1.0}
						/>
					</mesh>
					<mesh>
						<boxGeometry args={[0.15, 0.5, 0.15]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={1.0}
						/>
					</mesh>
				</>
			)}
			{pickup.kind === "chaingunAmmo" && (
				/* D3 — indigo cell box. Reads as a battery / power cell. */
				<group>
					<mesh>
						<boxGeometry args={[0.55, 0.32, 0.32]} />
						<meshStandardMaterial
							color="#1f2547"
							emissive={OBJEXOOM_PALETTE.indigo}
							emissiveIntensity={0.55}
							roughness={0.5}
						/>
					</mesh>
					<mesh position={[0.18, 0, 0]}>
						<boxGeometry args={[0.06, 0.4, 0.4]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.indigo}
							emissive={OBJEXOOM_PALETTE.indigo}
							emissiveIntensity={1.4}
						/>
					</mesh>
					<mesh position={[-0.18, 0, 0]}>
						<boxGeometry args={[0.06, 0.4, 0.4]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.indigo}
							emissive={OBJEXOOM_PALETTE.indigo}
							emissiveIntensity={1.4}
						/>
					</mesh>
				</group>
			)}
			{pickup.kind === "shotgunAmmo" && (
				/* D3 — amber shell pair. Two stubby cylinders side by side. */
				<group>
					<mesh position={[-0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={0.95}
							roughness={0.4}
						/>
					</mesh>
					<mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={0.95}
							roughness={0.4}
						/>
					</mesh>
					{/* Brass primer caps */}
					<mesh position={[-0.15, 0.18, 0]}>
						<cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
						<meshStandardMaterial color="#b16a14" emissive="#b16a14" emissiveIntensity={0.4} />
					</mesh>
					<mesh position={[0.15, 0.18, 0]}>
						<cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
						<meshStandardMaterial color="#b16a14" emissive="#b16a14" emissiveIntensity={0.4} />
					</mesh>
				</group>
			)}
			{pickup.kind === "flashlight" && (
				/* J1 — flashlight pickup: parchment cylinder w/ amber lens */
				<group>
					<mesh rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.16, 0.45, 12]} />
						<meshStandardMaterial
							color="#fef3c7"
							emissive="#fef3c7"
							emissiveIntensity={0.6}
							metalness={0.4}
							roughness={0.3}
						/>
					</mesh>
					<mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.18, 0.13, 0.08, 12]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={1.8}
						/>
					</mesh>
				</group>
			)}
		</group>
	);
}
