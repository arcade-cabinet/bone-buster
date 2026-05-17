import { Group, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
	chunkInstances,
	composeInstanceMatrix,
	findAllMeshes,
	findFirstMesh,
} from "../../scene/render/InstancedField";

/**
 * PB3 — InstancedMultiGltfField composition math.
 *
 * The multi-mesh wrapper needs to render each sub-mesh of a GLB at
 *   final_world = instance_matrix × local_matrix × vertex
 * so the original mesh-to-mesh spatial relationship is preserved
 * inside each placed instance.
 *
 * These tests pin the math without spinning up a renderer.
 */

function makeScene(): Group {
	// Build a fake GLB scene: a parent group at origin holding two
	// sub-meshes — one offset +1 on X, one offset +2 on Y. Named so the
	// traversal-order tests can assert identity instead of just geometry
	// type — both meshes are PlaneGeometry, so without distinct names a
	// regression that returned subB first would silently pass.
	const scene = new Group();
	scene.name = "scene-root";

	const subA = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
	subA.name = "subA";
	subA.position.set(1, 0, 0);

	const subB = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
	subB.name = "subB";
	subB.position.set(0, 2, 0);

	scene.add(subA, subB);
	return scene;
}

describe("PB3 findFirstMesh / findAllMeshes", () => {
	it("findFirstMesh returns null for an empty scene", () => {
		const empty = new Group();
		expect(findFirstMesh(empty)).toBeNull();
	});

	it("findFirstMesh returns the first traversed mesh", () => {
		const scene = makeScene();
		const first = findFirstMesh(scene);
		expect(first).not.toBeNull();
		// Children are traversed in insertion order — subA is first.
		// Assert by name (not geometry type) since both sub-meshes are
		// PlaneGeometry — a regression that returned subB first would
		// otherwise silently pass.
		expect(first?.name).toBe("subA");
	});

	it("findAllMeshes returns every Mesh in traversal order", () => {
		const scene = makeScene();
		const all = findAllMeshes(scene);
		expect(all).toHaveLength(2);
	});

	it("findAllMeshes returns an empty array for a scene with no meshes", () => {
		const empty = new Group();
		expect(findAllMeshes(empty)).toEqual([]);
	});

	it("findAllMeshes captures the local-relative-to-scene transform for each sub-mesh", () => {
		const scene = makeScene();
		const all = findAllMeshes(scene);
		// subA was offset +1 X.
		const aPos = new Vector3().setFromMatrixPosition(all[0].localMatrix);
		expect(aPos.x).toBeCloseTo(1, 5);
		expect(aPos.y).toBeCloseTo(0, 5);
		expect(aPos.z).toBeCloseTo(0, 5);
		// subB was offset +2 Y.
		const bPos = new Vector3().setFromMatrixPosition(all[1].localMatrix);
		expect(bPos.x).toBeCloseTo(0, 5);
		expect(bPos.y).toBeCloseTo(2, 5);
		expect(bPos.z).toBeCloseTo(0, 5);
	});

	it("composing instance × local yields the expected world position", () => {
		const scene = makeScene();
		const all = findAllMeshes(scene);

		// Place an instance at (10, 0, 20) with yaw 0.
		composeInstanceMatrix({ id: 0, position: { x: 10, y: 20 }, yaw: 0 });
		// Multiply the local matrix into the scratch in place — same op
		// the renderer does.
		const composed = new Matrix4().copy(
			// composeInstanceMatrix returns the scratch; we copy it before
			// post-multiplying so this test doesn't depend on whether the
			// scratch is the same instance.
			composeInstanceMatrix({ id: 0, position: { x: 10, y: 20 }, yaw: 0 }),
		);
		composed.multiply(all[0].localMatrix);
		const worldA = new Vector3().setFromMatrixPosition(composed);
		// subA local +1 X, instance at (10,?,20) → world (11, 0, 20).
		expect(worldA.x).toBeCloseTo(11, 5);
		expect(worldA.y).toBeCloseTo(0, 5);
		expect(worldA.z).toBeCloseTo(20, 5);
	});

	it("composing instance × local respects yaw rotation order", () => {
		// Yaw-only test: at yaw 0 with translation-only locals, instance×local
		// and local×instance produce the same result — so the yaw=0 test
		// above can't catch a `premultiply`/order-swap regression. Use a
		// 90° yaw so the order matters: the sub-mesh's local +1 X offset
		// should rotate into the instance's local frame, landing at
		// world (instance.x + 0, instance.y, instance.z - 1) for subA.
		const scene = makeScene();
		const all = findAllMeshes(scene);

		const composed = new Matrix4().copy(
			composeInstanceMatrix({ id: 0, position: { x: 10, y: 20 }, yaw: Math.PI / 2 }),
		);
		composed.multiply(all[0].localMatrix);
		const worldA = new Vector3().setFromMatrixPosition(composed);

		// Three.js rotates around +Y (Y_AXIS in InstancedField). With yaw
		// = π/2, the local +X axis maps to world −Z. subA local is (+1, 0, 0),
		// so the rotated offset is (0, 0, −1); add instance position
		// (10, 0, 20) → world (10, 0, 19).
		expect(worldA.x).toBeCloseTo(10, 5);
		expect(worldA.y).toBeCloseTo(0, 5);
		expect(worldA.z).toBeCloseTo(19, 5);

		// Sanity: reversed order (local × instance) would give a different
		// answer. If someone swaps `composed.multiply(local)` to
		// `composed.premultiply(local)`, this assertion would catch it
		// because premultiply effectively does local × instance.
		const reversed = new Matrix4()
			.copy(all[0].localMatrix)
			.multiply(composeInstanceMatrix({ id: 0, position: { x: 10, y: 20 }, yaw: Math.PI / 2 }));
		const worldReversed = new Vector3().setFromMatrixPosition(reversed);
		// Reversed: instance position rotates around origin instead. The
		// concrete numbers don't matter — we only need to prove the two
		// orders DON'T match, so a regression that swaps them would fail
		// the canonical assertion above.
		const dx = worldReversed.x - worldA.x;
		const dz = worldReversed.z - worldA.z;
		expect(Math.hypot(dx, dz)).toBeGreaterThan(1);
	});
});

