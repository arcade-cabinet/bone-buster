/**
 * COV8 step-1 — trap variant pool.
 *
 * 10 curated trap GLBs from `3DPSX/Props/Traps/` covering the 4
 * categories PRD §COV8 calls out:
 *   - spike traps (3 variants — floor spikes the player walks onto)
 *   - swinging/rotating blades (3 variants — guillotine + 2 spinners)
 *   - rolling/log hazards (2 variants — stone ball + spiked log)
 *   - pressure-plate / lever components (2 variants — lever + base)
 *
 * Step-1 ships the asset pool + kind discriminant + picker. Step-2
 * will wire the gameplay (tick damage on player overlap, lever-
 * disarm pairing with E6 secrets) on top of this.
 */

import { A } from "@assets/assetUrl";

export type TrapKind = "spike" | "blade" | "rolling" | "trigger";

export interface TrapDef {
	readonly id: string;
	readonly url: string;
	readonly kind: TrapKind;
}

export const TRAPS: readonly TrapDef[] = [
	{ id: "spikes_1", url: A("/assets/models/props/traps/Spikes_1.glb"), kind: "spike" },
	{ id: "spikes_2", url: A("/assets/models/props/traps/Spikes_2.glb"), kind: "spike" },
	{
		id: "spike_variant_1",
		url: A("/assets/models/props/traps/Spike_Variant_1.glb"),
		kind: "spike",
	},
	{
		id: "blade_guillotine",
		url: A("/assets/models/props/traps/Blade_Guillotine.glb"),
		kind: "blade",
	},
	{
		id: "blades_rotating",
		url: A("/assets/models/props/traps/Blades_Rotating.glb"),
		kind: "blade",
	},
	{
		id: "spinningblade_variant_1",
		url: A("/assets/models/props/traps/Spinningblade_Variant_1.glb"),
		kind: "blade",
	},
	{
		id: "stone_ball_spiked",
		url: A("/assets/models/props/traps/Stone_Ball_Spiked.glb"),
		kind: "rolling",
	},
	{
		id: "log_spiked_variant1",
		url: A("/assets/models/props/traps/Log_Spiked_Variant1.glb"),
		kind: "rolling",
	},
	{ id: "lever", url: A("/assets/models/props/traps/Lever.glb"), kind: "trigger" },
	{ id: "base", url: A("/assets/models/props/traps/Base.glb"), kind: "trigger" },
];

/** Filter traps by kind. */
export function trapsByKind(kind: TrapKind): readonly TrapDef[] {
	return TRAPS.filter((t) => t.kind === kind);
}

/** Deterministic trap-def pick by hash. */
export function pickTrapDef(hash: number): TrapDef {
	const idx = (hash >>> 0) % TRAPS.length;
	const def = TRAPS[idx];
	if (def === undefined) throw new RangeError(`pickTrapDef: index ${idx} of ${TRAPS.length}`);
	return def;
}
