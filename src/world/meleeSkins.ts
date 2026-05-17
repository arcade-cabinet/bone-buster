/**
 * COV9 step-1 — melee variant cycling.
 *
 * E1 shipped the BLADE slot with a single machete viewmodel. COV9
 * extended it to 7 skins; PD2 grows the roster to 14 by appending
 * the baseball bat, katana, and 5 knife variants from the unwired
 * references/ extractions. The set covers the slasher pack's 5
 * originals (axe / chainsaw / knife / machete / meathook), two
 * loose additions (cleaver / sword), and the PD2 additions
 * (baseball bat / katana / knife_1..5) — every entry reads cleanly
 * at FPS scale with the existing rotation/offset.
 *
 * Append-only ordering: index 0 (machete) MUST stay the E1 default
 * because every canonical screenshot pinned at seed=0 expects it.
 * PD2 additions land at indices 7..13 to preserve seed=N invariants
 * for the COV9 roster.
 *
 * Step-1 ships the URL pool + picker. The WeaponViewmodel/models.ts
 * wiring swap (passing the picked URL into WEAPON_MODELS.melee at
 * mount time) is step-2 — it touches the runtime weapon resolution
 * path which deserves its own commit.
 *
 * PB4 step-1 — per-skin damage-profile table. Each melee URL pairs
 * with a `MeleeProfile` that multiplies the base
 * `WEAPONS.melee` cooldown + damage so the chainsaw hits faster but
 * weaker, the axe hits slower but harder, and the meathook gets a
 * knockback bonus. The profile is resolved per-run via
 * `pickMeleeProfile(seed)` alongside the existing skin picker so the
 * two stay in lockstep. Wire-in into fireResolution.ts is step-2.
 */

import { A } from "@assets/assetUrl";
import { COSMETIC_TAGS, pickCosmeticOnce } from "@engine/prng";

export const MELEE_SKIN_URLS: readonly string[] = [
	A("/assets/models/weapons/slasher/melee_machete.glb"), // E1 default — canonical (seed=0)
	A("/assets/models/weapons/slasher/melee_axe.glb"),
	A("/assets/models/weapons/slasher/melee_chainsaw.glb"),
	A("/assets/models/weapons/slasher/melee_knife.glb"),
	A("/assets/models/weapons/slasher/melee_meathook.glb"),
	A("/assets/models/weapons/slasher/melee_cleaver.glb"),
	A("/assets/models/weapons/slasher/melee_sword.glb"),
	// PD2 — additions. Append-only to preserve index 0 (machete) +
	// every existing index for byte-stability of canonical screenshots.
	A("/assets/models/weapons/slasher/melee_baseball_bat.glb"),
	A("/assets/models/weapons/slasher/melee_katana.glb"),
	A("/assets/models/weapons/slasher/melee_knife_1.glb"),
	A("/assets/models/weapons/slasher/melee_knife_2.glb"),
	A("/assets/models/weapons/slasher/melee_knife_3.glb"),
	A("/assets/models/weapons/slasher/melee_knife_4.glb"),
	A("/assets/models/weapons/slasher/melee_knife_5.glb"),
];

// D19 cosmetic pick. seed=0 → machete (canonical baseline).
export function pickMeleeSkin(seed: number): string {
	return pickCosmeticOnce(seed, COSMETIC_TAGS.MELEE, MELEE_SKIN_URLS);
}

/**
 * PB4 — per-skin damage profile. Multipliers compose against the
 * base WEAPONS.melee spec (damage 55 / cooldown 420ms) so the canonical
 * machete (identity profile = all 1.0) preserves the existing balance
 * and per-skin entries are read as deltas, not absolutes.
 *
 * `knockbackMul` is forward-looking: the current melee path doesn't
 * apply knockback yet, but PB4 step-2 plumbs it through the swing
 * resolver — meathook is the gameplay-distinct one (pull-style
 * knockback via the negative value) so the field is in the table
 * shape now to avoid a follow-up schema change.
 */
