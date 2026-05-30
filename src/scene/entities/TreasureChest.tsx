import { useGLTF } from "@react-three/drei";
import { ROLE } from "@styles/tokens/index";
import { LOOT_URLS } from "@world/loot";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

/**
 * D1 / VIS5 — decorative treasure chest stamped on every exit. Previously a
 * procedural box+cylinder approximation; now renders the real PSX
 * `props/loot/Treasure.glb` (the same model the loot pickup uses), per the
 * OVERHAUL2 rule "nothing procedural where a PSX model exists." No interaction —
 * the portal torus is still the win trigger. Wrapped in Suspense; a load failure
 * is caught by the Shell's AssetErrorBoundary (ERR1).
 */
const TREASURE_URL = LOOT_URLS.treasure;

function TreasureChestModel() {
	const gltf = useGLTF(TREASURE_URL);
	// Per-mount clone so multiple chests (or a remount across levels) don't
	// share/steal one scene graph — mirrors PickupMesh's loot-body pattern.
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	// Treasure.glb is a scene-AGGREGATE export (same as the loot pickup): not
	// centered at origin + authored larger than one prop. Recenter on its bbox
	// (X/Z) and sit it on the floor (min-Y → 0), then the parent group scales it
	// to a single hero chest. Also warm-emissive-lift it so it reads as the
	// "reward" beacon at the exit under the flood without washing out texture.
	const { offset, clonedMaterials } = useMemo(() => {
		const box = new THREE.Box3().setFromObject(cloned);
		const center = box.getCenter(new THREE.Vector3());
		const mats: THREE.Material[] = [];
		cloned.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (mesh.isMesh) {
				// SkeletonUtils.clone shares MATERIALS by reference (three r184) —
				// Treasure.glb is also the loot-pickup body, so mutating the shared
				// material here would tint the loot pickup too (CodeRabbit). Clone the
				// material per-mesh before the emissive lift so only this chest changes.
				const src = mesh.material as THREE.MeshStandardMaterial | undefined;
				if (src && "emissive" in src) {
					const mat = src.clone();
					mat.emissive = new THREE.Color(ROLE.actionPickup);
					mat.emissiveIntensity = 0.25;
					mesh.material = mat;
					mats.push(mat);
				}
			}
		});
		// Shift so the model is centered in X/Z and its base rests at y=0.
		return { offset: new THREE.Vector3(-center.x, -box.min.y, -center.z), clonedMaterials: mats };
	}, [cloned]);
	// The per-mesh material clones are GPU resources we own — dispose them on
	// unmount (each level remount makes a fresh chest) to avoid a per-level leak.
	useEffect(() => {
		return () => {
			for (const m of clonedMaterials) m.dispose();
		};
	}, [clonedMaterials]);
	return <primitive object={cloned} position={offset} />;
}

export function TreasureChest({ position }: { position: { x: number; y: number } }) {
	return (
		<group position={[position.x, 0, position.y]} scale={[0.6, 0.6, 0.6]}>
			<Suspense fallback={null}>
				<TreasureChestModel />
			</Suspense>
		</group>
	);
}

useGLTF.preload(TREASURE_URL);
