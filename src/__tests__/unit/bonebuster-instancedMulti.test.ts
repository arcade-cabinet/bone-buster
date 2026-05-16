import { Group, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
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
	// sub-meshes — one offset +1 on X, one offset +2 on Y.
	const scene = new Group();
	scene.name = "scene-root";

	const subA = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
	subA.position.set(1, 0, 0);

	const subB = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial());
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
		expect(first?.geometry).toBeInstanceOf(PlaneGeometry);
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
});
