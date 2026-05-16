import { useFrame } from "@react-three/fiber";
import type { WeaponId } from "@shared/weapons";
import { useEffect, useRef } from "react";

/**
 * POL20 — weapon-swap dip slot (see docs/SLOT-ARCHITECTURE.md).
 *
 * Mounted alongside `<WeaponViewmodel>`. Observes the `weapon` prop;
 * when it changes (player swapped), arms a 220ms dip-then-raise
 * window. Each frame inside the window, writes a Y offset to the
 * shared `dipOffsetRef`. WeaponViewmodel reads that ref in its own
 * useFrame and adds the value to its Y translation.
 *
 * The slot owns:
 *   - the trigger (useEffect on weapon)
 *   - the timing state (`swapStartedAt`)
 *   - the envelope math (triangular dip)
 *   - the per-frame write to the shared ref
 *
 * WeaponViewmodel owns:
 *   - rendering the GLB pose + recoil offset
 *   - reading dipOffsetRef per frame
 *
 * Separation lets new viewmodel feedback features (lean-on-strafe,
 * idle-sway, low-ammo-shake) land as additional sibling slots
 * without touching WeaponViewmodel.
 */

const SWAP_DURATION_MS = 220;
const SWAP_DIP_DISTANCE = 0.6;

export function WeaponSwapDip({
	weapon,
	dipOffsetRef,
}: {
	weapon: WeaponId;
	/** Shared scalar Y-offset ref WeaponViewmodel reads each frame. */
	dipOffsetRef: { current: number };
}) {
	const swapStartedAt = useRef(0);
	const previousWeapon = useRef<WeaponId | null>(null);

	useEffect(() => {
		// Skip the very first render (no swap happened — initial weapon).
		// On subsequent renders the previousWeapon ref reads the prior
		// weapon, which is what makes `weapon` a *used* dep — satisfies
		// biome's exhaustive-deps rule honestly: we genuinely care
		// about the from→to transition.
		const prior = previousWeapon.current;
		previousWeapon.current = weapon;
		if (prior === null) return; // first mount
		if (prior === weapon) return; // no actual swap (defensive — shouldn't fire)
		swapStartedAt.current = performance.now();
	}, [weapon]);

	useFrame(() => {
		if (swapStartedAt.current === 0) {
			dipOffsetRef.current = 0;
			return;
		}
		const age = performance.now() - swapStartedAt.current;
		if (age >= SWAP_DURATION_MS) {
			swapStartedAt.current = 0;
			dipOffsetRef.current = 0;
			return;
		}
		const t = age / SWAP_DURATION_MS;
		const tri = 1 - Math.abs(t * 2 - 1); // 0 → 1 → 0 over the window
		dipOffsetRef.current = -SWAP_DIP_DISTANCE * tri;
	});

	return null;
}
