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

import { A } from "@assets/assetUrl";

export interface LargePropDef {
	readonly id: string;
	readonly url: string;
	readonly blocking: boolean;
	/**
	 * COV2 step-2 — collision radius in world units, used when
	 * `blocking === true`. Walked into via a circle pushout in
	 * resolveCollisionSectors. Non-blocking entries ignore this.
	 */
	readonly blockingRadius: number;
}

export const LARGE_PROPS: readonly LargePropDef[] = [
	{
		id: "cage_mx_1",
		url: A("/assets/models/props/large/cage_mx_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "chimney_a_1",
		url: A("/assets/models/props/large/chimney_a_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "distillery_mx_1",
		url: A("/assets/models/props/large/distillery_mx_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "electrical_equipment_1",
		url: A("/assets/models/props/large/electrical_equipment_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "electrical_equipment_2",
		url: A("/assets/models/props/large/electrical_equipment_2.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "machinery_mx_1",
		url: A("/assets/models/props/large/machinery_mx_1.glb"),
		blocking: true,
		blockingRadius: 0.8,
	},
	{
		id: "portal_mx_1",
		url: A("/assets/models/props/large/portal_mx_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "pipe_ax_1",
		url: A("/assets/models/props/large/pipe_ax_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "shipping_container_mx_1_1",
		url: A("/assets/models/props/large/shipping_container_mx_1_1.glb"),
		blocking: true,
		blockingRadius: 0.9,
	},
	{
		id: "pipes_hr_1",
		url: A("/assets/models/props/large/pipes_hr_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	// PE4b — sewer-industrial additions from PSX Mega Pack II Large
	// Props & Machinery. Extends the variant pool from 10 → 16. Each
	// rolls in via the same deterministic hash picker as the existing
	// entries; per-archetype steering is a later subsystem if/when
	// the largeProps subsystem gains per-archetype scoping.
	{
		id: "chimney_a_2",
		url: A("/assets/models/props/large/chimney_a_2.glb"),
		blocking: false,
		blockingRadius: 0,
	},
	{
		id: "shipping_container_mx_2",
		url: A("/assets/models/props/large/shipping_container_mx_2.glb"),
		blocking: true,
		blockingRadius: 0.9,
	},
	{
		id: "storage_tank_mx_1",
		url: A("/assets/models/props/large/storage_tank_mx_1.glb"),
		blocking: true,
		blockingRadius: 0.8,
	},
	{
		id: "tank_system_mx_1",
		url: A("/assets/models/props/large/tank_system_mx_1.glb"),
		blocking: true,
		blockingRadius: 1.0,
	},
	// NOTE: wires_holder_hr_large_1 was dropped — its GLB shipped corrupt
	// (zero-magic, born broken in #75) with no recoverable source. The
	// sibling wires_hr_1 covers the "wires" set-dressing slot.
	{
		id: "wires_hr_1",
		url: A("/assets/models/props/large/wires_hr_1.glb"),
		blocking: false,
		blockingRadius: 0,
	},
];

/** Deterministic large-prop pick by hash. */
export function pickLargePropDef(hash: number): LargePropDef {
	const idx = (hash >>> 0) % LARGE_PROPS.length;
	return LARGE_PROPS[idx];
}
