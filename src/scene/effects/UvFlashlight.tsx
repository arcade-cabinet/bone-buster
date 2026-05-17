import { useFrame, useThree } from "@react-three/fiber";
import { ROLE } from "@styles/tokens/index";
import { UV_FLASHLIGHT_HALF_ANGLE_RAD, UV_FLASHLIGHT_RANGE_TILES } from "@world/ghostHunting";
import { useRef } from "react";
import * as THREE from "three";

/**
 * PC3 — UV flashlight cone. A second SpotLight parallel to the
 * existing POL28 white Flashlight; tinted ROLE.accent.discovery
 * (violet) so the player reads it as a distinct light source.
 *
 * The cone shape mirrors the white Flashlight (12-tile range, 0.5-rad
 * half-angle) so the player's mental model is "the UV light hits
 * roughly the same spot the regular light hits — but reveals hidden
 * things." The reveal logic lives in EnemyMesh's per-frame visibility
 * pass; this component only owns the light itself, no visibility
 * mutations.
 *
 * Intentionally NO castShadow — the UV pass is meant to read as an
 * x-ray/reveal beam, not a shadow-casting source. Same per-frame
 * cone-tracking pattern as Flashlight.
 */
const FORWARD_BASE = new THREE.Vector3(0, 0, -1);
// SLA5 — UV cone color routes through ROLE.signal.uv (Phasmo-style
// reference violet), promoted from inline hex into the
// design-token surface so a future palette tweak edits one place.
const UV_BASE_INTENSITY = 1.2;

export function UvFlashlight() {
	const camera = useThree((s) => s.camera);
	const spotRef = useRef<THREE.SpotLight | null>(null);
	const targetRef = useRef<THREE.Object3D | null>(null);
	const forwardRef = useRef(new THREE.Vector3());

	useFrame(() => {
		const spot = spotRef.current;
		const target = targetRef.current;
		if (!spot || !target) return;
		spot.position.copy(camera.position);
		const forward = forwardRef.current.copy(FORWARD_BASE).applyQuaternion(camera.quaternion);
		const reach = UV_FLASHLIGHT_RANGE_TILES * 0.7;
		target.position.set(
			camera.position.x + forward.x * reach,
			camera.position.y + forward.y * reach,
			camera.position.z + forward.z * reach,
		);
		spot.target = target;
	});

	return (
		<>
			<spotLight
				ref={spotRef}
				intensity={UV_BASE_INTENSITY}
				distance={UV_FLASHLIGHT_RANGE_TILES}
				angle={UV_FLASHLIGHT_HALF_ANGLE_RAD}
				penumbra={0.4}
				decay={1.6}
				color={ROLE.signal.uv}
				// No castShadow — UV pass is a reveal beam, not a
				// shadow-casting source. Skipping shadows also halves
				// per-frame cost on the second SpotLight.
			/>
			<object3D
				ref={(node) => {
					targetRef.current = node;
				}}
			/>
		</>
	);
}
