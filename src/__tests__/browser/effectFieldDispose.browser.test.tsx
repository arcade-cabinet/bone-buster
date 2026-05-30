/**
 * Browser test (real Chromium + WebGL) for the effect-field GPU-resource
 * contract surfaced by the comprehensive review (Phase 2 H2 / Phase 3 F1).
 *
 * The three despawning effect fields (ParticleBurstField, ShellEjectField,
 * BodyPartField) create one per-instance MeshStandardMaterial per particle
 * and used to remove the mesh on despawn WITHOUT disposing its material —
 * a monotonic GPU leak invisible to the FPS/draw-call perf gate (it only
 * shows up as a GC hitch). This pins the contract:
 *
 *  1. on despawn, each per-instance material gets .dispose() called
 *  2. the shared module-scope geometry is NEVER disposed (it's reused)
 *  3. on unmount, the still-live pool's materials are disposed
 *
 * We drive the r3f frame loop deterministically via the Canvas store's
 * `advance(time)` (frameloop="never") instead of wall-clock useFrame, so
 * the test is timing-independent. Each material is wrapped with its OWN
 * dispose spy (captured from the field's group) so we don't depend on
 * global prototype-level call counts, which other mounts/teardowns touch.
 */

import { dispatch } from "@engine/events";
import type { Enemy } from "@engine/mapTypes";
import { Canvas, useThree } from "@react-three/fiber";
import { cleanup, render } from "@testing-library/react";
import { createRef, useEffect } from "react";
import type * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BodyPartField } from "../../scene/effects/BodyPartField";
import { GhostTrailField } from "../../scene/effects/GhostTrailField";
import { ParticleBurstField } from "../../scene/effects/ParticleBurstField";
import { ShellEjectField } from "../../scene/effects/ShellEjectField";

// The fields read wall-clock `performance.now()` for spawn time + TTL
// expiry, so we control it via vi.spyOn (safer than reassigning the
// global — performance.now can be read-only in some environments, and
// vi.restoreAllMocks guarantees cleanup): spawn at t=0, then jump the
// clock past the TTL and step one frame to drive despawn deterministically.
let clock = 0;
beforeEach(() => {
	clock = 0;
	vi.spyOn(performance, "now").mockImplementation(() => clock);
});
afterEach(() => {
	vi.restoreAllMocks();
	cleanup();
});

function CaptureScene({
	onReady,
}: {
	onReady: (advance: (t: number) => void, scene: THREE.Scene) => void;
}) {
	const advance = useThree((s) => s.advance);
	const scene = useThree((s) => s.scene);
	useEffect(() => {
		onReady(advance, scene);
	}, [advance, onReady, scene]);
	return null;
}

async function mountFieldUnmountable(node: React.ReactNode) {
	let advance!: (t: number) => void;
	let scene!: THREE.Scene;
	const result = render(
		<Canvas frameloop="never">
			<CaptureScene
				onReady={(a, s) => {
					advance = a;
					scene = s;
				}}
			/>
			{node}
		</Canvas>,
	);
	await vi.waitFor(() => {
		if (!scene) throw new Error("scene not ready");
	});
	const driver = {
		step(timeMs: number) {
			advance(timeMs / 1000);
		},
		/** All meshes currently in the scene graph (the field's live pool). */
		liveMeshes(): THREE.Mesh[] {
			const out: THREE.Mesh[] = [];
			scene.traverse((o) => {
				if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
			});
			return out;
		},
	};
	return { driver, unmount: () => result.unmount() };
}

/** Generic: returns true once `.dispose()` has been observed on the object. */
function watchObjDispose(obj: { dispose: () => void }): () => boolean {
	let disposed = false;
	const orig = obj.dispose.bind(obj);
	obj.dispose = () => {
		disposed = true;
		orig();
	};
	return () => disposed;
}

/** Returns true if the geometry's dispose is ever called (it must NOT be). */
function watchGeometryDispose(geometry: THREE.BufferGeometry): () => boolean {
	let disposed = false;
	const orig = geometry.dispose.bind(geometry);
	geometry.dispose = () => {
		disposed = true;
		orig();
	};
	return () => disposed;
}

