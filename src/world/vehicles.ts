/**
 * COV10 step-1 — wrecked-vehicle prop pool.
 *
 * 3 GLBs from `3DPSX/Vehicles/PS1-RVS/` for courtyard set-dressing.
 * PRD §COV10 acceptance: "at least one wrecked-vehicle prop spawns as
 * a permanent piece of set-dressing in the courtyard archetype."
 *
 * Step-1 ships the asset pool + picker; step-2 wires placement in
 * propScatter (or a sibling) gated on archetype === "courtyard".
 */

import { A } from "@assets/assetUrl";

export const VEHICLE_VARIANTS: readonly string[] = [
	A("/assets/models/props/vehicles/RV1.glb"),
	A("/assets/models/props/vehicles/RV2.glb"),
	A("/assets/models/props/vehicles/RV3.glb"),
];

/** Deterministic vehicle-variant pick by seed. */
export function pickVehicleUrl(seed: number): string {
	const idx = (seed >>> 0) % VEHICLE_VARIANTS.length;
	const url = VEHICLE_VARIANTS[idx];
	if (url === undefined)
		throw new RangeError(`pickVehicleUrl: index ${idx} of ${VEHICLE_VARIANTS.length}`);
	return url;
}
