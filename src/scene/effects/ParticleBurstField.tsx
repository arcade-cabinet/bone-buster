import { addBoneBusterListener } from "@engine/events";
import { useFrame } from "@react-three/fiber";
import { BONE_BUSTER_PALETTE, SCALE } from "@styles/tokens/index";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const COLOR_BOUNCER = new THREE.Color(BONE_BUSTER_PALETTE.enemyImpMagma).getHex();
const COLOR_AMBER = new THREE.Color(BONE_BUSTER_PALETTE.actionPickupGlow).getHex();
// POL16 — extra colors for the layered damage burst.
const COLOR_SPARK = new THREE.Color(SCALE.amber[100]).getHex(); // hot white-amber impact
const COLOR_SMOKE = new THREE.Color(SCALE.parchment[600]).getHex(); // cool gray smoke
const COLOR_EMBER = new THREE.Color(SCALE.ember[400]).getHex(); // orange embers

type Mote = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	color: number;
	createdAt: number;
	ttlMs: number; // per-mote TTL (POL16 — smoke + embers live longer than sparks).
	radius: number; // sphere radius (POL16 — smoke puffs are bigger, sparks tighter).
	gravity: number; // per-mote gravity coefficient (POL16 — smoke floats up).
	emissiveIntensity: number; // bright for sparks, dim for smoke.
};

const DEFAULT_MOTE_TTL_MS = 350;
// I2 — bumped from 96 to fit ref-parity counts.
// POL16 — bumped again: layered damage bursts can fire 3× the pre-POL16
// mote count per event (8 sparks + 6 smoke + 8 embers = 22 vs the old
// 15). Steady-state still well under cap.
const MAX_MOTES = 280;

// QW3 — module-scope shared unit-sphere geometry. Per-mote radius is
// applied via `mesh.scale.setScalar(radius)` at mesh creation. Pre-QW3
// every new mote allocated a fresh SphereGeometry — up to MAX_MOTES=280
// GPU-resident geometries churning during a multi-burst combat window.
// PERF audit quick-win #3.
const MOTE_GEOMETRY = /*@__PURE__*/ new THREE.SphereGeometry(1, 6, 6);

/**
 * D4/D5 + POL16 — particle bursts. Listens for `bonebuster:burst` events:
 *
 *   pickup    → 8  amber motes (unchanged)
 *   playerHit → 30 red    motes (unchanged)
 *   explode   → 12 amber  motes (unchanged)
 *   damage    → MODERNIZED-DOOM LAYERED:
 *               • 8 hot impact sparks   (tight, fast, short TTL)
 *               • 6 gray smoke puffs    (slow upward, fade-out, larger radius)
 *               • 8 orange ember trails (mid-velocity drift, mid TTL)
 *
 * The pre-POL16 damage burst was 15 violet monocolor motes — visually
 * monotonous and read as a single "puff." The layered version reads
 * as a coherent impact event: bright flash of contact + the cloud it
 * kicked up + glowing embers raining down.
 *
 * Each mote follows ballistic kinematics with per-mote gravity (so
 * smoke can rise while sparks fall). Mesh pool is capped at MAX_MOTES;
 * oldest motes are dropped when the cap is hit so allocation stays
 * bounded.
 */
