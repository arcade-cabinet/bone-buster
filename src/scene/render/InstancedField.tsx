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
 * PB3 — group an array of items by url for InstancedMultiGltfField
 * mounting. Shared by every scatter field that uses a per-instance
 * `{ url, ... }` shape (PropField, LargePropField, DebrisField).
 *
 * Returns array of `[url, items]` entries (insertion-order preserved).
 * Use inside `useMemo` keyed on the items array so React re-renders
 * don't rebuild the groups on every parent tick.
 */
export function groupByUrl<T>(
	items: readonly T[],
	urlOf: (item: T) => string,
): Array<[string, T[]]> {
	const byUrl = new Map<string, T[]>();
	for (const item of items) {
		const url = urlOf(item);
		let bucket = byUrl.get(url);
		if (!bucket) {
			bucket = [];
			byUrl.set(url, bucket);
		}
		bucket.push(item);
	}
	return Array.from(byUrl.entries());
}

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
 * PB3 — collect every Mesh inside a loaded GLB scene with the local
 * matrix it carries in world-space relative to the scene root. Lets
 * `InstancedMultiGltfField` render multi-mesh props (cages, RVs, loot
 * GLBs with 27+ baked sub-meshes) as one InstancedMesh per sub-mesh
 * while preserving the original mesh-to-mesh spatial relationships.
 *
 * Returns array of `{ geometry, material, localMatrix }`. Empty array
 * means the GLB has no meshes — caller can fall back to non-instanced
 * rendering.
 */
export function findAllMeshes(scene: Object3D): Array<{
	geometry: BufferGeometry;
	material: Material | readonly Material[];
	localMatrix: Matrix4;
}> {
	const out: Array<{
		geometry: BufferGeometry;
		material: Material | readonly Material[];
		localMatrix: Matrix4;
	}> = [];
	// Ensure world matrices are up to date — the GLB loader should
	// have done this, but a re-traversal after any in-place transforms
	// would break otherwise.
	scene.updateMatrixWorld(true);
	// scene-inverse is constant for the whole GLB — compute once outside
	// the traversal instead of inverting per sub-mesh.
	const sceneInverse = new Matrix4().copy(scene.matrixWorld).invert();
	// `traverseVisible` (not `traverse`) so meshes hidden by the GLB's
	// own `visible: false` flags stay hidden — matches the prior
	// `SkeletonUtils.clone(scene)` + `<primitive>` path which preserved
	// the visibility tree. Some GLBs ship LOD placeholders or
	// gameplay-toggled meshes off by default.
	scene.traverseVisible((child) => {
		if ((child as Mesh).isMesh) {
			const mesh = child as Mesh;
			// Capture the mesh-relative-to-scene transform. The InstancedMesh
			// will apply the instance transform on top so the final world
			// position = instanceMatrix × localMatrix × vertex.
			const localMatrix = new Matrix4().copy(mesh.matrixWorld).premultiply(sceneInverse);
			out.push({
				geometry: mesh.geometry,
				material: mesh.material as Material | readonly Material[],
				localMatrix,
			});
		}
	});
	return out;
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
			// three's InstancedMesh accepts `Material | Material[]` at
			// runtime, but r3f's `<instancedMesh args>` typing exposes
			// only the single-material variant. The cast bridges that
			// gap; the runtime behaviour is correct for both.
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
 *
 * PB3 — for SINGLE-mesh GLBs only. Multi-mesh GLBs (cages, RVs, loot,
 * Mega_Nature.glb, etc) silently lose every mesh except the first
 * here — use `InstancedMultiGltfField` instead.
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

/**
 * PB3 — multi-mesh GLB instancing.
 *
 * For each sub-mesh inside the GLB, emits one InstancedMesh whose
 * per-instance matrix is the composition of the instance transform
 * (position + yaw + scale, same as `InstancedField`) and the sub-mesh's
 * own local-relative-to-scene transform. The result on screen matches
 * what the previous `SkeletonUtils.clone(scene)` + `<primitive>` path
 * produced — every sub-mesh ends up at its correct world position
 * relative to the instance root — but each sub-mesh is now batched
 * across all instances in a single draw call.
 *
 * For a 27-mesh `loot/Books.glb` placed at 5 sectors, this drops the
 * draw call count from 27×5 = 135 to 27 (one InstancedMesh per sub-mesh,
 * each batching 5 instances).
 */
export function InstancedMultiGltfField({
	url,
	instances,
	maxInstances = 256,
}: InstancedGltfFieldProps) {
	const gltf = useGLTF(url);
	const submeshes = useMemo(() => findAllMeshes(gltf.scene), [gltf.scene]);
	if (submeshes.length === 0) return null;
	return (
		<>
			{submeshes.map((sub, i) => (
				<InstancedMultiSubmesh
					// biome-ignore lint/suspicious/noArrayIndexKey: `i` is stable per-GLB — submeshes derive from the loader's scene-graph traversal order, which is fixed by the GLB file structure. The array never reorders or shrinks across renders.
					key={i}
					geometry={sub.geometry}
					material={sub.material}
					localMatrix={sub.localMatrix}
					instances={instances}
					maxInstances={maxInstances}
				/>
			))}
		</>
	);
}

function InstancedMultiSubmesh({
	geometry,
	material,
	localMatrix,
	instances,
	maxInstances,
}: {
	geometry: BufferGeometry;
	material: Material | readonly Material[];
	localMatrix: Matrix4;
	instances: readonly InstancedFieldInstance[];
	maxInstances: number;
}) {
	const meshRef = useRef<InstancedMesh | null>(null);

	useEffect(() => {
		const im = meshRef.current;
		if (!im) return;
		const cap = Math.min(instances.length, maxInstances);
		for (let i = 0; i < cap; i += 1) {
			// Multiply local sub-mesh transform on the RIGHT of the
			// instance transform so the final composition is
			// `instance × local × vertex`. composeInstanceMatrix writes
			// into SCRATCH_MATRIX in place; we then post-multiply
			// localMatrix to add the sub-mesh offset before InstancedMesh
			// copies the matrix into its internal buffer.
			composeInstanceMatrix(instances[i]);
			SCRATCH_MATRIX.multiply(localMatrix);
			im.setMatrixAt(i, SCRATCH_MATRIX);
		}
		im.count = cap;
		im.instanceMatrix.needsUpdate = true;
	}, [instances, maxInstances, localMatrix]);

	return (
		<instancedMesh
			ref={meshRef}
			// three's InstancedMesh accepts `Material | Material[]` at
			// runtime, but r3f's `<instancedMesh args>` typing exposes
			// only the single-material variant. The cast bridges that
			// gap; the runtime behaviour is correct for both.
			args={[geometry, material as Material, maxInstances]}
			castShadow
			receiveShadow
		/>
	);
}
