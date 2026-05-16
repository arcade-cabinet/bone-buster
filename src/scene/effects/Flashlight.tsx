import { addBoneBusterListener } from "@engine/events";
import { useFrame, useThree } from "@react-three/fiber";
import { BONE_BUSTER_PALETTE } from "@styles/tokens/index";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * J1 — flashlight. A SpotLight that lives at the camera position and
 * points along the camera-forward vector each frame. Cone ≈ 0.5 rad
 * half-angle (≈ 28° from center), range ~12 m, brightness 1.4 in the
 * weapon's ambient hue (parchment). The light target is also moved
 * each frame to a point 8 m ahead of the camera so the cone projects
 * where the player is looking.
 *
 * POL39 — flashlight-acquired boost. On every `flashlightAcquired`
 * event, the per-frame intensity multiplies by an ease-out-cubic
 * envelope (1.8× peak → 1.0× over 220ms). Reads as "the room
 * brightens briefly" when the player picks up the flashlight,
 * distinct from the FlashlightAcquiredEvent's pre-existing white-
 * fade screen flash. The boost lives on this slot (not on a
 * separate scene-side listener) because the spotLight ref + the
 * intensity write are co-located here.
 */
const FORWARD_BASE = new THREE.Vector3(0, 0, -1);
const FLASHLIGHT_BASE_INTENSITY = 1.4;
const FLASHLIGHT_BOOST_PEAK = 1.8;
const FLASHLIGHT_BOOST_DURATION_MS = 220;

export function Flashlight() {
	const camera = useThree((s) => s.camera);
	const spotRef = useRef<THREE.SpotLight | null>(null);
	const targetRef = useRef<THREE.Object3D | null>(null);
	// Scratch vector — reused every frame to avoid per-frame GC pressure.
	const forwardRef = useRef(new THREE.Vector3());
	// POL39 — timestamp of the most recent acquire boost; -Infinity
	// means no boost has ever fired (intensity stays at baseline).
	const boostStartRef = useRef(-Infinity);

	useEffect(() => {
		return addBoneBusterListener("flashlightAcquired", () => {
			boostStartRef.current = performance.now();
		});
	}, []);

	useFrame(() => {
		const spot = spotRef.current;
		const target = targetRef.current;
		if (!spot || !target) return;
		spot.position.copy(camera.position);
		const forward = forwardRef.current.copy(FORWARD_BASE).applyQuaternion(camera.quaternion);
		target.position.set(
			camera.position.x + forward.x * 8,
			camera.position.y + forward.y * 8,
			camera.position.z + forward.z * 8,
		);
		spot.target = target;
		// POL39 — apply the acquire boost envelope. ease-out-cubic
		// `(1 - (1 - t)^3)` so the boost peaks immediately and decays
		// for the rest of the window, matching DOOM Eternal pickup feel.
		spot.intensity = computeBoostedIntensity(performance.now(), boostStartRef.current);
	});

	return (
		<>
			<spotLight
				ref={spotRef}
				intensity={FLASHLIGHT_BASE_INTENSITY}
				distance={12}
				angle={0.5}
				penumbra={0.3}
				decay={1.5}
				color={BONE_BUSTER_PALETTE.flashlightWarm}
				castShadow
				// QW6 — shadow map 1024² → 512². PCF soft + 512² on a
				// tight 14m cone is still convincing visually and roughly
				// halves the per-frame shadow-pass cost on Adreno-class
				// mobile GPUs. PERF audit #4.
				shadow-mapSize={[512, 512]}
				shadow-camera-near={0.2}
				shadow-camera-far={14}
				shadow-bias={-0.0005}
			/>
			<object3D
				ref={(node) => {
					targetRef.current = node;
				}}
			/>
		</>
	);
}

/**
 * POL39 — compute the boosted intensity for a given (now, boostStart).
 * Exported pure for tests so the envelope contract is verifiable
 * without mounting r3f.
 *
 *   t = (now - boostStart) / FLASHLIGHT_BOOST_DURATION_MS
 *   t <= 0 or t >= 1 → baseline
 *   else            → baseline + (peak - baseline) * (1 - (1 - t)^3)  [ease-out-cubic]
 */
export function computeBoostedIntensity(now: number, boostStart: number): number {
	if (!Number.isFinite(boostStart)) return FLASHLIGHT_BASE_INTENSITY;
	const elapsed = now - boostStart;
	if (elapsed < 0 || elapsed >= FLASHLIGHT_BOOST_DURATION_MS) {
		return FLASHLIGHT_BASE_INTENSITY;
	}
	// ease-out-cubic decay: at t=0 the boost is at PEAK; at t=1 it has
	// settled to BASELINE. The cubic shape spends most of the window
	// near baseline (decay tail) — feels like an instant pickup-flash
	// rather than a slow fade. Formula: peakDelta * (1 - t)^3.
	const t = elapsed / FLASHLIGHT_BOOST_DURATION_MS;
	const inv = 1 - t;
	const decay = inv * inv * inv;
	const peakBoost = FLASHLIGHT_BOOST_PEAK * FLASHLIGHT_BASE_INTENSITY - FLASHLIGHT_BASE_INTENSITY;
	return FLASHLIGHT_BASE_INTENSITY + peakBoost * decay;
}
