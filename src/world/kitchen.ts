/**
 * COV13 step-1 — kitchen prop pool.
 *
 * 10 curated kitchen GLBs from `3DPSX/Props/Kitchen/` (out of the
 * 48-file pack). Mix of bowls, drinks, food packaging, a chair, and
 * cutlery — reads as a real kitchen at a glance.
 *
 * Step-1 ships the asset pool + picker; step-2 wires placement into
 * a future "kitchen" archetype (or as set-dressing in library /
 * courtyard sectors). PRD §COV13 wants these as kitchen-archetype
 * set-dressing, but a new archetype isn't blocked on this commit —
 * the picker can be used as a sibling pool to the COV4 propPool
 * already.
 */

import { A } from "@assets/assetUrl";

export const KITCHEN_PROPS: readonly string[] = [
	A("/assets/models/props/kitchen/bowl_01.glb"),
	A("/assets/models/props/kitchen/bowl_02.glb"),
	A("/assets/models/props/kitchen/chair.glb"),
	A("/assets/models/props/kitchen/beer_bottle.glb"),
	A("/assets/models/props/kitchen/can_cola_cola.glb"),
	A("/assets/models/props/kitchen/butter_knife.glb"),
	A("/assets/models/props/kitchen/Pizza_box_close.glb"),
	A("/assets/models/props/kitchen/chocolate_bar_close.glb"),
	A("/assets/models/props/kitchen/Chipsy_Chunks_box.glb"),
	A("/assets/models/props/kitchen/can_beer.glb"),
];

/** Deterministic kitchen-prop pick by hash. */
export function pickKitchenProp(hash: number): string {
	const idx = (hash >>> 0) % KITCHEN_PROPS.length;
	const url = KITCHEN_PROPS[idx];
	if (url === undefined)
		throw new RangeError(`pickKitchenProp: index ${idx} of ${KITCHEN_PROPS.length}`);
	return url;
}
