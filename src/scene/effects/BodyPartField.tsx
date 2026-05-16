import { addObjexoomListener } from "@engine/events";
import { useFrame } from "@react-three/fiber";
import { getArchetypeLightPalette } from "@scene/lighting/archetypePalette";
import { OBJEXOOM_PALETTE } from "@styles/tokens/index";
import type { PropArchetype } from "@world/scatter/propPool";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const COLOR_WRAITH = new THREE.Color(OBJEXOOM_PALETTE.enemyWraithSoul).getHex();
const COLOR_IMP = new THREE.Color(OBJEXOOM_PALETTE.enemyImpMagma).getHex();
const COLOR_BONE = new THREE.Color(OBJEXOOM_PALETTE.enemyBone).getHex();

type BodyShard = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	spin: { x: number; y: number; z: number };
	color: number;
	createdAt: number;
	bounced: boolean;
	/**
	 * POL40 — once the shard transitions to settle, record its resting
	 * XZ position so the rest-decal renderer can place a thin dark
	 * circle on the floor below. Null until the shard has landed.
	 */
	settledAt: { x: number; z: number } | null;
};

/**
 * POL25 — phased body-part lifecycle.
 *
 *   0 .. MOTION_MS              physics: gravity, bounce, spin
 *   MOTION_MS .. SETTLE_END_MS  settled: opacity 1, no motion, no spin
 *   SETTLE_END_MS .. TTL_MS     fade-out: opacity 1 → 0
 *
 * Pre-POL25 used a single 3000ms TTL with linear fade across the
 * whole window — gibs faded out while they were still moving, which
 * read as "the world is dissolving" rather than "they fell and
 * settled." The phased lifecycle gives each shard a proper rest
 * pose before it disappears.
 */
const MOTION_MS = 800; // active physics window
const FADE_MS = 1000; // the trailing fade always lasts 1s
const DEFAULT_BODYPART_TTL_MS = 5000; // canonical (corridor) — used when no archetype prop
const MAX_BODY_SHARDS = 120;

// QW3 — module-scope shared geometries. All shards/decals reference
// these; material stays per-mesh because per-shard color + per-shard
// opacity decay independently. Pre-QW3 every body-shard allocated a
// fresh BoxGeometry and every settled-shard decal allocated a fresh
// CircleGeometry — up to 240 GPU-resident geometries churning per
// gib-heavy combat window. PERF audit quick-win #3.
const SHARD_GEOMETRY = /*@__PURE__*/ new THREE.BoxGeometry(0.18, 0.18, 0.18);
const DECAL_GEOMETRY = /*@__PURE__*/ new THREE.CircleGeometry(0.28, 12);

/**
 * POL41 — given a TTL, derive the SETTLE_END timestamp so the trailing
 * fade window is always FADE_MS. The MOTION window is always
 * MOTION_MS, and the settle (steady-opacity) window absorbs all the
 * remaining time. With TTL=5000ms (corridor): settle ends at 4000ms
 * — preserves pre-POL41 canonical timing. With TTL=3500ms (arena):
 * settle ends at 2500ms. With TTL=8000ms (sewer): settle ends at
 * 7000ms — longer atmospheric persistence.
 */
function timingsFor(ttlMs: number): { motion: number; settleEnd: number; ttl: number } {
	const ttl = Math.max(ttlMs, MOTION_MS + FADE_MS); // safety floor
	return { motion: MOTION_MS, settleEnd: ttl - FADE_MS, ttl };
}

/**
 * I1 — body-part physics. Listens for `objexoom:bodyParts`
 * (dispatched at every enemy death) and spawns 4-6 chunky shard meshes
 * at the death location. Each shard:
 *
 *  - random spin (rad/s on each axis)
 *  - initial velocity with radial spread + upward kick
 *  - gravity pulls them down
 *  - single ground bounce then settles
 *  - fades over BODYPART_TTL_MS, then despawns
 *
 * Shard color tracks the killed enemy's kind:
 *
 *   skeleton → bone white
 *   imp      → blood red
 *   wraith   → violet
 *
 * Mesh pool is capped at `MAX_BODY_SHARDS`.
 */
