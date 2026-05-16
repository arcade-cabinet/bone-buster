import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { BOSS_VISUAL_SCALE, type Enemy } from "../../engine";
import { ENEMY_MODELS, pickEnemySkin } from "../../models";

/**
 * Renders an enemy using a real 3DPSX GLB asset (see `models.ts`),
 * with state-driven animation:
 *  - walking when the enemy is moving (velocity sample)
 *  - attack when fsmState===3 (just fired)
 *  - death once enemy.dead flips true
 *  - idle otherwise
 *
 * Each instance gets a SkeletonUtils.clone of the cached scene so
 * multiple enemies of the same kind animate independently. Skins
 * without named animations (T-pose-only meshes, or FBX→GLB collapses
 * to "mixamo.com") fall back to a procedural idle bob so they never
 * appear frozen.
 */
export function EnemyMesh({
	enemy,
	register,
}: {
	enemy: Enemy;
	register: (group: THREE.Group | null) => void;
}) {
	const groupRef = useRef<THREE.Group | null>(null);
	// Each enemy picks deterministically from the kind's skin roster
	// using its id. Same id => same skin every spawn.
	const skin = useMemo(() => pickEnemySkin(enemy.kind, enemy.id), [enemy.kind, enemy.id]);
	const gltf = useGLTF(skin.url);
	// SkeletonUtils.clone keeps the skinned-mesh/skeleton bindings sane
	// across multiple instances — a plain .clone() shares skeletons and
	// every instance animates in lockstep.
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

	// POL29 — boss-tier enemies get a permanent emissive blood-red rim
	// so the bigger silhouette ALSO reads as visually distinct at low
	// light, not just "skeleton scaled up". Mutate the cloned material
	// once (per instance, not per frame) — POL19 hit-flash already
	// owns per-frame material mutation via the EnemyHitFlash slot, so
	// the static rim doesn't interfere.
	useMemo(() => {
		if (enemy.tier !== "boss") return;
		cloned.traverse((obj) => {
			const mesh = obj as THREE.Mesh;
			if (!mesh.isMesh) return;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const mat of mats) {
				const std = mat as THREE.MeshStandardMaterial;
				if (!std.emissive) continue;
				// Clone the material so the rim only applies to this
				// instance, not every enemy sharing the cached GLB
				// material. POL19 EnemyHitFlash relies on per-instance
				// clones for the same reason.
				const own = std.clone();
				own.emissive = new THREE.Color(0xdc2626); // blood[600]
				own.emissiveIntensity = 0.22;
				mesh.material = own;
			}
		});
	}, [cloned, enemy.tier]);
	// Normalize size against measured bbox. Use the LONGEST axis (not
	// just Y) because some horror meshes ship lying on the wrong axis
	// — picking the biggest dim and matching it to heightTiles gives
	// a reliable on-screen scale regardless of authored orientation.
	const scale = useMemo(() => {
		const bbox = new THREE.Box3().setFromObject(cloned);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		const longest = Math.max(size.x, size.y, size.z, 1e-3);
		// E2 — bosses render at BOSS_VISUAL_SCALE × the kind's normal size
		// so they read as bigger/scarier at a glance.
		const tierMultiplier = enemy.tier === "boss" ? BOSS_VISUAL_SCALE : 1;
		return (skin.heightTiles / longest) * tierMultiplier;
	}, [cloned, skin.heightTiles, enemy.tier]);
	const { actions, mixer } = useAnimations(gltf.animations, cloned);
	const hasNamedAnims = useMemo(
		() => Boolean(skin.anims.idle && actions[skin.anims.idle]),
		[actions, skin.anims.idle],
	);

	const facingRef = useRef(0);
	const lastPosRef = useRef({ x: enemy.position.x, y: enemy.position.y });
	const prevStateRef = useRef<"idle" | "walk" | "attack" | "death" | null>(null);
	// Phase offset for the procedural bob so a packed level doesn't
	// look like a chorus line. Deterministic from id.
	const bobPhase = useMemo(() => (enemy.id * 0.7) % (Math.PI * 2), [enemy.id]);

	useEffect(() => {
		register(groupRef.current);
		return () => register(null);
	}, [register]);

	useFrame((_, dt) => {
		mixer.update(dt);
		const group = groupRef.current;
		if (!group) return;
		// POL19 hit-flash moved to <EnemyHitFlash> slot (see docs/SLOT-ARCHITECTURE.md).

		const t = performance.now() / 1000;
		const bobY = hasNamedAnims ? 0 : Math.sin(t * 2.2 + bobPhase) * 0.06;

		const targetY = skin.floorOffset + bobY + (enemy.kind === "wraith" ? 1.2 : 0);
		group.position.set(enemy.position.x, targetY, enemy.position.y);

		const dx = enemy.position.x - lastPosRef.current.x;
		const dy = enemy.position.y - lastPosRef.current.y;
		if (dx * dx + dy * dy > 1e-6) {
			facingRef.current = Math.atan2(dx, dy);
		}
		lastPosRef.current = { x: enemy.position.x, y: enemy.position.y };
		group.rotation.y = facingRef.current + skin.yawOffsetRad;

		if (!hasNamedAnims) return;
		const speedSq = dx * dx + dy * dy;
		const desired: "idle" | "walk" | "attack" | "death" = enemy.dead
			? "death"
			: enemy.fsmState === 3
				? "attack"
				: speedSq > 1e-5
					? "walk"
					: "idle";

		if (desired !== prevStateRef.current) {
			const animName = skin.anims[desired];
			const next = animName ? actions[animName] : null;
			if (next) {
				for (const action of Object.values(actions)) {
					if (action && action !== next && action.isRunning()) {
						action.fadeOut(0.15);
					}
				}
				next.reset();
				next.fadeIn(0.15);
				if (desired === "attack" || desired === "death") {
					next.setLoop(THREE.LoopOnce, 1);
					next.clampWhenFinished = true;
				} else {
					next.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
				}
				next.play();
			}
			prevStateRef.current = desired;
		}
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
			position={[enemy.position.x, skin.floorOffset, enemy.position.y]}
			scale={scale}
		>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 2 (map-mount). Every skin variant in the roster
// is preloaded, not just the primary, so per-archetype enemy
// remaps don't hit a cold fetch.
export function preloadEnemyRoster(): void {
	for (const m of Object.values(ENEMY_MODELS)) {
		for (const s of m.roster) useGLTF.preload(s.url);
	}
}
