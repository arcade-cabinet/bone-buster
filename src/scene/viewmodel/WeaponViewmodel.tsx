import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import { WEAPON_MODELS } from "../../models";
import { WEAPONS, type WeaponId } from "../../weapons";

/**
 * I9 — per-weapon recoil distance (m along camera-forward). Pistol
 * snappier than chaingun, shotgun snappier than both.
 */
const RECOIL_DISTANCE: Record<WeaponId, number> = {
	// E1 — melee is a forward-thrust swing rather than a kickback; bigger
	// forward translation, no z-bounce-back.
	melee: 0.12,
	pistol: 0.04,
	chaingun: 0.025,
	shotgun: 0.08,
};
const RECOIL_DURATION_MS = 120;

/**
 * Target on-screen size for the longest axis of any weapon GLB. The
 * viewmodel auto-normalizes each weapon (regardless of its native
 * GLB dimensions) to this length, then applies offset+rotation. That
 * way the per-weapon tuning in models.ts only carries POSE (rotation,
 * offset), not arbitrary scale numbers that get out of sync with the
 * asset.
 */
const VIEWMODEL_TARGET_LENGTH = 0.32;

/**
 * M3 — first-person weapon viewmodel. The model lives in
 * camera-relative space and gets pose-updated every frame:
 *
 *  - position copies camera.position
 *  - quaternion copies camera.quaternion
 *  - translateX/Y/Z then offset to the screen-right hip pose per model
 *  - recoil adds a forward-then-back z-bounce on `objexoom:fire`
 *
 * GLB models come from `models.ts`. Each weapon has its own scale +
 * rotation tuned so the muzzle points along camera-forward (-Z).
 * Auto-bbox normalization keeps every weapon at
 * `VIEWMODEL_TARGET_LENGTH` regardless of authored scale.
 *
 * Fallback material: USP + Uzi ship without embedded textures and
 * would render pure white. The traversal swap below replaces any
 * `MeshBasicMaterial`/`MeshStandardMaterial`-with-no-map with a dark
 * metal tinted by the weapon's muzzle color.
 */
export function WeaponViewmodel({ weapon }: { weapon: WeaponId }) {
	const groupRef = useRef<THREE.Group | null>(null);
	const camera = useThree((s) => s.camera);
	const recoilUntil = useRef(0);
	const model = WEAPON_MODELS[weapon];
	const gltf = useGLTF(model.url);
	// Clone the cached GLTF scene per-mount: `useGLTF` shares the source
	// tree across instances, so mutating `.material` on the original would
	// leak to every other consumer and would not be disposed on unmount.
	const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

	const { autoScale, center, replacedMaterials } = useMemo(() => {
		const bbox = new THREE.Box3().setFromObject(scene);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		const c = new THREE.Vector3();
		bbox.getCenter(c);
		const longest = Math.max(size.x, size.y, size.z, 1e-3);
		const replaced: THREE.MeshStandardMaterial[] = [];
		scene.traverse((node) => {
			if (!(node instanceof THREE.Mesh)) return;
			const m = node.material;
			const isUntexturedStd = m instanceof THREE.MeshStandardMaterial && !m.map;
			const isUntexturedBasic = m instanceof THREE.MeshBasicMaterial && !m.map;
			if (isUntexturedStd || isUntexturedBasic) {
				const mat = new THREE.MeshStandardMaterial({
					color:
						weapon === "pistol"
							? OBJEXOOM_PALETTE.weaponMetalLight
							: OBJEXOOM_PALETTE.weaponMetalDark,
					emissive: WEAPONS[weapon].muzzleColor,
					emissiveIntensity: 0.18,
					metalness: 0.7,
					roughness: 0.35,
				});
				node.material = mat;
				replaced.push(mat);
			}
		});
		return {
			autoScale: VIEWMODEL_TARGET_LENGTH / longest,
			center: c,
			replacedMaterials: replaced,
		};
	}, [scene, weapon]);

	useEffect(
		() => () => {
			for (const m of replacedMaterials) m.dispose();
		},
		[replacedMaterials],
	);

	useEffect(() => {
		const onFire = () => {
			recoilUntil.current = performance.now() + RECOIL_DURATION_MS;
		};
		window.addEventListener("objexoom:fire", onFire);
		return () => window.removeEventListener("objexoom:fire", onFire);
	}, []);

	useFrame(() => {
		const group = groupRef.current;
		if (!group) return;
		// Anchor at camera; rotation copies camera.
		group.position.copy(camera.position);
		group.quaternion.copy(camera.quaternion);

		const now = performance.now();
		const remaining = recoilUntil.current - now;
		let recoilOffset = 0;
		if (remaining > 0) {
			const t = 1 - remaining / RECOIL_DURATION_MS;
			if (weapon === "melee") {
				// Forward-thrust: ease-out (1-(1-t)^2) drives the blade
				// forward (-Z in camera-local) over the full window and
				// holds — no bounce-back. The full pose snaps back to
				// neutral when remaining ≤ 0.
				recoilOffset = -(1 - (1 - t) * (1 - t)) * RECOIL_DISTANCE[weapon];
			} else {
				// Kickback: sin(πt) bumps the weapon away from camera
				// (+Z in camera-local) and returns to neutral over the
				// window.
				recoilOffset = Math.sin(t * Math.PI) * RECOIL_DISTANCE[weapon];
			}
		}

		// In camera-local space:
		//   +X = right, +Y = up, -Z = forward.
		// model.offset = [right, up, forward (negative)] in world-units.
		group.translateX(model.offset[0]);
		group.translateY(model.offset[1]);
		group.translateZ(model.offset[2] + recoilOffset);
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		>
			{/* Outer pose: rotate to align barrel with camera-forward */}
			<group rotation={model.rotation} scale={autoScale}>
				{/* Inner re-center: shift the GLB so its bbox center sits
				    at the origin, otherwise off-axis pivots throw the
				    pose. */}
				<group position={[-center.x, -center.y, -center.z]}>
					<primitive object={scene} />
				</group>
			</group>
		</group>
	);
}

// Preload weapon GLBs so the very first swap doesn't stutter.
for (const m of Object.values(WEAPON_MODELS)) useGLTF.preload(m.url);
