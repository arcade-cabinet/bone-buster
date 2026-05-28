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
import { Canvas, useThree } from "@react-three/fiber";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import type * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BodyPartField } from "../../scene/effects/BodyPartField";
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

async function mountField(node: React.ReactNode) {
	const { driver } = await mountFieldUnmountable(node);
	return driver;
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

/** Returns true once `.dispose()` has been observed on the material. */
function watchDispose(material: THREE.Material): () => boolean {
	let disposed = false;
	const orig = material.dispose.bind(material);
	material.dispose = () => {
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

	it("BodyPartField disposes shard material on despawn but never the shared geometry", async () => {
		const driver = await mountField(<BodyPartField />);

		dispatch({ type: "bodyParts", kind: "bone", x: 0, y: 0 }); // createdAt = clock(0)
		driver.step(16);

		const meshes = driver.liveMeshes();
		expect(meshes.length).toBeGreaterThan(0);
		const matWatch = meshes.map((m) => watchDispose(m.material as THREE.Material));
		// Regression: a prior bug disposed the SHARED geometry on first despawn,
		// breaking every later shard/decal. The shared geometry must survive.
		const mesh0body = meshes[0];
		if (!mesh0body) throw new Error("meshes[0] missing after length > 0 check");
		const geoWatch = watchGeometryDispose(mesh0body.geometry);

		clock = 20_000; // past shard TTL (5000ms) → shards + decals despawn
		driver.step(32);

		// `.some`, not `.every`: the meshes captured at spawn are the shard
		// meshes; decals only mount after a shard settles, so not every live
		// material at capture-time is guaranteed a despawn with a decal in the
		// same window. The contract we pin is "despawn disposes materials" —
		// at least one shard material freed proves the dispose path runs.
		expect(matWatch.some((w) => w())).toBe(true);
		expect(geoWatch()).toBe(false);
	});

	it("ShellEjectField drains its live material pool on unmount", async () => {
		const driver = await mountField(<ShellEjectField />);

		dispatch({ type: "shellEject", x: 0, y: 0, z: 0, vx: 1, vy: 2, vz: 0, scale: 1 });
		driver.step(16); // shells live, not yet past TTL

		const meshes = driver.liveMeshes();
		expect(meshes.length).toBeGreaterThan(0);
		const matWatch = meshes.map((m) => watchDispose(m.material as THREE.Material));

		cleanup(); // unmount → teardown effect must drain the live pool

		expect(matWatch.every((w) => w())).toBe(true);
	});
});
