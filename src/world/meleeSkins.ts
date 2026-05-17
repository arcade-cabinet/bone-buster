/**
 * COV9 step-1 — melee variant cycling.
 *
 * E1 shipped the BLADE slot with a single machete viewmodel. COV9
 * extends it to a 7-skin roster cycled per-run via `pickMeleeSkin
 * (level.seed)`. The set covers the slasher pack's 5 originals
 * (axe / chainsaw / knife / machete / meathook) plus two loose
 * additions (cleaver / sword) — every entry reads cleanly at
 * FPS scale with the existing rotation/offset.
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

export const MELEE_SKIN_URLS: readonly string[] = [
	A("/assets/models/weapons/slasher/melee_machete.glb"), // E1 default
	A("/assets/models/weapons/slasher/melee_axe.glb"),
	A("/assets/models/weapons/slasher/melee_chainsaw.glb"),
	A("/assets/models/weapons/slasher/melee_knife.glb"),
	A("/assets/models/weapons/slasher/melee_meathook.glb"),
	A("/assets/models/weapons/slasher/melee_cleaver.glb"),
	A("/assets/models/weapons/slasher/melee_sword.glb"),
];

/**
 * Deterministic per-run melee skin pick. Uses unsigned right-shift
 * so negative seeds are safe. Index 0 (`melee_machete`) is the E1
 * default — `pickMeleeSkin(0)` returns it for back-compat with the
 * existing canonical screenshots.
 */
export function pickMeleeSkin(seed: number): string {
	const idx = (seed >>> 0) % MELEE_SKIN_URLS.length;
	return MELEE_SKIN_URLS[idx];
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
	 * Reserved for future use — knockback impulse multiplier applied at
	 * hit time. Negative values pull the target toward the player
	 * (meathook gameplay quirk). Neither PB4 step-1 nor step-2 consumes
	 * this field: the swing-resolution path doesn't yet have a knockback
	 * apply site, and adding one requires a player-mass / impulse system
	 * the current sim doesn't have. The field lives in the table shape
	 * now so the eventual gameplay-design follow-up doesn't have to
	 * rework the schema.
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
 *              damage. The "loud-attract" property in the directive
 *              is realised by the audio/AI layer in step-2; this
 *              table only owns the damage/timing dimensions.
 *   knife    — fastest, weakest. +75% swing rate, -45% damage.
 *   meathook — identity damage/timing, but a pull-style knockback
 *              (-1.0 = full impulse toward player).
 *   cleaver  — heavy-medium. -20% swing rate, +27% damage.
 *   sword    — balanced upgrade. +10% damage, +10% swing rate.
 */
export const MELEE_PROFILES: Readonly<Record<string, MeleeProfile>> = {
	[MELEE_SKIN_URLS[0]]: DEFAULT_MELEE_PROFILE, // machete (E1 default)
	[MELEE_SKIN_URLS[1]]: { damageMul: 1.5, cooldownMul: 1.5, knockbackMul: 1 }, // axe
	[MELEE_SKIN_URLS[2]]: { damageMul: 0.73, cooldownMul: 0.7, knockbackMul: 1 }, // chainsaw
	[MELEE_SKIN_URLS[3]]: { damageMul: 0.55, cooldownMul: 0.57, knockbackMul: 1 }, // knife
	[MELEE_SKIN_URLS[4]]: { damageMul: 1, cooldownMul: 1, knockbackMul: -1 }, // meathook (pull)
	[MELEE_SKIN_URLS[5]]: { damageMul: 1.27, cooldownMul: 1.2, knockbackMul: 1 }, // cleaver
	[MELEE_SKIN_URLS[6]]: { damageMul: 1.1, cooldownMul: 0.9, knockbackMul: 1 }, // sword
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
