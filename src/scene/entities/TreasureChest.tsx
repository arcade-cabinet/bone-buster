"use client";

import { OBJEXOOM_PALETTE } from "../../design-tokens";

/**
 * D1 — decorative treasure chest stamped on every exit. The reference
 * uses a lathed ring + cylinder + box silhouette; we approximate with
 * a wide box base + a narrower lid offset upward. No interaction — the
 * portal torus is still the win trigger.
 */
export function TreasureChest({ position }: { position: { x: number; y: number } }) {
	return (
		<group position={[position.x, 0.25, position.y]}>
			<mesh position={[0, 0, 0]}>
				<boxGeometry args={[0.9, 0.45, 0.65]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.chestWood}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.15}
					roughness={0.7}
				/>
			</mesh>
			<mesh position={[0, 0.33, 0]}>
				<boxGeometry args={[0.92, 0.22, 0.68]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.chestWoodDeep}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.18}
					roughness={0.6}
				/>
			</mesh>
			{/* Brass band */}
			<mesh position={[0, 0.05, 0.34]}>
				<boxGeometry args={[0.94, 0.05, 0.02]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.65}
				/>
			</mesh>
			{/* Lock */}
			<mesh position={[0, 0.27, 0.34]}>
				<cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={1.0}
				/>
			</mesh>
		</group>
	);
}
