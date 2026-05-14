/**
 * COV2 step-1 — Large Props & Machinery variant pool.
 *
 * 10 curated GLBs from the 52-file PSX Mega Pack II "Large Props &
 * Machinery" pack. Each is a hero-sized environmental piece (cage,
 * chimney, distillery, electrical gear, machinery, portal,
 * pipes, shipping container) — these are FOV-dominating set-dressing,
 * not scatter props. Step-2 will spawn 1-2 per archetype-appropriate
 * sector as anchor pieces (not the 2-5 per sector that COV4 props
 * use).
 *
 * Two of the 10 are flagged blocking (machinery + shipping container)
 * because their physical scale makes "walk through them" feel wrong.
 * The rest stay collision-flat by default — the player can squeeze
 * past pipes and cages.
 */

import { A } from "./assetUrl";

export interface LargePropDef {
	readonly id: string;
	readonly url: string;
	readonly blocking: boolean;
}

export const LARGE_PROPS: readonly LargePropDef[] = [
	{ id: "cage_mx_1", url: A("/assets/models/props/large/cage_mx_1.glb"), blocking: false },
	{ id: "chimney_a_1", url: A("/assets/models/props/large/chimney_a_1.glb"), blocking: false },
	{
		id: "distillery_mx_1",
		url: A("/assets/models/props/large/distillery_mx_1.glb"),
		blocking: false,
	},
	{
		id: "electrical_equipment_1",
		url: A("/assets/models/props/large/electrical_equipment_1.glb"),
		blocking: false,
	},
	{
		id: "electrical_equipment_2",
		url: A("/assets/models/props/large/electrical_equipment_2.glb"),
		blocking: false,
	},
	{
		id: "machinery_mx_1",
		url: A("/assets/models/props/large/machinery_mx_1.glb"),
		blocking: true,
	},
	{ id: "portal_mx_1", url: A("/assets/models/props/large/portal_mx_1.glb"), blocking: false },
	{ id: "pipe_ax_1", url: A("/assets/models/props/large/pipe_ax_1.glb"), blocking: false },
	{
		id: "shipping_container_mx_1_1",
		url: A("/assets/models/props/large/shipping_container_mx_1_1.glb"),
		blocking: true,
	},
	{ id: "pipes_hr_1", url: A("/assets/models/props/large/pipes_hr_1.glb"), blocking: false },
];

/** Deterministic large-prop pick by hash. */
export function pickLargePropDef(hash: number): LargePropDef {
	const idx = (hash >>> 0) % LARGE_PROPS.length;
	return LARGE_PROPS[idx];
}
