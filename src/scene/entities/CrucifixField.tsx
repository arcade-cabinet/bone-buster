import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CRUCIFIX_LIFETIME_MS, type CrucifixInstance } from "@world/ghostHunting";
import { TOOL_URLS } from "@world/tools";
import { useRef } from "react";
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
export function CrucifixField({ crucifixes }: { crucifixes: readonly CrucifixInstance[] }) {
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
	const cloned = useRef<THREE.Object3D | null>(null);
	if (cloned.current === null) {
		cloned.current = SkeletonUtils.clone(gltf.scene);
	}
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
			if (!m.isMesh) return;
			const mat = m.material as THREE.Material & { opacity?: number; transparent?: boolean };
			if (!mat) return;
			mat.transparent = true;
			mat.opacity = opacity;
		});
	});

	return (
		<group ref={groupRef} position={[crucifix.x, 0.4, crucifix.z]} scale={[0.6, 0.6, 0.6]}>
			<primitive object={cloned.current} />
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
