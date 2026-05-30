import type { Enemy } from "@engine/mapTypes";
import { useFrame } from "@react-three/fiber";
import { PLAYER_HEIGHT, TILE } from "@shared/constants";
import { SCALE } from "@styles/tokens/index";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { InstancedParticlePool, makeInstancedAlphaMaterial } from "./instancedParticles";

/**
 * GH-TRAIL (ghost-hunting follow-up) — a faint per-enemy spectral WAKE. Every
 * few frames each live enemy emits a cool-toned mote at its position; the mote
 * drifts up slightly and fades over a short TTL, reading as a ghostly trail that
 * lingers where an enemy moved. Pure procedural FX — no asset, no gameplay
 * effect. InstancedMesh-pooled + disposed on unmount, mirroring the
 * ParticleBurstField contract. The Wake records are a pre-allocated ring buffer
 * (no per-emit object allocation) and `lastEmitRef` is pruned of dead/absent
 * enemy ids each frame so neither structure grows unbounded within a level.
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
	// Construct the pool via a useState initializer (runs once; React discards
	// the extra Strict-Mode invocation) so the <primitive> mounts on first render
	// AND there's no pool mutation in the render body. Disposed in the effect.
	const [pool] = useState(() => new InstancedParticlePool(MOTE_GEOMETRY, MOTE_MATERIAL, MAX_MOTES));
	// Pre-allocated Wake ring — MAX_MOTES records reused in place so emitting
	// never allocates. `wakeCount` is the live prefix length [0, MAX_MOTES].
	const wakesRef = useRef<Wake[]>(
		Array.from({ length: MAX_MOTES }, () => ({ x: 0, y: 0, z: 0, createdAt: -Number.MAX_VALUE })),
	);
	const wakeCountRef = useRef(0);
	const lastEmitRef = useRef<Map<number, number>>(new Map());

	useEffect(() => {
		const map = lastEmitRef.current;
		return () => {
			pool.dispose();
			map.clear();
		};
	}, [pool]);

	useFrame(() => {
		const now = performance.now();
		const wakes = wakesRef.current;
		const enemies = enemiesRef.current;

		// Emit: one mote per enemy per EMIT_EVERY_MS at its world position.
		for (const enemy of enemies) {
			if (enemy.dead) continue;
			// A still-concealed uvHidden enemy emits no wake (would betray its
			// position); once mesh-revealed the body is visible so the wake is fine.
			if (enemy.uvHidden && hasUvFlashlight) continue;
			const last = lastEmitRef.current.get(enemy.id) ?? 0;
			if (now - last < EMIT_EVERY_MS) continue;
			lastEmitRef.current.set(enemy.id, now);
			if (wakeCountRef.current >= MAX_MOTES) continue;
			// Write into the next free ring slot in place — no allocation.
			const w = wakes[wakeCountRef.current];
			if (w === undefined) continue;
			w.x = enemy.position.x;
			w.y = PLAYER_HEIGHT * 0.5;
			w.z = enemy.position.y;
			w.createdAt = now;
			wakeCountRef.current += 1;
		}

		// Prune lastEmit entries for enemies that are gone/dead so the Map can't
		// grow past the live enemy set within a level.
		if (lastEmitRef.current.size > 0) {
			for (const id of lastEmitRef.current.keys()) {
				if (!enemies.some((e) => e.id === id && !e.dead)) lastEmitRef.current.delete(id);
			}
		}

		// Advance + retire + write live wakes (in-place compaction over the prefix).
		let writeIdx = 0;
		for (let i = 0; i < wakeCountRef.current; i += 1) {
			const w = wakes[i];
			if (w === undefined) continue;
			const age = now - w.createdAt;
			if (age >= MOTE_TTL_MS) continue;
			const t = age / MOTE_TTL_MS; // 0..1
			const alpha = (1 - t) * 0.32; // faint
			const scale = TILE * (0.05 + t * 0.06); // grows slightly as it fades
			pool.write(writeIdx, w.x, w.y + t * 0.4, w.z, scale, COLOR_WAKE, alpha);
			// Compact: copy the surviving record's fields into the write slot.
			const dst = wakes[writeIdx];
			if (dst !== undefined && dst !== w) {
				dst.x = w.x;
				dst.y = w.y;
				dst.z = w.z;
				dst.createdAt = w.createdAt;
			}
			writeIdx += 1;
		}
		wakeCountRef.current = writeIdx;
		pool.commit(writeIdx);
	});

	return <primitive object={pool.mesh} />;
}
