import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { ROLE } from "../../design-tokens";
import { addObjexoomListener } from "../../events";
import { MELEE_SKIN_URLS, pickMeleeSkin } from "../../meleeSkins";
import { WEAPON_MODELS } from "../../models";
import { WEAPONS, type WeaponId } from "../../weapons";

/**
 * PA-MOD7 / D11 — callback the viewmodel invokes once the muzzle-anchor
 * `<group>` is mounted. Consumers (ObjexoomScene's muzzle-light loop)
 * keep this ref and read `getWorldPosition` each frame so the flash
 * originates from the barrel tip rather than the camera position.
 */
export type MuzzleAnchorCallback = (group: THREE.Group | null) => void;

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
	// E8 — flamethrower is continuous-fire so the recoil bob is small
	// (matches chaingun's rapid-fire scale).
	flamethrower: 0.025,
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
export function WeaponViewmodel({
	weapon,
	mapSeed,
	onMuzzleAnchor,
	swapDipOffsetRef,
}: {
	weapon: WeaponId;
	/**
	 * POL20 — optional Y-offset ref driven by `<WeaponSwapDip>`. When
	 * the slot is mounted, it writes a per-frame value here that this
	 * viewmodel reads + adds to its Y translation, so the swap-dip
	 * animation lives entirely in the slot. Omitting the prop disables
	 * the feature without changing render behavior.
	 */
	swapDipOffsetRef?: { current: number };
	/**
	 * COV9 step-2 — seed used to pick the BLADE skin variant per run.
	 * `pickMeleeSkin(mapSeed)` returns one of the 7 melee GLBs so each
	 * refLevel / procedural map renders a different blade silhouette.
	 * Has no effect for non-melee weapons (single canonical URL each).
	 */
	mapSeed: number;
	/**
	 * PA-MOD7 / D11 — invoked with the muzzle-anchor group once it mounts
	 * (and with `null` on unmount). The world-position of this group is
	 * the actual barrel tip of the wired GLB; ObjexoomScene reads it
	 * each frame for the muzzle-flash point light.
	 */
	onMuzzleAnchor?: MuzzleAnchorCallback;
}) {
	const groupRef = useRef<THREE.Group | null>(null);
	const muzzleRef = useRef<THREE.Group | null>(null);
	const camera = useThree((s) => s.camera);
	const recoilUntil = useRef(0);
	const model = WEAPON_MODELS[weapon];
	// COV9 — for the melee slot, override the static WEAPON_MODELS.url
	// with the per-seed picked skin so each run cycles through machete /
	// axe / chainsaw / knife / meathook / cleaver / sword. Other weapons
	// resolve to their single canonical URL.
	const url = weapon === "melee" ? pickMeleeSkin(mapSeed) : model.url;
	const gltf = useGLTF(url);
	// Clone the cached GLTF scene per-mount: `useGLTF` shares the source
	// tree across instances, so mutating `.material` on the original would
	// leak to every other consumer and would not be disposed on unmount.
	const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);

	const { autoScale, center, muzzleNative, replacedMaterials } = useMemo(() => {
		const bbox = new THREE.Box3().setFromObject(scene);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		const c = new THREE.Vector3();
		bbox.getCenter(c);
		const longest = Math.max(size.x, size.y, size.z, 1e-3);
		// PA-MOD7 — resolve `muzzleBboxFrac` against the real bbox.
		// Native muzzle position lives in the same coordinate frame as
		// the GLB's root; the inner re-center group offsets by -center
		// so the anchor lands at `muzzleNative - center` inside the
		// re-center group.
		const [fx, fy, fz] = model.muzzleBboxFrac;
		const muzzleN = new THREE.Vector3(
			bbox.min.x + (bbox.max.x - bbox.min.x) * fx,
			bbox.min.y + (bbox.max.y - bbox.min.y) * fy,
			bbox.min.z + (bbox.max.z - bbox.min.z) * fz,
		);
		const replaced: THREE.MeshStandardMaterial[] = [];
		scene.traverse((node) => {
			if (!(node instanceof THREE.Mesh)) return;
			const m = node.material;
			const isUntexturedStd = m instanceof THREE.MeshStandardMaterial && !m.map;
			const isUntexturedBasic = m instanceof THREE.MeshBasicMaterial && !m.map;
			if (isUntexturedStd || isUntexturedBasic) {
				const mat = new THREE.MeshStandardMaterial({
					color: weapon === "pistol" ? ROLE.sceneWeaponMetalLight : ROLE.sceneWeaponMetalDark,
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
			muzzleNative: muzzleN,
			replacedMaterials: replaced,
		};
	}, [scene, weapon, model.muzzleBboxFrac]);

	useEffect(
		() => () => {
			for (const m of replacedMaterials) m.dispose();
		},
		[replacedMaterials],
	);

	useEffect(() => {
		return addObjexoomListener("fire", () => {
			recoilUntil.current = performance.now() + RECOIL_DURATION_MS;
		});
	}, []);

	// PA-MOD7 / D11 — release the muzzle anchor on unmount so a stale
	// weapon ref doesn't keep a swapped-out weapon's group alive.
	useEffect(() => () => onMuzzleAnchor?.(null), [onMuzzleAnchor]);

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

		// POL20 — swap dip slot. WeaponSwapDip writes a Y delta here;
		// we just read it. When the slot isn't mounted (prop omitted),
		// dipY stays 0 and behavior matches pre-POL20.
		const dipY = swapDipOffsetRef?.current ?? 0;

		// In camera-local space:
		//   +X = right, +Y = up, -Z = forward.
		// model.offset = [right, up, forward (negative)] in world-units.
		group.translateX(model.offset[0]);
		group.translateY(model.offset[1] + dipY);
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
					{/* PA-MOD7 / D11 — muzzle anchor at the barrel tip
					    (per-weapon `muzzleBboxFrac` lerped over the GLB
					    bbox). Sits in the same re-center frame as the
					    primitive, so it inherits autoScale + rotation
					    naturally. ObjexoomScene reads the world-position
					    of this group each frame to position the muzzle-
					    flash point light. */}
					<group
						ref={(node) => {
							muzzleRef.current = node;
							onMuzzleAnchor?.(node);
						}}
						position={[muzzleNative.x, muzzleNative.y, muzzleNative.z]}
					/>
				</group>
			</group>
		</group>
	);
}

// Preload weapon GLBs so the very first swap doesn't stutter.
for (const m of Object.values(WEAPON_MODELS)) useGLTF.preload(m.url);
// COV9 — preload every melee skin variant too so per-seed swaps
// don't stall the BLADE viewmodel on level-change.
for (const url of MELEE_SKIN_URLS) useGLTF.preload(url);
