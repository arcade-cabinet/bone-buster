/**
 * PREP-BP1 — browser test (real Chromium + WebGL) pinning the WaterSurface
 * GPU-resource contract surfaced by the comprehensive review (BP-1).
 *
 * WaterSurface builds a 64×64 RGBA DataTexture in a useMemo. The <shapeGeometry>
 * is R3F-managed (freed on unmount), but the texture we `new` ourselves is a GPU
 * resource that leaks one allocation per water sector on every map load unless
 * explicitly disposed. This pins: on unmount, the DataTexture gets .dispose().
 *
 * We capture the texture instance off the scene's material and wrap its dispose
 * with a spy, then assert the spy fires on unmount.
 */

import type { MapSector } from "@engine/mapTypes";
import { Canvas, useThree } from "@react-three/fiber";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaterSurface } from "../../scene/map/WaterSurface";

afterEach(() => {
	cleanup();
});

// Minimal square water sector — only the fields WaterSurface reads.
const SECTOR = {
	vertices: [
		{ x: 0, y: 0 },
		{ x: 4, y: 0 },
		{ x: 4, y: 4 },
		{ x: 0, y: 4 },
	],
	floorHeight: 0,
	isWater: true,
} as unknown as MapSector;

function CaptureScene({ onReady }: { onReady: (scene: THREE.Scene) => void }) {
	const scene = useThree((s) => s.scene);
	useEffect(() => {
		onReady(scene);
	}, [onReady, scene]);
	return null;
}

describe("PREP-BP1 — WaterSurface DataTexture disposal", () => {
	it("disposes its DataTexture on unmount", async () => {
		let scene!: THREE.Scene;
		const result = render(
			<Canvas frameloop="never">
				<CaptureScene onReady={(s) => (scene = s)} />
				<WaterSurface sector={SECTOR} color="#3a7bd5" />
			</Canvas>,
		);
		await vi.waitFor(() => {
			if (!scene) throw new Error("scene not ready");
		});

		// Find the water mesh's material map (the DataTexture) and spy its dispose.
		let tex: THREE.Texture | null = null;
		scene.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (mesh.isMesh) {
				const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
				if (mat?.map instanceof THREE.DataTexture) tex = mat.map;
			}
		});
		expect(tex).not.toBeNull();
		const disposeSpy = vi.spyOn(tex as unknown as THREE.Texture, "dispose");

		result.unmount();

		expect(disposeSpy).toHaveBeenCalledTimes(1);
	});
});
