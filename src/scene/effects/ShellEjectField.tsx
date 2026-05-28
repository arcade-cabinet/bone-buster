import { addBoneBusterListener } from "@engine/events";
import { useFrame } from "@react-three/fiber";
import { BONE_BUSTER_PALETTE } from "@styles/tokens/index";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { InstancedParticlePool, makeInstancedAlphaMaterial } from "./instancedParticles";

const COLOR_BRASS = new THREE.Color(BONE_BUSTER_PALETTE.shellBrass).getHex();

// CR-H1perf — one shared brass material for ALL shells; per-shell alpha rides
// the instance attribute. (Pre-instancing each shell also carried a
// shellBrassDeep emissive; the instanced material folds the warm tint into
// the shared emissiveIntensity — the per-shell variation that matters is
// position/rotation/fade, all instanced.)
const SHELL_MATERIAL = /*@__PURE__*/ makeInstancedAlphaMaterial({
	emissiveIntensity: 0.4,
	metalness: 0.7,
	roughness: 0.35,
});

// QW3 — module-scope shared geometry. All shells reference this one
// CylinderGeometry; the Mesh per-shell still gives us scale +
// position + rotation independence. Pre-QW3 every new shell allocated
// a fresh CylinderGeometry — up to 80 GPU-resident geometries churning
// over the SHELL_TTL_MS lifetime. PERF audit quick-win #3.
const SHELL_GEOMETRY = /*@__PURE__*/ new THREE.CylinderGeometry(0.025, 0.025, 0.07, 8);

type Shell = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	spin: { x: number; y: number; z: number };
	rot: { x: number; y: number; z: number }; // accumulated rotation (was mesh.rotation)
	createdAt: number;
	bounced: boolean;
	// PA9b — chaingun ejects ~11 shells/sec; smaller scale reads correctly
	// against the slower shotgun shells.
	scale: number;
};

const SHELL_TTL_MS = 4000;
// PA9b — chaingun rate raises the steady-state shell count. 80 covers
// 2s of continuous chaingun fire (~11 shells/sec) plus headroom for
// concurrent shotgun shots before the oldest shells start recycling.
const MAX_SHELLS = 80;

/**
 * I10 / PA9b — weapon shell ejection. Listens for `bonebuster:shellEject`
 * events (dispatched by the fire handler on shotgun AND chaingun
 * shots) and spawns one brass-tipped cylinder shell at the eject
 * point. Each shell has random spin, gravity, a single ground bounce,
 * and fades out over the final 750 ms of its `SHELL_TTL_MS` lifetime.
 *
 * The optional `scale` field on the event lets the fire handler pick
 * a smaller shell for chaingun fires (matches the reference clone's
 * smaller chaingun shell vs the bigger shotgun shell).
 */
export function ShellEjectField() {
	const shellsRef = useRef<Shell[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const nextId = useRef(1);
	// CR-H1perf — one InstancedMesh for every shell (1 draw call).
	const poolRef = useRef<InstancedParticlePool | null>(null);

	useEffect(() => {
		return () => {
			poolRef.current?.dispose();
			poolRef.current = null;
		};
	}, []);

	useEffect(() => {
		return addBoneBusterListener("shellEject", (d) => {
			shellsRef.current.push({
				id: nextId.current++,
				pos: { x: d.x, y: d.y, z: d.z },
				vel: { x: d.vx, y: d.vy, z: d.vz },
				spin: {
					x: (Math.random() - 0.5) * 12,
					y: (Math.random() - 0.5) * 12,
					z: (Math.random() - 0.5) * 12,
				},
				rot: { x: 0, y: 0, z: 0 },
				createdAt: performance.now(),
				bounced: false,
				scale: d.scale,
			});
			while (shellsRef.current.length > MAX_SHELLS) shellsRef.current.shift();
		});
	}, []);

	useFrame((_, dt) => {
		const group = groupRef.current;
		if (!group) return;
		let pool = poolRef.current;
		if (!pool) {
			pool = new InstancedParticlePool(SHELL_GEOMETRY, SHELL_MATERIAL, MAX_SHELLS);
			group.add(pool.mesh);
			poolRef.current = pool;
		}
		const now = performance.now();
		const shells = shellsRef.current;
		let w = 0;
		for (let r = 0; r < shells.length; r++) {
			const shell = shells[r];
			if (shell === undefined) continue;
			const age = now - shell.createdAt;
			if (age > SHELL_TTL_MS) continue;
			shell.pos.x += shell.vel.x * dt;
			shell.pos.y += shell.vel.y * dt;
			shell.pos.z += shell.vel.z * dt;
			shell.vel.y -= 9 * dt;
			if (shell.pos.y < 0.05) {
				shell.pos.y = 0.05;
				if (!shell.bounced && shell.vel.y < -0.3) {
					shell.vel.y *= -0.3;
					shell.vel.x *= 0.7;
					shell.vel.z *= 0.7;
					shell.bounced = true;
				} else {
					shell.vel.x *= 0.85;
					shell.vel.z *= 0.85;
					shell.vel.y = 0;
				}
			}
			shell.rot.x += shell.spin.x * dt;
			shell.rot.y += shell.spin.y * dt;
			shell.rot.z += shell.spin.z * dt;
			// Fade only in the last 750 ms.
			const fadeStart = SHELL_TTL_MS - 750;
			const fade = age < fadeStart ? 1 : 1 - (age - fadeStart) / 750;
			if (w < MAX_SHELLS) {
				pool.write(
					w,
					shell.pos.x,
					shell.pos.y,
					shell.pos.z,
					shell.scale,
					COLOR_BRASS,
					fade,
					shell.rot.x,
					shell.rot.y,
					shell.rot.z,
				);
			}
			shells[w++] = shell;
		}
		shells.length = w;
		pool.commit(Math.min(w, MAX_SHELLS));
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}
