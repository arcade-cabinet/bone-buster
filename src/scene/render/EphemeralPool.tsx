/**
 * ARCHETYPE INTERLEAVE A2 — generic ephemeral-instance pool.
 *
 * Replaces the per-frame mount/unmount pattern used by BodyPartField /
 * ShellEjectField / ParticleBurstField / BulletField with a single
 * pre-allocated InstancedMesh sized to the pool cap. Each slot is
 * either "live" (visible matrix) or "expired" (scale-to-zero matrix
 * so the GPU draws nothing for it). Expired slots are reclaimed by
 * the next allocation.
 *
 * The contract on the caller side is identical to InstancedField:
 *   - url: single GLB to instance
 *   - instances: caller-managed array; expired entries flagged
 *     via `expired: true` get scale-to-zero matrices
 *
 * Reclamation:
 *   - allocSlot(pool, instance) returns the slot index assigned;
 *     overwrites the first expired slot, or extends if pool not
 *     yet full.
 *   - markExpired(pool, slotIdx) flips the slot's `expired` flag
 *     so the next render scale-zeros it.
 *
 * Step-1 ships the factory + unit test for the allocation/reclamation
 * lifecycle. Migration of an existing ephemeral component is step-2.
 */

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";
import { composeInstanceMatrix, findFirstMesh } from "./InstancedField";

export type EphemeralPoolSlot = {
	id: number;
	position: { x: number; y: number };
	yaw: number;
	scale?: number;
	expired: boolean;
};

export type EphemeralPoolProps = Readonly<{
	url: string;
	slots: readonly EphemeralPoolSlot[];
	maxSlots?: number;
}>;

/**
 * Allocate a slot in the pool. Returns the index assigned. Reclaims
 * the first expired slot; extends if no expired slots and pool not
 * full; returns -1 if pool is full and no expired slots exist.
 *
 * Exported for unit testing the lifecycle.
 */
export function allocSlot(slots: EphemeralPoolSlot[], maxSlots: number): number {
	for (let i = 0; i < slots.length; i += 1) {
		if (slots[i].expired) return i;
	}
	if (slots.length < maxSlots) return slots.length;
	return -1;
}

/**
 * Compose a zero-scale matrix for an expired slot. Exported so the
 * lifecycle test can pin the contract that expired slots produce
 * matrices with det=0.
 */
export function composeExpiredMatrix(): Matrix4 {
	const m = new Matrix4();
	const position = new Vector3(0, 0, 0);
	const quat = new Quaternion();
	const scale = new Vector3(0, 0, 0);
	m.compose(position, quat, scale);
	return m;
}

export function EphemeralPool({ url, slots, maxSlots = 128 }: EphemeralPoolProps) {
	const gltf = useGLTF(url);
	const meshRef = useRef<InstancedMesh | null>(null);

	const sourceMesh = useMemo(() => findFirstMesh(gltf.scene), [gltf.scene]);

	useEffect(() => {
		const im = meshRef.current;
		if (!im) return;
		const cap = Math.min(slots.length, maxSlots);
		for (let i = 0; i < cap; i += 1) {
			const slot = slots[i];
			if (slot.expired) {
				im.setMatrixAt(i, composeExpiredMatrix());
			} else {
				im.setMatrixAt(i, composeInstanceMatrix(slot));
			}
		}
		im.count = cap;
		im.instanceMatrix.needsUpdate = true;
	}, [slots, maxSlots]);

	if (!sourceMesh) return null;

	return (
		<instancedMesh
			ref={meshRef}
			args={[sourceMesh.geometry, sourceMesh.material, maxSlots]}
			castShadow
			receiveShadow
		/>
	);
}
