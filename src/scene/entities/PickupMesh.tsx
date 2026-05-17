import type { Pickup } from "@engine/engine";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { BONE_BUSTER_PALETTE, ROLE } from "@styles/tokens/index";
import { LOOT_URL_LIST, LOOT_URLS, type LootKind, pickLootKind } from "@world/loot";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

/**
 * POL17 — per-pickup-kind halo color. Picks the dominant emissive
 * tone of the pickup body so the halo reads as a coherent extension
 * of the object, not an arbitrary glow.
 */
function haloColorFor(kind: Pickup["kind"]): string {
	switch (kind) {
		case "chaingunAmmo":
			return BONE_BUSTER_PALETTE.indigo;
		case "loot":
			return BONE_BUSTER_PALETTE.amber; // treasure-tier glow
		default:
			return ROLE.actionPickup;
	}
}

/**
 * POL17 — layered halo. Inner bright core + outer soft falloff at
 * two scale tiers. Mounted as a sibling to the pickup body group,
 * fluctuates radius + opacity with a slow sin so the halo "breathes."
 */
function PickupHalo({ color }: { color: string }) {
	const innerRef = useRef<THREE.Mesh | null>(null);
	const outerRef = useRef<THREE.Mesh | null>(null);
	const innerColor = useMemo(() => new THREE.Color(color), [color]);
	useFrame((state) => {
		const t = state.clock.elapsedTime;
		const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
		if (innerRef.current) {
			const mat = innerRef.current.material as THREE.MeshBasicMaterial;
			mat.opacity = 0.16 + pulse * 0.08;
			const s = 0.95 + pulse * 0.1;
			innerRef.current.scale.set(s, s, s);
		}
		if (outerRef.current) {
			const mat = outerRef.current.material as THREE.MeshBasicMaterial;
			mat.opacity = 0.05 + pulse * 0.04;
			const s = 1.4 + pulse * 0.18;
			outerRef.current.scale.set(s, s, s);
		}
	});
	return (
		<>
			<mesh
				ref={(node) => {
					innerRef.current = node;
				}}
			>
				<sphereGeometry args={[0.42, 16, 16]} />
				<meshBasicMaterial
					color={innerColor}
					transparent
					opacity={0.2}
					depthWrite={false}
					side={THREE.BackSide}
				/>
			</mesh>
			<mesh
				ref={(node) => {
					outerRef.current = node;
				}}
			>
				<sphereGeometry args={[0.62, 16, 16]} />
				<meshBasicMaterial
					color={innerColor}
					transparent
					opacity={0.06}
					depthWrite={false}
					side={THREE.BackSide}
				/>
			</mesh>
		</>
	);
}

/**
 * Floating pickup mesh — bobs + spins. Each `pickup.kind` renders as a
 * distinct silhouette so the player learns to recognize health vs ammo
 * vs flashlight from across a sector without needing labels.
 *
 *   health        — amber cross (two bars)
 *   chaingunAmmo  — indigo battery cell with end caps
 *   shotgunAmmo   — amber shell pair with brass primers
 *   flashlight    — parchment cylinder with amber lens
 */
