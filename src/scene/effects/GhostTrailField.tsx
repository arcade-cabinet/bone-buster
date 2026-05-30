import type { Enemy } from "@engine/mapTypes";
import { useFrame } from "@react-three/fiber";
import { PLAYER_HEIGHT, TILE } from "@shared/constants";
import { SCALE } from "@styles/tokens/index";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { InstancedParticlePool, makeInstancedAlphaMaterial } from "./instancedParticles";

/**
 * GH-TRAIL (ghost-hunting follow-up) — a faint per-enemy spectral WAKE. Every
 * few frames each live enemy emits a cool-toned mote at its position; the mote
 * drifts up slightly and fades over a short TTL, reading as a ghostly trail that
 * lingers where an enemy moved. Pure procedural FX — no asset, no gameplay
 * effect. InstancedMesh-pooled + disposed on unmount (no per-mote allocation,
 * no leak), mirroring the ParticleBurstField contract.
 *
 * UV-aware: a `uvHidden` enemy that hasn't been revealed emits no trail (its
 * body is invisible, so a visible wake would give it away — the trail respects
 * the same concealment the UV flashlight gates).
 */

const COLOR_WAKE = /*@__PURE__*/ new THREE.Color(SCALE.indigo[300]).getHex();
const MOTE_TTL_MS = 700;
const EMIT_EVERY_MS = 90; // per-enemy emit cadence
const MAX_MOTES = 220;
const MOTE_GEOMETRY = /*@__PURE__*/ new THREE.SphereGeometry(1, 5, 5);
const MOTE_MATERIAL = /*@__PURE__*/ makeInstancedAlphaMaterial({ emissiveIntensity: 1.3 });

type Wake = {
	x: number;
	y: number;
	z: number;
	createdAt: number;
};

export function GhostTrailField({
	enemiesRef,
	hasUvFlashlight,
}: {
	enemiesRef: RefObject<Enemy[]>;
	/** PC3 — when the player owns the UV light, uvHidden enemies only show a wake once revealed. */
	hasUvFlashlight: boolean;
}) {
	const poolRef = useRef<InstancedParticlePool | null>(null);
	if (poolRef.current === null) {
		poolRef.current = new InstancedParticlePool(MOTE_GEOMETRY, MOTE_MATERIAL, MAX_MOTES);
	}
	const wakesRef = useRef<Wake[]>([]);
	const lastEmitRef = useRef<Map<number, number>>(new Map());

	useEffect(() => {
		const pool = poolRef.current;
		return () => {
			pool?.dispose();
		};
	}, []);

	useFrame(() => {
		const pool = poolRef.current;
		if (!pool) return;
		const now = performance.now();
		const wakes = wakesRef.current;

		// Emit: one mote per enemy per EMIT_EVERY_MS at its world position.
		for (const enemy of enemiesRef.current) {
			if (enemy.dead) continue;
			// A still-concealed uvHidden enemy emits no wake (would betray its
			// position); once mesh-revealed the body is visible so the wake is fine.
			if (enemy.uvHidden && hasUvFlashlight) continue;
			const last = lastEmitRef.current.get(enemy.id) ?? 0;
			if (now - last < EMIT_EVERY_MS) continue;
			lastEmitRef.current.set(enemy.id, now);
			if (wakes.length >= MAX_MOTES) continue;
			wakes.push({
				x: enemy.position.x,
				y: PLAYER_HEIGHT * 0.5,
				z: enemy.position.y,
				createdAt: now,
			});
		}

		// Advance + retire + write live wakes (in-place compaction).
		let writeIdx = 0;
		for (let i = 0; i < wakes.length; i += 1) {
			const w = wakes[i];
			if (w === undefined) continue;
			const age = now - w.createdAt;
			if (age >= MOTE_TTL_MS) continue;
			const t = age / MOTE_TTL_MS; // 0..1
			const alpha = (1 - t) * 0.32; // faint
			const scale = TILE * (0.05 + t * 0.06); // grows slightly as it fades
			pool.write(writeIdx, w.x, w.y + t * 0.4, w.z, scale, COLOR_WAKE, alpha);
			wakes[writeIdx] = w;
			writeIdx += 1;
		}
		wakes.length = writeIdx;
		pool.commit(writeIdx);
	});

	const pool = poolRef.current;
	return pool ? <primitive object={pool.mesh} /> : null;
}