describe("effect-field GPU-resource disposal (H2 / F1)", () => {
	it("ParticleBurstField renders ONE InstancedMesh for all motes and disposes it on unmount", async () => {
		// CR-H1perf — converted from per-mote Mesh+material to a single
		// InstancedMesh (1 draw call). The leak that H2 fixed is now
		// structurally impossible (no per-instance materials); the contract
		// becomes: exactly one mesh regardless of mote count, and it's
		// disposed on unmount (shared geometry + material survive).
		const { driver, unmount } = await mountFieldUnmountable(<ParticleBurstField />);

		dispatch({ type: "burst", kind: "damage", x: 0, y: 0 });
		driver.step(16); // first tick → InstancedMesh created + motes written

		const meshes = driver.liveMeshes();
		// One InstancedMesh, not one-per-mote.
		expect(meshes.length).toBe(1);
		const inst = meshes[0] as THREE.InstancedMesh;
		expect(inst.isInstancedMesh).toBe(true);
		expect(inst.count).toBeGreaterThan(0); // motes are drawn
		const meshDisposed = watchObjDispose(inst); // InstancedMesh.dispose
		const geoWatch = watchGeometryDispose(inst.geometry); // shared MOTE_GEOMETRY

		unmount();
		expect(meshDisposed()).toBe(true); // InstancedMesh freed
		expect(geoWatch()).toBe(false); // shared geometry untouched
	});

	it("BodyPartField renders exactly two InstancedMeshes (shards + decals), disposed on unmount", async () => {
		// CR-H1perf — converted to two InstancedMeshes (shard pool + decal
		// pool), 1 draw call each, instead of one Mesh per shard + per decal.
		const { driver, unmount } = await mountFieldUnmountable(<BodyPartField />);

		dispatch({ type: "bodyParts", kind: "bone", x: 0, y: 0 });
		driver.step(16); // pools created + shards written

		const meshes = driver.liveMeshes();
		expect(meshes.length).toBe(2); // shard pool + decal pool, not N gibs
		for (const m of meshes) expect((m as THREE.InstancedMesh).isInstancedMesh).toBe(true);
		const shardMesh = meshes.find((m) => (m as THREE.InstancedMesh).count > 0);
		expect(shardMesh).toBeDefined(); // shards are drawn
		const disposeWatches = meshes.map((m) =>
			watchObjDispose(m as unknown as { dispose: () => void }),
		);
		const geoWatches = meshes.map((m) => watchGeometryDispose(m.geometry));

		unmount();
		expect(disposeWatches.every((w) => w())).toBe(true); // both InstancedMeshes freed
		expect(geoWatches.some((w) => w())).toBe(false); // shared geometries untouched
	});

	it("GhostTrailField renders one InstancedMesh (pooled wake), disposed on unmount", async () => {
		// GH-TRAIL — pooled spectral wake. The pool is built in useEffect (not the
		// render body) and the Wake records are a pre-allocated ring (no per-emit
		// alloc). Contract: one InstancedMesh for all motes, disposed on unmount,
		// shared geometry untouched (review BP-1..BP-4 / T-3).
		const enemy = {
			id: 1,
			position: { x: 0, y: 0 },
			dead: false,
		} as Enemy;
		const enemiesRef = createRef<Enemy[]>() as { current: Enemy[] };
		enemiesRef.current = [enemy];

		const { driver, unmount } = await mountFieldUnmountable(
			<GhostTrailField enemiesRef={enemiesRef} hasUvFlashlight={false} />,
		);

		driver.step(16); // first tick → pool created in effect already; emit a mote

		const meshes = driver.liveMeshes();
		expect(meshes.length).toBe(1);
		const inst = meshes[0] as THREE.InstancedMesh;
		expect(inst.isInstancedMesh).toBe(true);
		const meshDisposed = watchObjDispose(inst);
		const geoWatch = watchGeometryDispose(inst.geometry);

		unmount();
		expect(meshDisposed()).toBe(true);
		expect(geoWatch()).toBe(false);
	});

	it("ShellEjectField renders one InstancedMesh, disposed on unmount", async () => {
		const { driver, unmount } = await mountFieldUnmountable(<ShellEjectField />);

		dispatch({ type: "shellEject", x: 0, y: 0, z: 0, vx: 1, vy: 2, vz: 0, scale: 1 });
		driver.step(16);

		const meshes = driver.liveMeshes();
		expect(meshes.length).toBe(1);
		const inst = meshes[0] as THREE.InstancedMesh;
		expect(inst.isInstancedMesh).toBe(true);
		expect(inst.count).toBeGreaterThan(0);
		const meshDisposed = watchObjDispose(inst);
		const geoWatch = watchGeometryDispose(inst.geometry);

		unmount();
		expect(meshDisposed()).toBe(true);
		expect(geoWatch()).toBe(false);
	});
});
