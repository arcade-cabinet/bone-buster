/**
 * ARCHETYPE INTERLEAVE A1 — generic instanced-mesh scatter factory.
 *
 * Replaces the per-instance `<group><primitive>` pattern used by
 * DebrisField / LampField / KitchenField / etc. with a single
 * `<instancedMesh>` per kind. Each instance's world transform is
 * written via setMatrixAt so the GPU draws N instances in 1 draw
 * call instead of N draw calls.
 *
 * Two component forms keep the rules-of-hooks clean:
 *
 *   InstancedField — caller passes (geometry, material). Use for
 *     procedural sources (BodyPart / Shell / Bullet ephemeral
 *     components have module-scope shared geometry).
 *
 *   InstancedGltfField — caller passes (url). Use for GLB-backed
 *     scatter (debris, lamps, props). Wraps useGLTF + the first-Mesh
 *     extractor and feeds the resolved (geometry, material) into
 *     InstancedField underneath.
 *
 * Step-1 in this commit:
 *   - factories exist + are unit-tested for the instance-transform
 *     math (matrix composition per instance is the surface that
 *     can silently regress).
 *   - Migration of existing Field / Pool components to use these
 *     factories is step-2.
 */

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import type { BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";

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