export function BodyPartField({ archetype }: { archetype?: PropArchetype } = {}) {
	const ttl = useMemo(() => {
		if (!archetype) return DEFAULT_BODYPART_TTL_MS;
		return getArchetypeLightPalette(archetype).gibFadeMs;
	}, [archetype]);
	const timings = useMemo(() => timingsFor(ttl), [ttl]);
	const shardsRef = useRef<BodyShard[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	// POL40 — per-shard ground-decal mesh, mounted on settle and torn
	// down with the shard. Keyed by shard id so the decal lives exactly
	// as long as the gib it belongs to.
	const decalMeshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);

	useEffect(() => {
		return addObjexoomListener("bodyParts", (detail) => {
			const count = 4 + ((Math.random() * 3) | 0); // 4-6
			const baseColor =
				detail.kind === "wraith" ? COLOR_WRAITH : detail.kind === "imp" ? COLOR_IMP : COLOR_BONE;
			const now = performance.now();
			for (let i = 0; i < count; i += 1) {
				const theta = Math.random() * Math.PI * 2;
				const speed = 1.2 + Math.random() * 1.8;
				shardsRef.current.push({
					id: nextId.current++,
					pos: { x: detail.x, y: 1.0, z: detail.y },
					vel: {
						x: Math.cos(theta) * speed,
						y: 1.5 + Math.random() * 1.5,
						z: Math.sin(theta) * speed,
					},
					spin: {
						x: (Math.random() - 0.5) * 8,
						y: (Math.random() - 0.5) * 8,
						z: (Math.random() - 0.5) * 8,
					},
					color: baseColor,
					createdAt: now,
					bounced: false,
					settledAt: null,
				});
			}
			while (shardsRef.current.length > MAX_BODY_SHARDS) {
				shardsRef.current.shift();
			}
		});
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		const live: BodyShard[] = [];
		const seen = new Set<number>();
		for (const shard of shardsRef.current) {
			const age = now - shard.createdAt;
			if (age > timings.ttl) continue;
			// POL40 — capture the rest XZ position on the motion→settle
			// transition. One-shot per shard; rendered as a flat dark
			// circle on the floor for the rest of the shard's lifetime.
			if (age >= timings.motion && shard.settledAt === null) {
				shard.settledAt = { x: shard.pos.x, z: shard.pos.z };
			}
			// POL25 — phased lifecycle. Only run physics + spin in the
			// MOTION phase; after MOTION_MS the shard rests in place.
			if (age < timings.motion) {
				shard.pos.x += shard.vel.x * dt;
				shard.pos.y += shard.vel.y * dt;
				shard.pos.z += shard.vel.z * dt;
				shard.vel.y -= 10 * dt;
				if (shard.pos.y < 0.1) {
					shard.pos.y = 0.1;
					if (!shard.bounced && shard.vel.y < -0.5) {
						shard.vel.y *= -0.35;
						shard.vel.x *= 0.6;
						shard.vel.z *= 0.6;
						shard.bounced = true;
					} else {
						shard.vel.x *= 0.85;
						shard.vel.z *= 0.85;
						shard.vel.y = 0;
					}
				}
			}
			let mesh = meshes.current.get(shard.id);
			if (!mesh) {
				// QW3 — share SHARD_GEOMETRY; material per-mesh because
				// per-shard color + per-shard opacity decay independently.
				const m = new THREE.Mesh(
					SHARD_GEOMETRY,
					new THREE.MeshStandardMaterial({
						color: shard.color,
						emissive: shard.color,
						emissiveIntensity: 0.25,
						transparent: true,
						roughness: 0.7,
					}),
				);
				groupRef.current.add(m);
				meshes.current.set(shard.id, m);
				mesh = m;
			}
			mesh.position.set(shard.pos.x, shard.pos.y, shard.pos.z);
			// POL25 — spin only during motion phase; rest pose is static.
			if (age < timings.motion) {
				mesh.rotation.x += shard.spin.x * dt;
				mesh.rotation.y += shard.spin.y * dt;
				mesh.rotation.z += shard.spin.z * dt;
			}
			// POL25 + POL41 — phased opacity: full during motion + rest,
			// fade only during the final settleEnd → ttl window. POL41
			// scales the window per archetype.
			let opacity = 1;
			if (age > timings.settleEnd) {
				const fadeT = (age - timings.settleEnd) / (timings.ttl - timings.settleEnd);
				opacity = Math.max(0, 1 - fadeT);
			}
			(mesh.material as THREE.MeshStandardMaterial).opacity = opacity;
			mesh.visible = true;
			// POL40 — render the rest-decal once settled. Flat dark
			// circle just above the floor (y=0.02 to avoid z-fighting
			// with the floor plane). Shares the shard's color but
			// pushed toward dark/red emissive so blood/imp gibs read
			// as splatter while bone shards leave a faint mark.
			if (shard.settledAt !== null && groupRef.current) {
				let decal = decalMeshes.current.get(shard.id);
				if (!decal) {
					// QW3 — share DECAL_GEOMETRY; material per-mesh
					// because color varies per-shard-kind (bone vs gib).
					decal = new THREE.Mesh(
						DECAL_GEOMETRY,
						new THREE.MeshBasicMaterial({
							color: shard.color === COLOR_BONE ? 0x2a2a2a : 0x4a0808,
							transparent: true,
							opacity: 0.55,
							side: THREE.DoubleSide,
							depthWrite: false,
						}),
					);
					decal.rotation.x = -Math.PI / 2;
					groupRef.current.add(decal);
					decalMeshes.current.set(shard.id, decal);
				}
				decal.position.set(shard.settledAt.x, 0.02, shard.settledAt.z);
				(decal.material as THREE.MeshBasicMaterial).opacity = 0.55 * opacity;
			}
			seen.add(shard.id);
			live.push(shard);
		}
		shardsRef.current = live;
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				meshes.current.delete(id);
			}
		}
		// POL40 — tear down decals when their shard despawns.
		for (const [id, decal] of decalMeshes.current) {
			if (!seen.has(id)) {
				groupRef.current.remove(decal);
				decal.geometry.dispose();
				(decal.material as THREE.Material).dispose();
				decalMeshes.current.delete(id);
			}
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
