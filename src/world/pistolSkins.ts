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

// D19 cosmetic pick. seed=0 → USP (canonical baseline).
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
// PISTOL_SKIN_URLS is a fixed-length array; every index below is provably
// in-bounds. Hoisting each entry into a named const documents the invariant
// and satisfies noUncheckedIndexedAccess.
function pistolSkinUrl(i: number): string {
	const v = PISTOL_SKIN_URLS[i];
	if (v === undefined)
		throw new RangeError(
			`pistolSkinUrl: index ${i} out of bounds (len ${PISTOL_SKIN_URLS.length})`,
		);
	return v;
}
const _ps0 = pistolSkinUrl(0);
const _ps1 = pistolSkinUrl(1);
const _ps2 = pistolSkinUrl(2);
const _ps3 = pistolSkinUrl(3);

export const PISTOL_PROFILES: Readonly<Record<string, PistolProfile>> = {
	[_ps0]: DEFAULT_PISTOL_PROFILE, // usp (canonical)
	[_ps1]: { damageMul: 1.4, cooldownMul: 1.3 }, // handcannon
	[_ps2]: { damageMul: 1.15, cooldownMul: 1.05 }, // revolver
	[_ps3]: { damageMul: 0.7, cooldownMul: 0.7 }, // allegiance
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
