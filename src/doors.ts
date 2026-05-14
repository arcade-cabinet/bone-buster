/**
 * COV7 step-1 — door variant pool.
 *
 * 6 PSX Mega Pack II door GLBs staged for per-map variant cycling.
 * The acceptance criterion is "RealDoor + LockedDoor cycle through ≥3
 * variants by seed" — this module ships the asset-enabler + the
 * deterministic picker. Step-2 will swap the procedural boxGeometry
 * in `RealDoor.tsx` for the picked GLB.
 *
 * Why 6 variants when acceptance is ≥3: the pack ships 6, and adding
 * them all costs nothing once the file copies land. Seed-cycling 6
 * variants reads as more variety than 3 with no extra code.
 */

import { A } from "./assetUrl";

export const DOOR_VARIANTS: readonly string[] = [
	A("/assets/models/props/doors/door_hr_6.glb"),
	A("/assets/models/props/doors/door_hr_8.glb"),
	A("/assets/models/props/doors/door_hr_12.glb"),
	A("/assets/models/props/doors/door_hr_13.glb"),
	A("/assets/models/props/doors/door_hr_14.glb"),
	A("/assets/models/props/doors/gate_1.glb"),
];

/**
 * Deterministic door variant pick. Same seed → same variant URL.
 * Uses unsigned right-shift to handle negative seeds safely.
 */
export function pickDoorUrl(seed: number): string {
	const idx = (seed >>> 0) % DOOR_VARIANTS.length;
	return DOOR_VARIANTS[idx];
}
