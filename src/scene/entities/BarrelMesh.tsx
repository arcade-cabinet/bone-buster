import { BARREL_MODEL_URLS, pickBarrelModelUrl } from "@assets/models";
import { useGLTF } from "@react-three/drei";
import type { Barrel } from "@world/barrels";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

/**
 * E5 — destructible barrel mesh. Each barrel renders one of 5 PSX
 * Mega Pack II variants (4 metal + 1 wooden) seeded by `barrel.id`,
 * so the same barrel always renders the same skin across reloads.
 *
 * Auto-bbox normalization scales the model to `BARREL_TARGET_HEIGHT`
 * regardless of source GLB scale — matches the WeaponViewmodel
 * convention so per-barrel tuning stays POSE-only.
 *
 * Visibility is bound to `barrel.exploded`. When the engine flags a
 * barrel exploded, the registered group's `.visible` flag flips false
 * (the registrar in ObjexoomScene handles the imperative update);
 * the mesh itself stays mounted so React doesn't churn the tree on
 * every chain reaction.
 */
const BARREL_TARGET_HEIGHT = 1.05;

export function BarrelMesh({
	barrel,
	register,
}: {
	barrel: Barrel;
	register: (group: THREE.Group | null) => void;
}) {
	const ref = useRef<THREE.Group | null>(null);
	const url = pickBarrelModelUrl(barrel.id);
	const gltf = useGLTF(url);
	const scene = gltf.scene;

	// Per-instance clone so explosion-time mutations (color flash on
	// damage, optional shatter pieces) don't leak across barrels.
	const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);

	const { autoScale, centerY } = useMemo(() => {
		const bbox = new THREE.Box3().setFromObject(cloned);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		const longest = Math.max(size.y, 1e-3);
		return {
			autoScale: BARREL_TARGET_HEIGHT / longest,
			// Snap base of the barrel to floor level rather than the bbox
			// pivot (most GLBs are pivoted at center, not base).
			centerY: -bbox.min.y,
		};
	}, [cloned]);

	useEffect(() => {
		register(ref.current);
		return () => register(null);
	}, [register]);

	return (
		<group
			ref={(node) => {
				ref.current = node;
			}}
			position={[barrel.position.x, 0, barrel.position.y]}
		>
			<group scale={autoScale} position={[0, centerY * autoScale, 0]}>
				<primitive object={cloned} />
			</group>
		</group>
	);
}

// A4 — tier 2 (map-mount). Every barrel variant so the first
// level doesn't stall on a fetch when 3+ barrels spawn at once.
export function preloadBarrels(): void {
	for (const u of BARREL_MODEL_URLS) useGLTF.preload(u);
}
