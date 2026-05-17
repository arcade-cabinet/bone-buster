import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CRUCIFIX_LIFETIME_MS, type CrucifixInstance } from "@world/ghostHunting";
import { TOOL_URLS } from "@world/tools";
import { useEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

/**
 * PC4 — renders the active list of placed crucifixes. Each instance
 * mounts the crucifix GLB at its (x, z) world position and slowly
 * rotates so the player can see it from a distance. Fades opacity
 * over the last 1.5s of its lifetime as a visual cue that the
 * debuff is expiring.
 *
 * The active list is owned by the Scene (state ref); this component
 * is the render-only consumer. Lifetime expiry is handled in Scene's
 * per-frame tick (the Scene prunes expired entries) — this component
 * just renders whatever is in the array.
 */
export function CrucifixField({
	crucifixes,
	version: _version,
}: {
	crucifixes: readonly CrucifixInstance[];
	/**
	 * Bumped by Scene whenever the underlying ref-backed active list
	 * mutates (push on place, filter on expiry). Re-renders this
	 * component without remounting children — each `CrucifixMesh` is
	 * keyed by `c.id` so additions/removals are minimal-diff and
	 * already-mounted crucifixes keep their accumulated yaw + fade
	 * state. The value itself is unused; only the prop change matters.
	 */
	version: number;
}) {
	return (
		<>
			{crucifixes.map((c) => (
				<CrucifixMesh key={c.id} crucifix={c} />
			))}
		</>
	);
}

function CrucifixMesh({ crucifix }: { crucifix: CrucifixInstance }) {
	const gltf = useGLTF(TOOL_URLS.crucifix);
	// PC4 review fix — `SkeletonUtils.clone(scene)` clones the scene
	// graph but materials remain SHARED references across every clone
	// AND across other consumers of the same GLB (e.g. the crucifix
	// pickup mesh). Mutating `material.opacity` per-frame would fade
	// every crucifix and pickup simultaneously. We deep-clone the
	// material per mesh node so the per-instance fade is isolated.
	const cloned = useMemo(() => {
		const root = SkeletonUtils.clone(gltf.scene);
		root.traverse((obj) => {
			const mesh = obj as THREE.Mesh;
			if (!mesh.isMesh || !mesh.material) return;
			if (Array.isArray(mesh.material)) {
				mesh.material = mesh.material.map((m) => m.clone());
			} else {
				mesh.material = mesh.material.clone();
			}
		});
		return root;
	}, [gltf.scene]);
	// Dispose the per-instance cloned materials on unmount so the GPU
	// doesn't leak material entries across the typical 10-15s crucifix
	// lifetime × N placements per run.
	useEffect(() => {
		return () => {
			cloned.traverse((obj) => {
				const mesh = obj as THREE.Mesh;
				if (!mesh.isMesh || !mesh.material) return;
				const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
				for (const m of mats) m.dispose();
			});
		};
	}, [cloned]);
	const groupRef = useRef<THREE.Group | null>(null);

	useFrame(() => {
		const group = groupRef.current;
		if (!group) return;
		const now = performance.now();
		const remaining = crucifix.expiresAtMs - now;
		if (remaining <= 0) {
			group.visible = false;
			return;
		}
		// Slow yaw spin so the crucifix reads as active.
		group.rotation.y += 0.012;
		// Fade alpha over the last FADE_MS of lifetime.
		const FADE_MS = 1_500;
		const opacity = remaining < FADE_MS ? remaining / FADE_MS : 1;
		group.traverse((obj) => {
			const m = obj as THREE.Mesh;
			if (!m.isMesh || !m.material) return;
			const mats = Array.isArray(m.material) ? m.material : [m.material];
			for (const mat of mats) {
				mat.transparent = true;
				mat.opacity = opacity;
			}
		});
	});

	return (
		<group ref={groupRef} position={[crucifix.x, 0.4, crucifix.z]} scale={[0.6, 0.6, 0.6]}>
			<primitive object={cloned} />
		</group>
	);
}

/**
 * Convenience: expose CRUCIFIX_LIFETIME_MS for caller code that
 * needs to know how long a placement lasts — re-exporting here so
 * Scene + HUD don't need a separate import of @world/ghostHunting
 * for the lifetime constant alone.
 */
export { CRUCIFIX_LIFETIME_MS };
