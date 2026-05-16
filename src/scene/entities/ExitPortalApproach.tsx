import { resetPortalSwell, setPortalSwellVolume } from "@audio/sfx";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
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
		const dx = camera.position.x - portalPosition.x;
		const dz = camera.position.z - portalPosition.y;
		const dist = Math.hypot(dx, dz);
		const target = unlocked ? computeTargetFovFromDistance(dist, baseFov) : baseFov;
		// Smooth toward target so the camera doesn't snap when the
		// player crosses the radius boundary. 8 Hz cutoff feels right
		// for "portal pulls you in" without nausea.
		const blend = 0.12;
		lastFovRef.current = lastFovRef.current + (target - lastFovRef.current) * blend;
		if (Math.abs(camera.fov - lastFovRef.current) > 0.01) {
			camera.fov = lastFovRef.current;
			camera.updateProjectionMatrix();
		}
		// POL38 — audio swell paired with the FOV widen. Same approach
		// radius drives both, so the gain ramp and the visual pull stay
		// in lockstep. Only ramp while unlocked; otherwise the silent
		// baseline holds.
		if (unlocked) {
			setPortalSwellVolume(dist, APPROACH_RADIUS);
		}
	});

	// POL38 — on unmount (level remount / scene teardown) restore the
	// portal synth volume to baseline so the next playPortal() pop
	// doesn't fire at the swell-tuned level.
	useEffect(() => {
		return () => {
			resetPortalSwell();
		};
	}, []);

	return null;
}

function computeTargetFovFromDistance(dist: number, baseFov: number): number {
	if (dist >= APPROACH_RADIUS) return baseFov;
	const t = 1 - dist / APPROACH_RADIUS;
	const ease = t * t;
	return baseFov + FOV_DELTA_MAX * ease;
}
