import { addBoneBusterListener } from "@engine/events";
import { useFrame } from "@react-three/fiber";
import { BONE_BUSTER_PALETTE } from "@styles/tokens/index";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const COLOR_BRASS = new THREE.Color(BONE_BUSTER_PALETTE.shellBrass).getHex();
const COLOR_BRASS_DEEP = new THREE.Color(BONE_BUSTER_PALETTE.shellBrassDeep).getHex();

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
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);
	// Reused so the tick loop allocates no per-frame Set (was `new Set()`/frame).
	const seenScratch = useRef<Set<number>>(new Set());

	// Drain the mesh pool on unmount so a level transition doesn't strand
	// per-instance materials on the GPU.
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
				createdAt: performance.now(),
				bounced: false,
				scale: d.scale,
			});
			while (shellsRef.current.length > MAX_SHELLS) shellsRef.current.shift();
		});
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		// Compact in place (write-index) — no per-frame array alloc.
		const shells = shellsRef.current;
		const seen = seenScratch.current;
		seen.clear();
		let w = 0;
		for (let r = 0; r < shells.length; r++) {
			const shell = shells[r];
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
			let mesh = meshes.current.get(shell.id);
			if (!mesh) {
				// QW3 — share SHELL_GEOMETRY at module scope; material
				// stays per-mesh because per-shell opacity fades
				// independently as TTL elapses (see opacity write below).
				const m = new THREE.Mesh(
					SHELL_GEOMETRY,
					new THREE.MeshStandardMaterial({
						color: COLOR_BRASS,
						emissive: COLOR_BRASS_DEEP,
						emissiveIntensity: 0.4,
						metalness: 0.7,
						roughness: 0.35,
						transparent: true,
					}),
				);
				m.scale.setScalar(shell.scale);
				groupRef.current.add(m);
				meshes.current.set(shell.id, m);
				mesh = m;
			}
			mesh.position.set(shell.pos.x, shell.pos.y, shell.pos.z);
			mesh.rotation.x += shell.spin.x * dt;
			mesh.rotation.y += shell.spin.y * dt;
			mesh.rotation.z += shell.spin.z * dt;
			// Fade only in the last 750 ms.
			const fadeStart = SHELL_TTL_MS - 750;
			const fade = age < fadeStart ? 1 : 1 - (age - fadeStart) / 750;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(shell.id);
			shells[w++] = shell;
		}
		shells.length = w;
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				// Dispose per-instance material (shared SHELL_GEOMETRY is not).
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
