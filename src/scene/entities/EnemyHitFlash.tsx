import type { Enemy } from "@engine/engine";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SCALE } from "../../design-tokens";

/**
 * POL19 — enemy hit-flash slot (see docs/SLOT-ARCHITECTURE.md).
 *
 * Mounted as a sibling to `<EnemyMesh>` under a shared per-enemy
 * `<group key={enemy.id}>` in ObjexoomScene. Responsibilities:
 *
 *   - Watch `enemy.staggerUntil` each frame.
 *   - Look up the enemy mesh group from the shared `enemyMeshes`
 *     map (the same map EnemyMesh registers itself into).
 *   - On first observation of a flash window, clone the GLB
 *     materials per-instance (preventing the cached-material leak
 *     that would flash every enemy of the same skin in lockstep).
 *   - Modulate color (lerp toward white) + emissive (lerp toward
 *     blood) + emissiveIntensity (0.5 → 2.5) on an ease-out-quad
 *     curve over the first 140ms of the stagger window.
 *
 * Why a separate slot: EnemyMesh today already owns anim + bob +
 * facing + mesh sync; bolting the flash into its useFrame mixed
 * five responsibilities in one component. The slot lets each
 * feature own one concern and compose by sibling-mount.
 */

const FLASH_MS = 140;
const WHITE = new THREE.Color(0xffffff);
const BLOOD_RED = new THREE.Color(SCALE.blood[300]);

type MaterialSlot = {
	material: THREE.MeshStandardMaterial;
	baseColor: THREE.Color;
	baseEmissive: THREE.Color;
	baseEmissiveIntensity: number;
};

export function EnemyHitFlash({
	enemy,
	meshLookup,
}: {
	enemy: Enemy;
	/** Shared lookup from ObjexoomScene — same map EnemyMesh.register writes into. */
	meshLookup: { current: Map<number, THREE.Group> };
}) {
	const slotsRef = useRef<MaterialSlot[] | null>(null);
	const lastEnsureFrameRef = useRef(0);

	// Reset slot cache if the enemy id changes (shouldn't happen
	// mid-component-life, but defensive against parent re-keying).
	useEffect(() => {
		slotsRef.current = null;
		lastEnsureFrameRef.current = 0;
	}, []);

	useFrame(() => {
		const stagger = enemy.staggerUntil ?? 0;
		if (stagger === 0) return;
		const now = performance.now();
		const flashStart = stagger - (enemy.tier === "boss" ? 100 : 70);
		const flashAge = now - flashStart;
		if (flashAge < 0 || flashAge >= FLASH_MS) {
			// Restore baseline once if we previously cloned slots.
			if (slotsRef.current && lastEnsureFrameRef.current !== 0) {
				for (const slot of slotsRef.current) {
					slot.material.color.copy(slot.baseColor);
					slot.material.emissive.copy(slot.baseEmissive);
					slot.material.emissiveIntensity = slot.baseEmissiveIntensity;
				}
				lastEnsureFrameRef.current = 0;
			}
			return;
		}

		// Lazy material clone: wait until the first frame we actually
		// need to flash, then traverse the mesh and clone its
		// materials. The mesh is mounted by EnemyMesh and registered
		// into meshLookup, so it's available by the time the first hit
		// lands. If the mesh isn't registered yet (very early frame),
		// skip — flash will pick up on the next frame.
		if (!slotsRef.current) {
			const mesh = meshLookup.current.get(enemy.id);
			if (!mesh) return;
			const out: MaterialSlot[] = [];
			mesh.traverse((node) => {
				const m = node as THREE.Mesh;
				if (!m.isMesh) return;
				const cloneOne = (mat: THREE.Material) => {
					if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat;
					const std = mat as THREE.MeshStandardMaterial;
					const cloned = std.clone();
					out.push({
						material: cloned,
						baseColor: cloned.color.clone(),
						baseEmissive: cloned.emissive.clone(),
						baseEmissiveIntensity: cloned.emissiveIntensity,
					});
					return cloned;
				};
				if (Array.isArray(m.material)) {
					m.material = m.material.map(cloneOne);
				} else {
					m.material = cloneOne(m.material);
				}
			});
			slotsRef.current = out;
		}

		const t = flashAge / FLASH_MS;
		const ease = (1 - t) * (1 - t); // ease-out quad — peak at t=0
		lastEnsureFrameRef.current = now;
		for (const slot of slotsRef.current) {
			slot.material.color.copy(slot.baseColor).lerp(WHITE, ease);
			slot.material.emissive.copy(slot.baseEmissive).lerp(BLOOD_RED, ease);
			slot.material.emissiveIntensity = slot.baseEmissiveIntensity + ease * 2.0;
		}
	});

	return null;
}
