/**
 * ARCHETYPE INTERLEAVE A1 — generic instanced-mesh scatter factory.
 *
 * Replaces the per-instance `<group><primitive>` pattern used by
 * DebrisField / LampField / KitchenField / etc. with a single
 * `<instancedMesh>` per kind. Each instance's world transform is
 * written via setMatrixAt so the GPU draws N instances in 1 draw
 * call instead of N draw calls.
 *
 * Generic over the instance shape — caller provides:
 *   - url: the GLB to instance (single asset, single skin).
 *   - instances: array with { position, yaw, scale? } per instance.
 *   - count cap: hard ceiling so a runaway scatter never exceeds
 *     the pre-allocated InstancedMesh buffer.
 *
 * The factory does NOT compose multi-mesh GLBs — it pulls the
 * first Mesh found via `traverse`. Existing scatter assets are
 * single-mesh (the PSX pack workflow normalizes to this shape);
 * for multi-mesh GLBs the caller falls back to the non-instanced
 * `<primitive>` path until A1-step-2 generalizes.
 *
 * Step-1 in this commit:
 *   - factory exists + is unit-tested for the instance-transform
 *     math (matrix composition per instance is the surface that
 *     can silently regress).
 *   - One canonical migration target chosen (DebrisField) wired
 *     in a follow-up commit; this commit ships the factory alone
 *     so the failure list at the migration commit is just "wire
 *     the new component", not "build + wire + verify all in one."
 */

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh, Mesh } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

export type InstancedFieldInstance = Readonly<{
	id: number;
	position: { x: number; y: number };
	yaw: number;
	scale?: number;
}>;

export type InstancedFieldProps = Readonly<{
	/** GLB URL to instance. Must be a single-mesh asset. */
	url: string;
	/** Per-instance transforms. */
	instances: readonly InstancedFieldInstance[];
	/**
	 * Hard cap on instances rendered. Pre-allocates the InstancedMesh
	 * buffer at mount time. Mount-time only — changing the cap remounts
	 * the InstancedMesh. Default 256.
	 */
	maxInstances?: number;
}>;

/**
 * Compose a world-space Matrix4 for one instance.
 * Exported for unit testing — the matrix math is the
 * regression-prone surface of A1.
 */
export function composeInstanceMatrix(inst: InstancedFieldInstance): Matrix4 {
	const m = new Matrix4();
	const position = new Vector3(inst.position.x, 0, inst.position.y);
	const quat = new Quaternion();
	quat.setFromAxisAngle(new Vector3(0, 1, 0), inst.yaw);
	const scale = new Vector3(inst.scale ?? 1, inst.scale ?? 1, inst.scale ?? 1);
	m.compose(position, quat, scale);
	return m;
}

/**
 * Locate the first Mesh inside a loaded GLB scene. Returns null if
 * no Mesh found (caller falls back to non-instanced path).
 */
export function findFirstMesh(scene: import("three").Object3D): Mesh | null {
	let found: Mesh | null = null;
	scene.traverse((child) => {
		if (!found && (child as Mesh).isMesh) {
			found = child as Mesh;
		}
	});
	return found;
}

export function InstancedField({ url, instances, maxInstances = 256 }: InstancedFieldProps) {
	const gltf = useGLTF(url);
	const meshRef = useRef<InstancedMesh | null>(null);

	const sourceMesh = useMemo(() => findFirstMesh(gltf.scene), [gltf.scene]);

	useEffect(() => {
		const im = meshRef.current;
		if (!im) return;
		const cap = Math.min(instances.length, maxInstances);
		for (let i = 0; i < cap; i += 1) {
			im.setMatrixAt(i, composeInstanceMatrix(instances[i]));
		}
		im.count = cap;
		im.instanceMatrix.needsUpdate = true;
	}, [instances, maxInstances]);

	if (!sourceMesh) return null;

	return (
		<instancedMesh
			ref={meshRef}
			args={[sourceMesh.geometry, sourceMesh.material, maxInstances]}
			castShadow
			receiveShadow
		/>
	);
}
