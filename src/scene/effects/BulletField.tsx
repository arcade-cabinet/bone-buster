import type { EnemyBullet } from "@engine/projectiles";
import { useFrame } from "@react-three/fiber";
import { BONE_BUSTER_PALETTE } from "@styles/tokens/index";
import { type RefObject, useRef } from "react";
import * as THREE from "three";

// Shared geometry + material across every bullet mesh. All bullets are
// identical visually, so allocating one of each at module load and
// reusing them across the pool cuts per-spawn GPU upload and JS GC
// churn. Materials/geometries owned at module scope; never disposed.
const BULLET_GEOMETRY = new THREE.SphereGeometry(0.18, 10, 10);
const BULLET_MATERIAL = new THREE.MeshStandardMaterial({
	color: BONE_BUSTER_PALETTE.amber,
	emissive: BONE_BUSTER_PALETTE.amber,
	emissiveIntensity: 1.8,
});

/**
 * Renders all currently-alive enemy bullets. The bullet array lives
 * on a ref managed by the parent Scene's useFrame; this component just
 * walks it each frame and lays down a glowing sphere per bullet.
 *
 * Bullets are pooled — meshes are created lazily per id and hidden
 * (not destroyed) when the bullet dies so the GC pressure stays flat.
 */
export function BulletField({
	bulletsRef,
	register,
}: {
	bulletsRef: RefObject<EnemyBullet[]>;
	register: RefObject<Map<number, THREE.Group>>;
}) {
	const groupRef = useRef<THREE.Group | null>(null);
	useFrame(() => {
		if (!groupRef.current) return;
		const seen = new Set<number>();
		for (const bullet of bulletsRef.current ?? []) {
			if (bullet.dead) continue;
			let mesh = register.current?.get(bullet.id);
			if (!mesh && groupRef.current) {
				const g = new THREE.Group();
				const inner = new THREE.Mesh(BULLET_GEOMETRY, BULLET_MATERIAL);
				g.add(inner);
				groupRef.current.add(g);
				register.current?.set(bullet.id, g);
				mesh = g;
			}
			if (mesh) {
				mesh.visible = true;
				mesh.position.set(bullet.position.x, 1.3, bullet.position.y);
				seen.add(bullet.id);
			}
		}
		for (const [id, mesh] of register.current ?? []) {
			if (!seen.has(id)) mesh.visible = false;
		}
	});
	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}