describe("PB3 fold — chunkInstances", () => {
	it("returns [] for empty input", () => {
		expect(chunkInstances([], 4)).toEqual([]);
	});

	it("returns one batch when items.length <= size", () => {
		expect(chunkInstances([1, 2, 3], 4)).toEqual([[1, 2, 3]]);
		expect(chunkInstances([1, 2, 3, 4], 4)).toEqual([[1, 2, 3, 4]]);
	});

	it("splits into N batches of `size` plus a smaller tail", () => {
		// The regression this guards: prior LargePropField cap of 16
		// silently dropped every instance past index 15 for a URL.
		// chunkInstances must emit a full additional batch for the
		// remainder, not a truncation.
		const items = Array.from({ length: 35 }, (_, i) => i);
		const chunks = chunkInstances(items, 16);
		expect(chunks).toHaveLength(3);
		expect(chunks[0]).toHaveLength(16);
		expect(chunks[1]).toHaveLength(16);
		expect(chunks[2]).toHaveLength(3);
		// Every item is preserved (no truncation).
		expect(chunks.flat()).toEqual(items);
	});

	it("preserves input order across batches", () => {
		const items = [10, 20, 30, 40, 50, 60, 70];
		const chunks = chunkInstances(items, 3);
		expect(chunks.flat()).toEqual(items);
	});

	it("throws when size <= 0 (caller bug)", () => {
		expect(() => chunkInstances([1, 2], 0)).toThrow(/size must be > 0/);
		expect(() => chunkInstances([1, 2], -1)).toThrow(/size must be > 0/);
	});
});
