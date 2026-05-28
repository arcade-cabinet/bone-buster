import { addBoneBusterListener } from "@engine/events";
import { useFrame } from "@react-three/fiber";
import { getArchetypeLightPalette } from "@scene/lighting/archetypePalette";
import { BONE_BUSTER_PALETTE } from "@styles/tokens/index";
import type { PropArchetype } from "@world/scatter/propPool";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InstancedParticlePool, makeInstancedAlphaMaterial } from "./instancedParticles";

const COLOR_PHASER = new THREE.Color(BONE_BUSTER_PALETTE.enemyWraithSoul).getHex();
const COLOR_BOUNCER = new THREE.Color(BONE_BUSTER_PALETTE.enemyImpMagma).getHex();
const COLOR_BONE = new THREE.Color(BONE_BUSTER_PALETTE.enemyBone).getHex();
// POL40 decal colors (dark splatter vs faint bone mark).
const DECAL_COLOR_BONE = 0x2a2a2a;
const DECAL_COLOR_GIB = 0x4a0808;
const DECAL_FLAT_ROT_X = -Math.PI / 2; // lay the circle flat on the floor

// CR-H1perf — shared instanced materials: shards (lit boxes, per-instance
// color + alpha) and decals (flat circles, dark, double-sided so the floor
// quad shows from any camera angle).
const SHARD_MATERIAL = /*@__PURE__*/ makeInstancedAlphaMaterial({
	emissiveIntensity: 0.25,
	roughness: 0.7,
});
const DECAL_MATERIAL = /*@__PURE__*/ (() => {
	const m = makeInstancedAlphaMaterial({ emissiveIntensity: 0, roughness: 1 });
	m.side = THREE.DoubleSide;
	return m;
})();

type BodyShard = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	spin: { x: number; y: number; z: number };
	rot: { x: number; y: number; z: number }; // accumulated rotation (was mesh.rotation)
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
 * I1 — body-part physics. Listens for `bonebuster:bodyParts`
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
 *   rattler → bone white
 *   bouncer      → blood red
 *   phaser   → violet
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
	// CR-H1perf — two InstancedMeshes (1 draw call each): shards + decals.
	const shardPoolRef = useRef<InstancedParticlePool | null>(null);
	const decalPoolRef = useRef<InstancedParticlePool | null>(null);
	const nextId = useRef(1);

	useEffect(() => {
		return () => {
			shardPoolRef.current?.dispose();
			decalPoolRef.current?.dispose();
			shardPoolRef.current = null;
			decalPoolRef.current = null;
		};
	}, []);

	useEffect(() => {
		return addBoneBusterListener("bodyParts", (detail) => {
			const count = 4 + ((Math.random() * 3) | 0); // 4-6
			const baseColor =
				detail.kind === "phaser"
					? COLOR_PHASER
					: detail.kind === "bouncer"
						? COLOR_BOUNCER
						: COLOR_BONE;
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
					rot: { x: 0, y: 0, z: 0 },
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
		const group = groupRef.current;
		if (!group) return;
		let shardPool = shardPoolRef.current;
		let decalPool = decalPoolRef.current;
		if (!shardPool || !decalPool) {
			shardPool = new InstancedParticlePool(SHARD_GEOMETRY, SHARD_MATERIAL, MAX_BODY_SHARDS);
			decalPool = new InstancedParticlePool(DECAL_GEOMETRY, DECAL_MATERIAL, MAX_BODY_SHARDS);
			group.add(shardPool.mesh);
			group.add(decalPool.mesh);
			shardPoolRef.current = shardPool;
			decalPoolRef.current = decalPool;
		}
		const now = performance.now();
		const shards = shardsRef.current;
		let w = 0; // survivor + shard-instance write-index (1:1 — every live shard draws)
		let d = 0; // settled-decal instance write-index
		for (let r = 0; r < shards.length; r++) {
			const shard = shards[r];
			if (shard === undefined) continue;
			const age = now - shard.createdAt;
			if (age > timings.ttl) continue;
			// POL40 — capture the rest XZ on the motion→settle transition.
			if (age >= timings.motion && shard.settledAt === null) {
				shard.settledAt = { x: shard.pos.x, z: shard.pos.z };
			}
			// POL25 — physics + spin only during the MOTION phase.
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
				shard.rot.x += shard.spin.x * dt;
				shard.rot.y += shard.spin.y * dt;
				shard.rot.z += shard.spin.z * dt;
			}
			// POL25 + POL41 — full opacity through motion + rest, fade only
			// in the settleEnd → ttl window.
			let opacity = 1;
			if (age > timings.settleEnd) {
				const fadeT = (age - timings.settleEnd) / (timings.ttl - timings.settleEnd);
				opacity = Math.max(0, 1 - fadeT);
			}
			if (w < MAX_BODY_SHARDS) {
				shardPool.write(
					w,
					shard.pos.x,
					shard.pos.y,
					shard.pos.z,
					1,
					shard.color,
					opacity,
					shard.rot.x,
					shard.rot.y,
					shard.rot.z,
				);
			}
			// POL40 — settled shards get a flat dark floor decal (y=0.02 to
			// avoid z-fighting). Dark splatter for gibs, faint mark for bone.
			if (shard.settledAt !== null && d < MAX_BODY_SHARDS) {
				const decalColor = shard.color === COLOR_BONE ? DECAL_COLOR_BONE : DECAL_COLOR_GIB;
				decalPool.write(
					d,
					shard.settledAt.x,
					0.02,
					shard.settledAt.z,
					1,
					decalColor,
					0.55 * opacity,
					DECAL_FLAT_ROT_X,
					0,
					0,
				);
				d += 1;
			}
			shards[w] = shard; // compact survivor into slot w
			w += 1;
		}
		shards.length = w;
		shardPool.commit(Math.min(w, MAX_BODY_SHARDS));
		decalPool.commit(Math.min(d, MAX_BODY_SHARDS));
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}
