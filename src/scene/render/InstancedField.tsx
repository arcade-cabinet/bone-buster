/**
 * ARCHETYPE INTERLEAVE A1 — generic instanced-mesh scatter factory.
 *
 * Replaces the per-instance `<group><primitive>` pattern used by
 * DebrisField / KitchenField / etc. with a single `<instancedMesh>`
 * per kind. Each instance's world transform is written via
 * setMatrixAt so the GPU draws N instances in 1 draw call instead
 * of N draw calls.
 *
 * Two component forms keep the rules-of-hooks clean:
 *
 *   InstancedField — caller passes (geometry, material). Use for
 *     procedural sources.
 *
 *   InstancedGltfField — caller passes (url). Use for GLB-backed
 *     scatter (debris, kitchen props, etc). Wraps useGLTF + the
 *     first-Mesh extractor and feeds the resolved (geometry, material)
 *     into InstancedField underneath.
 */

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

// QW3-shaped module-scope scratch — reused across all composeInstanceMatrix
// calls in this module. Three.js's `InstancedMesh.setMatrixAt(i, m)` copies
// `m` into its own internal buffer, so the caller can safely mutate one
// shared Matrix4 per render pass.
const SCRATCH_MATRIX = /*@__PURE__*/ new Matrix4();
const SCRATCH_POSITION = /*@__PURE__*/ new Vector3();
const SCRATCH_QUAT = /*@__PURE__*/ new Quaternion();
const SCRATCH_SCALE = /*@__PURE__*/ new Vector3();
const Y_AXIS = /*@__PURE__*/ new Vector3(0, 1, 0);

export type InstancedFieldInstance = Readonly<{
	id: number;
	position: { x: number; y: number };
	yaw: number;
	scale?: number;
}>;

export type InstancedFieldProps = Readonly<{
	geometry: BufferGeometry;
	material: Material | readonly Material[];
	instances: readonly InstancedFieldInstance[];
	/**
	 * Hard cap on instances rendered. Pre-allocates the InstancedMesh
	 * buffer at mount time. Mount-time only — changing the cap remounts
	 * the InstancedMesh. Default 256.
	 */
	maxInstances?: number;
}>;

export type InstancedGltfFieldProps = Readonly<{
	url: string;
	instances: readonly InstancedFieldInstance[];
	maxInstances?: number;
}>;

/**
 * Compose a world-space Matrix4 for one instance, into the shared
 * SCRATCH_MATRIX. Caller MUST consume the matrix immediately (e.g.
 * `im.setMatrixAt(i, composeInstanceMatrix(inst))`) since the next
 * call overwrites it. Exported for unit testing.
 */
export function composeInstanceMatrix(inst: InstancedFieldInstance): Matrix4 {
	SCRATCH_POSITION.set(inst.position.x, 0, inst.position.y);
	SCRATCH_QUAT.setFromAxisAngle(Y_AXIS, inst.yaw);
	const s = inst.scale ?? 1;
	SCRATCH_SCALE.set(s, s, s);
	SCRATCH_MATRIX.compose(SCRATCH_POSITION, SCRATCH_QUAT, SCRATCH_SCALE);
	return SCRATCH_MATRIX;
}

/**
 * Locate the first Mesh inside a loaded GLB scene. Returns null if
 * no Mesh found (caller falls back to non-instanced path).
 */
export function findFirstMesh(scene: Object3D): Mesh | null {
	let found: Mesh | null = null;
	scene.traverse((child) => {
		if (!found && (child as Mesh).isMesh) {
			found = child as Mesh;
		}
	});
	return found;
}

/**
 * (geometry, material) form. Use for procedural sources.
 */
export function InstancedField({
	geometry,
	material,
	instances,
	maxInstances = 256,
}: InstancedFieldProps) {
	const meshRef = useRef<InstancedMesh | null>(null);

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

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material as Material, maxInstances]}
			castShadow
			receiveShadow
		/>
	);
}

/**
 * GLB-source convenience wrapper. Loads the GLB, pulls its first
 * Mesh, and feeds the resolved (geometry, material) into
 * InstancedField. Returns null when the GLB has no mesh.
 */
export function InstancedGltfField({
	url,
	instances,
	maxInstances = 256,
}: InstancedGltfFieldProps) {
	const gltf = useGLTF(url);
	const sourceMesh = useMemo(() => findFirstMesh(gltf.scene), [gltf.scene]);
	if (!sourceMesh) return null;
	return (
		<InstancedField
			geometry={sourceMesh.geometry}
			material={sourceMesh.material as Material | readonly Material[]}
			instances={instances}
			maxInstances={maxInstances}
		/>
	);
}
