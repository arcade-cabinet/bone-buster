/**
 * PD1 — pistol skin pool. Mirrors the COV9/PB4 melee architecture:
 * a URL pool deterministically picked per-run, plus a per-skin profile
 * table that multiplies the base WEAPONS.pistol damage + cooldown.
 *
 * URL ordering matters — index 0 is the canonical "identity" skin
 * (USP-S), so `pickPistolSkin(0)` returns the baseline used by every
 * canonical screenshot test pinned with `seed=0`. Adding skins to the
 * pool MUST preserve the index-0 entry to keep byte-stability.
 *
 * The wire-in into the WeaponViewmodel runtime model resolution lives
 * in this same module's `pickPistolSkin` consumer (Shell.tsx passes
 * the picked URL into the viewmodel similarly to the melee path).
 */

import { A } from "@assets/assetUrl";
import { COSMETIC_TAGS, pickCosmeticOnce } from "@engine/prng";

export const PISTOL_SKIN_URLS: readonly string[] = [
	A("/assets/models/weapons/pistol-skins/pistol_usp.glb"), // identity (canonical)
	A("/assets/models/weapons/pistol-skins/pistol_handcannon.glb"),
	A("/assets/models/weapons/pistol-skins/pistol_revolver.glb"),
	A("/assets/models/weapons/pistol-skins/pistol_allegiance.glb"),
];

/**
 * Deterministic per-run pistol skin pick. Routes through the D19
 * cosmetic-stream API: `pickCosmeticOnce(seed, PISTOL_TAG, pool)`. Index 0
 * (USP-S) is the canonical baseline; `pickPistolSkin(0)` short-circuits
 * via D19 to `PISTOL_SKIN_URLS[0]` so the canonical screenshot battery
 * stays byte-stable.
 */
export function pickPistolSkin(seed: number): string {
	return pickCosmeticOnce(seed, COSMETIC_TAGS.PISTOL, PISTOL_SKIN_URLS);
}

/**
 * Per-skin profile table. Multipliers compose against the base
 * `WEAPONS.pistol` spec (damage 25 / cooldown 250ms) so the canonical
 * USP-S (identity profile = all 1.0) preserves existing balance and
 * the per-skin entries are read as deltas, not absolutes.
 */
export type PistolProfile = Readonly<{
	/** Final shot damage = base × damageMul. */
	damageMul: number;
	/** Final cooldown = base × cooldownMul. <1 = faster, >1 = slower. */
	cooldownMul: number;
}>;

export const DEFAULT_PISTOL_PROFILE: PistolProfile = {
	damageMul: 1,
	cooldownMul: 1,
};

/**
 * Per-skin profiles, keyed by URL. Every entry in `PISTOL_SKIN_URLS`
 * MUST have a profile here — the contract test pins this.
 *
 *   usp        — identity. The canonical baseline (seed=0).
 *   handcannon — heavy-slow. +40% damage, +30% cooldown.
 *   revolver   — balanced upgrade. +15% damage, +5% cooldown.
 *   allegiance — SMG-style fast-weak. -30% damage, -30% cooldown.
 */
export const PISTOL_PROFILES: Readonly<Record<string, PistolProfile>> = {
	[PISTOL_SKIN_URLS[0]]: DEFAULT_PISTOL_PROFILE, // usp (canonical)
	[PISTOL_SKIN_URLS[1]]: { damageMul: 1.4, cooldownMul: 1.3 }, // handcannon
	[PISTOL_SKIN_URLS[2]]: { damageMul: 1.15, cooldownMul: 1.05 }, // revolver
	[PISTOL_SKIN_URLS[3]]: { damageMul: 0.7, cooldownMul: 0.7 }, // allegiance
};

export function profileForPistolSkin(url: string): PistolProfile {
	return PISTOL_PROFILES[url] ?? DEFAULT_PISTOL_PROFILE;
}

/**
 * Pick a skin AND its profile from one seed. The two travel together
 * at runtime; this avoids the call-site mistake of picking a skin from
 * seed A and a profile from seed B and getting a viewmodel/damage
 * desync.
 */
export function pickPistolProfile(seed: number): PistolProfile {
	return profileForPistolSkin(pickPistolSkin(seed));
}