export type MeleeProfile = Readonly<{
	/** Final swing damage = base × damageMul. */
	damageMul: number;
	/** Final swing cooldown = base × cooldownMul. <1 = faster, >1 = slower. */
	cooldownMul: number;
	/**
	 * SLA2 — loud-attract aggro radius in tiles. Every swing flips any
	 * patrolling enemy within this radius to chase state. 0 (or omitted)
	 * = silent (the default for every skin except chainsaw). Honored by
	 * fireResolution.ts on melee swing.
	 */
	attractRadiusTiles?: number;
	/**
	 * SLA1 — knockback impulse multiplier. Positive values are reserved
	 * for push-away (no current skin uses it). Negative values pull the
	 * target toward the player: meathook (-1.0) lurches the enemy ~1
	 * tile closer on hit. Honored by fireResolution.ts on melee hit;
	 * bosses are immune.
	 */
	knockbackMul: number;
}>;

/** Identity profile — equivalent to the unmodified WEAPONS.melee spec. */
export const DEFAULT_MELEE_PROFILE: MeleeProfile = {
	damageMul: 1,
	cooldownMul: 1,
	knockbackMul: 1,
};

/**
 * Per-skin profile registry. Keys are the entries in MELEE_SKIN_URLS;
 * every URL must have an entry (the contract test pins this).
 *
 *   machete  — identity. The E1 baseline; canonical screenshots depend
 *              on this.
 *   axe      — heavy-slow. -33% swing rate, +50% damage.
 *   chainsaw — fast-loud. +43% swing rate (cooldown 420→294ms), -27%
 *              damage. Loud-attract: every swing flips patrolling
 *              enemies within 8 tiles to chase (SLA2).
 *   knife    — fastest, weakest. +75% swing rate, -45% damage.
 *   meathook — identity damage/timing, but a pull-style knockback
 *              (-1.0 = full impulse toward player).
 *   cleaver  — heavy-medium. -20% swing rate, +27% damage.
 *   sword    — balanced upgrade. +10% damage, +10% swing rate.
 */
export const MELEE_PROFILES: Readonly<Record<string, MeleeProfile>> = {
	[MELEE_SKIN_URLS[0]]: DEFAULT_MELEE_PROFILE, // machete (E1 default)
	[MELEE_SKIN_URLS[1]]: { damageMul: 1.5, cooldownMul: 1.5, knockbackMul: 1 }, // axe
	[MELEE_SKIN_URLS[2]]: {
		damageMul: 0.73,
		cooldownMul: 0.7,
		knockbackMul: 1,
		attractRadiusTiles: 8,
	}, // chainsaw
	[MELEE_SKIN_URLS[3]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife
	[MELEE_SKIN_URLS[4]]: { damageMul: 1, cooldownMul: 1, knockbackMul: -1 }, // meathook (pull)
	[MELEE_SKIN_URLS[5]]: { damageMul: 1.27, cooldownMul: 1.2, knockbackMul: 1 }, // cleaver
	[MELEE_SKIN_URLS[6]]: { damageMul: 1.1, cooldownMul: 0.9, knockbackMul: 1 }, // sword
	// PD2 — additions. Baseball bat = wide-arc heavy (+30% damage,
	// +20% cooldown). Katana = balanced upgrade (+15% damage, -5%
	// cooldown). Knife_1..5 = visually-distinct knife variants sharing
	// the base knife profile (0.55× / 0.57×) — players see a different
	// blade silhouette, identical mechanics.
	[MELEE_SKIN_URLS[7]]: { damageMul: 1.3, cooldownMul: 1.2, knockbackMul: 1 }, // baseball bat
	[MELEE_SKIN_URLS[8]]: { damageMul: 1.15, cooldownMul: 0.95, knockbackMul: 1 }, // katana
	[MELEE_SKIN_URLS[9]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife_1
	[MELEE_SKIN_URLS[10]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife_2
	[MELEE_SKIN_URLS[11]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife_3
	[MELEE_SKIN_URLS[12]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife_4
	[MELEE_SKIN_URLS[13]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife_5
};

/**
 * Resolves the profile for a given skin URL. Falls back to the
 * identity profile if the URL is unknown — protects callers from
 * a future asset addition that forgets a profile entry (the contract
 * test catches this in CI, but the runtime stays predictable).
 */
export function profileForMeleeSkin(url: string): MeleeProfile {
	return MELEE_PROFILES[url] ?? DEFAULT_MELEE_PROFILE;
}

/**
 * Convenience — pick a skin AND its profile from one seed. The two
 * always travel together at runtime; this avoids the call-site mistake
 * of picking a skin from seed A and a profile from seed B and getting
 * a desync between viewmodel + damage numbers.
 */
export function pickMeleeProfile(seed: number): MeleeProfile {
	return profileForMeleeSkin(pickMeleeSkin(seed));
}