export function PickupMesh({
	pickup,
	register,
	mapSeed,
}: {
	pickup: Pickup;
	register: (group: THREE.Group | null) => void;
	/**
	 * COV12 step-2 — used to resolve `lootKind` for `kind === "loot"`
	 * pickups via `pickLootKind(mapSeed)`. Other kinds ignore it.
	 */
	mapSeed: number;
}) {
	const ref = useRef<THREE.Group | null>(null);
	useEffect(() => {
		register(ref.current);
		return () => register(null);
	}, [register]);
	// POL17 — buoyancy bob. The pre-POL17 path used a single sin for
	// vertical. Adds a sin of half-frequency on top for a "two-cycle"
	// motion plus a small roll on the local Z axis so the pickup
	// feels weightless rather than mechanically reciprocating.
	useFrame((s) => {
		if (!ref.current) return;
		const t = s.clock.elapsedTime;
		ref.current.rotation.y = t * 1.4;
		const primary = Math.sin(t * 2 + pickup.id) * 0.1;
		const secondary = Math.sin(t * 0.9 + pickup.id * 1.7) * 0.04;
		ref.current.position.y = 0.7 + primary + secondary;
		ref.current.rotation.z = Math.sin(t * 1.1 + pickup.id) * 0.07;
	});

	const haloColor = haloColorFor(pickup.kind);

	return (
		<group
			ref={(node) => {
				ref.current = node;
			}}
			position={[pickup.position.x, 0.7, pickup.position.y]}
		>
			{/* POL17 — layered halo behind the pickup body. */}
			<PickupHalo color={haloColor} />
			{pickup.kind === "health" && (
				<>
					{/* D2 — amber cross. Two crossed bars in brand amber. */}
					<mesh>
						<boxGeometry args={[0.5, 0.15, 0.15]} />
						<meshStandardMaterial
							color={ROLE.actionPickup}
							emissive={ROLE.actionPickup}
							emissiveIntensity={1.0}
						/>
					</mesh>
					<mesh>
						<boxGeometry args={[0.15, 0.5, 0.15]} />
						<meshStandardMaterial
							color={ROLE.actionPickup}
							emissive={ROLE.actionPickup}
							emissiveIntensity={1.0}
						/>
					</mesh>
				</>
			)}
			{pickup.kind === "chaingunAmmo" && (
				/* D3 — indigo cell box. Reads as a battery / power cell. */
				<group>
					<mesh>
						<boxGeometry args={[0.55, 0.32, 0.32]} />
						<meshStandardMaterial
							color={BONE_BUSTER_PALETTE.wallVariantCool}
							emissive={BONE_BUSTER_PALETTE.indigo}
							emissiveIntensity={0.55}
							roughness={0.5}
						/>
					</mesh>
					<mesh position={[0.18, 0, 0]}>
						<boxGeometry args={[0.06, 0.4, 0.4]} />
						<meshStandardMaterial
							color={BONE_BUSTER_PALETTE.indigo}
							emissive={BONE_BUSTER_PALETTE.indigo}
							emissiveIntensity={1.4}
						/>
					</mesh>
					<mesh position={[-0.18, 0, 0]}>
						<boxGeometry args={[0.06, 0.4, 0.4]} />
						<meshStandardMaterial
							color={BONE_BUSTER_PALETTE.indigo}
							emissive={BONE_BUSTER_PALETTE.indigo}
							emissiveIntensity={1.4}
						/>
					</mesh>
				</group>
			)}
			{pickup.kind === "shotgunAmmo" && (
				/* D3 — amber shell pair. Two stubby cylinders side by side. */
				<group>
					<mesh position={[-0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
						<meshStandardMaterial
							color={ROLE.actionPickup}
							emissive={ROLE.actionPickup}
							emissiveIntensity={0.95}
							roughness={0.4}
						/>
					</mesh>
					<mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
						<meshStandardMaterial
							color={ROLE.actionPickup}
							emissive={ROLE.actionPickup}
							emissiveIntensity={0.95}
							roughness={0.4}
						/>
					</mesh>
					{/* Brass primer caps */}
					<mesh position={[-0.15, 0.18, 0]}>
						<cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
						<meshStandardMaterial
							color={BONE_BUSTER_PALETTE.ammoBrass}
							emissive={BONE_BUSTER_PALETTE.ammoBrass}
							emissiveIntensity={0.4}
						/>
					</mesh>
					<mesh position={[0.15, 0.18, 0]}>
						<cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
						<meshStandardMaterial
							color={BONE_BUSTER_PALETTE.ammoBrass}
							emissive={BONE_BUSTER_PALETTE.ammoBrass}
							emissiveIntensity={0.4}
						/>
					</mesh>
				</group>
			)}
			{pickup.kind === "loot" && <LootPickupMesh lootKind={pickLootKind(mapSeed)} />}
			{pickup.kind === "flashlight" && (
				/* J1 — flashlight pickup: parchment cylinder w/ amber lens */
				<group>
					<mesh rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.16, 0.45, 12]} />
						<meshStandardMaterial
							color={BONE_BUSTER_PALETTE.flashlightWarm}
							emissive={BONE_BUSTER_PALETTE.flashlightWarm}
							emissiveIntensity={0.6}
							metalness={0.4}
							roughness={0.3}
						/>
					</mesh>
					<mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.18, 0.13, 0.08, 12]} />
						<meshStandardMaterial
							color={ROLE.actionPickup}
							emissive={ROLE.actionPickup}
							emissiveIntensity={1.8}
						/>
					</mesh>
				</group>
			)}
			{pickup.kind === "emfReader" && (
				/* PB5 step-2 — EMF reader: handheld brick with a green
				   indicator strip. Renders as a small dark-grey rectangular
				   prism with three stacked emissive bars on the front face
				   so it reads as an LED bar-graph from across a room.
				   Body uses ROLE.sceneWeaponMetalDark (the same neutral
				   used for chaingun / shotgun bodies so the reader reads
				   as the same material family). Indicator bars use
				   ROLE.actionWin (mint gain — matches EMF_TOKEN's "active
				   signal" tier in the HUD chip). */
				<group>
					<mesh>
						<boxGeometry args={[0.2, 0.3, 0.08]} />
						<meshStandardMaterial
							color={ROLE.sceneWeaponMetalDark}
							metalness={0.5}
							roughness={0.6}
						/>
					</mesh>
					{[-0.06, 0, 0.06].map((y) => (
						<mesh key={y} position={[0, y, 0.045]}>
							<boxGeometry args={[0.14, 0.03, 0.005]} />
							<meshStandardMaterial
								color={ROLE.actionWin}
								emissive={ROLE.actionWin}
								emissiveIntensity={1.6}
							/>
						</mesh>
					))}
				</group>
			)}
		</group>
	);
}

/**
 * COV12 step-2 — loot pickup body. Renders the COV12 GLB matching the
 * resolved `lootKind`. The GLBs are scene-aggregate exports (Bottles,
 * Books and Scrolls, Treasure) — we scale them down to ~0.6 world
 * units so they read as a single hero pickup rather than a stage of
 * props. SkeletonUtils.clone for the standard per-mount tree-isolation
 * pattern.
 */
function LootPickupMesh({ lootKind }: { lootKind: LootKind }) {
	const url = LOOT_URLS[lootKind];
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group scale={[0.6, 0.6, 0.6]}>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 2 (map-mount). Loot pickup is 1 per map, placed at
// the far-centroid — visible by the time the player explores.
export function preloadLootPickups(): void {
	for (const url of LOOT_URL_LIST) useGLTF.preload(url);
}
