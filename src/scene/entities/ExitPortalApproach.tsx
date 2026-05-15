import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { PerspectiveCamera } from "three";

/**
 * POL23 — exit-portal approach slot (see docs/SLOT-ARCHITECTURE.md).
 *
 * Mounted in the scene alongside `<ExitPortal>`. Watches the camera
 * position vs the portal position each frame. When the player enters
 * the approach radius AND the portal is unlocked (boss dead + key
 * held), gently widens the camera FOV — reads as "the portal pulls
 * the world inward as you approach." Restores baseline FOV when
 * leaving the radius so the effect is purely positional.
 *
 * The FOV envelope is bound to distance, not time: closer = wider,
 * with a smooth clamp so the camera never goes past +20° of base.
 * This avoids fighting the player's input — they can back out of
 * the portal and the FOV returns smoothly.
 *
 * Why slot, not a useFrame branch in ObjexoomScene: the FOV widening
 * is a single concern (visual pull on approach). Bolting it into the
 * scene's main useFrame mixed it with HP regen, lava damage, boss
 * tracking, etc. A standalone slot is one read + one mutate per
 * frame.
 */

const APPROACH_RADIUS = 4.0; // tiles. Larger than the cross-threshold (~0.6).
const FOV_DELTA_MAX = 20; // degrees of widen at touch-distance.

export function ExitPortalApproach({
	portalPosition,
	unlocked,
	baseFov,
}: {
	portalPosition: { x: number; y: number };
	/** Whether the portal is ready (boss dead, key held). Disables the effect otherwise. */
	unlocked: boolean;
	/** The camera's pre-POL23 baseline FOV (degrees). */
	baseFov: number;
}) {
	const camera = useThree((s) => s.camera) as PerspectiveCamera;
	const lastFovRef = useRef(baseFov);

	useFrame(() => {
		if (!camera.isPerspectiveCamera) return;
		// Cheap fast-out when the portal isn't approachable.
		const target = unlocked
			? computeTargetFov(camera.position.x, camera.position.z, portalPosition, baseFov)
			: baseFov;
		// Smooth toward target so the camera doesn't snap when the
		// player crosses the radius boundary. 8 Hz cutoff feels right
		// for "portal pulls you in" without nausea.
		const blend = 0.12;
		lastFovRef.current = lastFovRef.current + (target - lastFovRef.current) * blend;
		if (Math.abs(camera.fov - lastFovRef.current) > 0.01) {
			camera.fov = lastFovRef.current;
			camera.updateProjectionMatrix();
		}
	});

	return null;
}

function computeTargetFov(
	px: number,
	pz: number,
	portal: { x: number; y: number },
	baseFov: number,
): number {
	const dx = px - portal.x;
	const dz = pz - portal.y;
	const dist = Math.hypot(dx, dz);
	if (dist >= APPROACH_RADIUS) return baseFov;
	// Linear ramp from 0 (at the radius edge) to 1 (at the portal).
	const t = 1 - dist / APPROACH_RADIUS;
	// Ease-in curve so most of the widen happens near the portal,
	// not at the radius boundary — feels less abrupt.
	const ease = t * t;
	return baseFov + FOV_DELTA_MAX * ease;
}