export function ParticleBurstField() {
	const motesRef = useRef<Mote[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);
	// Reused across frames so the tick loop allocates no per-frame Set
	// (was a fresh `new Set()` every frame — minor-GC pressure on mobile).
	const seenScratch = useRef<Set<number>>(new Set());

	// Drain the mesh pool on unmount so a level transition (Scene re-key)
	// doesn't strand per-instance materials on the GPU.
	useEffect(() => {
		const pool = meshes.current;
		return () => {
			for (const mesh of pool.values()) {
				(mesh.material as THREE.Material).dispose();
			}
			pool.clear();
		};
	}, []);

	useEffect(() => {
		return addBoneBusterListener("burst", (detail) => {
			const now = performance.now();
			if (detail.kind === "flameStream") {
				// E8 step-2 — directional flame cone stream. Emits a wave
				// of orange/yellow particles forward along the muzzle
				// direction (dirX, dirY in world XZ), with a small spread
				// cone. Each pellet trigger dispatches once; the wave
				// reads as a flame jet rather than a generic burst.
				const dx = detail.dirX ?? 0;
				const dy = detail.dirY ?? 1;
				const dlen = Math.hypot(dx, dy) || 1;
				const ux = dx / dlen;
				const uy = dy / dlen;
				const px = -uy;
				const py = ux;
				// Player camera height is ~1.7; spawn the stream at 1.5
				// (slightly below eye-line so it reads as "from the
				// muzzle" rather than "from the forehead").
				const FLAME_Y = 1.5;
				// Layer 1: bright yellow core — fastest, shortest TTL.
				for (let i = 0; i < 8; i += 1) {
					const spread = (Math.random() - 0.5) * 0.45;
					const speed = 12 + Math.random() * 5;
					const vx = ux * speed + px * spread * speed;
					const vz = uy * speed + py * spread * speed;
					motesRef.current.push({
						id: nextId.current++,
						pos: { x: detail.x, y: FLAME_Y, z: detail.y },
						vel: { x: vx, y: 0.2 + Math.random() * 0.3, z: vz },
						color: COLOR_SPARK,
						createdAt: now,
						ttlMs: 220,
						radius: 0.12,
						gravity: -1.0, // flame rises slowly
						emissiveIntensity: 4.5,
					});
				}
				// Layer 2: orange mid — broader cone, mid TTL.
				for (let i = 0; i < 10; i += 1) {
					const spread = (Math.random() - 0.5) * 0.8;
					const speed = 8 + Math.random() * 4;
					const vx = ux * speed + px * spread * speed;
					const vz = uy * speed + py * spread * speed;
					motesRef.current.push({
						id: nextId.current++,
						pos: {
							x: detail.x + (Math.random() - 0.5) * 0.12,
							y: FLAME_Y + (Math.random() - 0.5) * 0.12,
							z: detail.y + (Math.random() - 0.5) * 0.12,
						},
						vel: { x: vx, y: 0.4 + Math.random() * 0.3, z: vz },
						color: COLOR_EMBER,
						createdAt: now,
						ttlMs: 320,
						radius: 0.18,
						gravity: -1.2,
						emissiveIntensity: 3.2,
					});
				}
				// Layer 3: smoke trail — wide cone, slowest, longest TTL.
				for (let i = 0; i < 6; i += 1) {
					const spread = (Math.random() - 0.5) * 1.1;
					const speed = 3.0 + Math.random() * 2.0;
					const vx = ux * speed + px * spread * speed;
					const vz = uy * speed + py * spread * speed;
					motesRef.current.push({
						id: nextId.current++,
						pos: { x: detail.x, y: FLAME_Y + 0.2, z: detail.y },
						vel: { x: vx, y: 0.9 + Math.random() * 0.4, z: vz },
						color: COLOR_SMOKE,
						createdAt: now,
						ttlMs: 700,
						radius: 0.22,
						gravity: -1.5,
						emissiveIntensity: 0.3,
					});
				}
			} else if (detail.kind === "damage") {
				// POL16 — layered impact burst.
				// Layer 1: hot impact sparks — tight cone, fast, short TTL.
				for (let i = 0; i < 8; i += 1) {
					const theta = Math.random() * Math.PI * 2;
					const phi = Math.random() * Math.PI - Math.PI / 2;
					const speed = 3.5 + Math.random() * 2.0;
					motesRef.current.push({
						id: nextId.current++,
						pos: { x: detail.x, y: 0.9, z: detail.y },
						vel: {
							x: Math.cos(theta) * Math.cos(phi) * speed,
							y: Math.sin(phi) * speed + 0.6,
							z: Math.sin(theta) * Math.cos(phi) * speed,
						},
						color: COLOR_SPARK,
						createdAt: now,
						ttlMs: 220,
						radius: 0.05,
						gravity: 8,
						emissiveIntensity: 3.2,
					});
				}
				// Layer 2: smoke puffs — slow, larger, drift upward.
				for (let i = 0; i < 6; i += 1) {
					const theta = Math.random() * Math.PI * 2;
					const speed = 0.6 + Math.random() * 0.8;
					motesRef.current.push({
						id: nextId.current++,
						pos: {
							x: detail.x + (Math.random() - 0.5) * 0.2,
							y: 0.9,
							z: detail.y + (Math.random() - 0.5) * 0.2,
						},
						vel: {
							x: Math.cos(theta) * speed * 0.5,
							y: 0.9 + Math.random() * 0.4, // upward drift
							z: Math.sin(theta) * speed * 0.5,
						},
						color: COLOR_SMOKE,
						createdAt: now,
						ttlMs: 700,
						radius: 0.14,
						gravity: -0.8, // negative → floats up
						emissiveIntensity: 0.15,
					});
				}
				// Layer 3: ember trails — mid-velocity, glowing orange.
				for (let i = 0; i < 8; i += 1) {
					const theta = Math.random() * Math.PI * 2;
					const phi = Math.random() * Math.PI - Math.PI / 2;
					const speed = 1.8 + Math.random() * 1.2;
					motesRef.current.push({
						id: nextId.current++,
						pos: { x: detail.x, y: 0.9, z: detail.y },
						vel: {
							x: Math.cos(theta) * Math.cos(phi) * speed,
							y: Math.sin(phi) * speed + 1.2,
							z: Math.sin(theta) * Math.cos(phi) * speed,
						},
						color: COLOR_EMBER,
						createdAt: now,
						ttlMs: 500,
						radius: 0.07,
						gravity: 4.5,
						emissiveIntensity: 2.4,
					});
				}
			} else {
				// Pre-POL16 monocolor bursts — preserved for byte-stability
				// on the canonical screenshot gate (canonicals don't fire
				// damage events; pickup/playerHit/explode keep their
				// pre-POL16 shape).
				const count = detail.kind === "pickup" ? 8 : detail.kind === "explode" ? 12 : 30; // playerHit
				const colorHex =
					detail.kind === "playerHit"
						? COLOR_BOUNCER // red — player hit
						: COLOR_AMBER; // amber — pickup / explode
				for (let i = 0; i < count; i += 1) {
					const theta = Math.random() * Math.PI * 2;
					const phi = Math.random() * Math.PI - Math.PI / 2;
					const speed = 1.5 + Math.random() * 1.5;
					motesRef.current.push({
						id: nextId.current++,
						pos: { x: detail.x, y: 0.9, z: detail.y },
						vel: {
							x: Math.cos(theta) * Math.cos(phi) * speed,
							y: Math.sin(phi) * speed + 1.6,
							z: Math.sin(theta) * Math.cos(phi) * speed,
						},
						color: colorHex,
						createdAt: now,
						ttlMs: DEFAULT_MOTE_TTL_MS,
						radius: 0.08,
						gravity: 6,
						emissiveIntensity: 1.6,
					});
				}
			}
			while (motesRef.current.length > MAX_MOTES) motesRef.current.shift();
		});
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		// Compact the live list in place (write-index) — no per-frame array
		// allocation. `seen` is a reused Set, cleared each frame.
		const motes = motesRef.current;
		const seen = seenScratch.current;
		seen.clear();
		let w = 0;
		for (let r = 0; r < motes.length; r++) {
			const mote = motes[r];
			if (mote === undefined) continue;
			const age = now - mote.createdAt;
			if (age > mote.ttlMs) continue;
			mote.pos.x += mote.vel.x * dt;
			mote.pos.y += mote.vel.y * dt;
			mote.pos.z += mote.vel.z * dt;
			mote.vel.y -= mote.gravity * dt; // per-mote gravity (smoke floats, sparks fall)
			let mesh = meshes.current.get(mote.id);
			if (!mesh) {
				// QW3 — share MOTE_GEOMETRY (unit sphere); scale per-mote
				// so per-radius size renders correctly. Material stays
				// per-mesh because per-mote color + opacity decay
				// independently.
				const m = new THREE.Mesh(
					MOTE_GEOMETRY,
					new THREE.MeshStandardMaterial({
						color: mote.color,
						emissive: mote.color,
						emissiveIntensity: mote.emissiveIntensity,
						transparent: true,
					}),
				);
				m.scale.setScalar(mote.radius);
				groupRef.current.add(m);
				meshes.current.set(mote.id, m);
				mesh = m;
			}
			mesh.position.set(mote.pos.x, mote.pos.y, mote.pos.z);
			const fade = 1 - age / mote.ttlMs;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(mote.id);
			motes[w++] = mote;
		}
		motes.length = w;
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				// Dispose the per-instance material (shared MOTE_GEOMETRY is
				// NOT disposed — it's module-scope and reused). Without this
				// the GPU material accumulates monotonically under combat.
				(mesh.material as THREE.Material).dispose();
				meshes.current.delete(id);
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
