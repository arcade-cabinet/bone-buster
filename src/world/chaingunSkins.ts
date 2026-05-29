/**
 * PD3 — chaingun skin pool. Mirrors COV9/PB4/PD1 — a deterministic
 * per-run skin pool plus per-skin profile multipliers against the
 * base `WEAPONS.chaingun` spec.
 *
 * Index 0 is the canonical chaingun.glb already shipping in
 * `WEAPON_MODELS.chaingun.url`. Every canonical screenshot at
 * seed=0 expects this skin so `pickChaingunSkin(0)` MUST return
 * the index-0 entry. PD3 adds two variants from the unwired
 * references/_extracted asset pool (Uzi, Flamethrower body).
 *
 * The "Stylized Guns 3D Models PRO" pack ZIP requires a Blender
 * scene-split (single combined FBX → N individual GLBs) before
 * its variants can join the pool — tracked as a follow-up
 * architectural slice. PD3 ships the trivially-available variants
 * now and leaves the scene-split slice to land independently.
 */

import { A } from "@assets/assetUrl";
import { COSMETIC_TAGS, pickCosmeticOnce } from "@engine/prng";

export const CHAINGUN_SKIN_URLS: readonly string[] = [
	A("/assets/models/weapons/chaingun.glb"), // canonical (seed=0)
	A("/assets/models/weapons/chaingun-skins/chaingun_uzi.glb"),
	A("/assets/models/weapons/chaingun-skins/chaingun_flamethrower.glb"),
	// PD3b — Stylized Guns 3D Models PRO scene-split additions. Append-only
	// at indices 3..5; under D19 (cosmetic stream) only the seed=0 baseline
	// is byte-locked (short-circuit to index 0). Non-zero seeds re-roll
	// through the alea stream — pool growth no longer needs index-stability.
	A("/assets/models/weapons/chaingun-skins/chaingun_ak47.glb"),
	A("/assets/models/weapons/chaingun-skins/chaingun_mac10.glb"),
	A("/assets/models/weapons/chaingun-skins/chaingun_pm9.glb"),
];

// D19 cosmetic pick. seed=0 → canonical chaingun.glb (canonical baseline).
export function pickChaingunSkin(seed: number): string {
	return pickCosmeticOnce(seed, COSMETIC_TAGS.CHAINGUN, CHAINGUN_SKIN_URLS);
}

export type ChaingunProfile = Readonly<{
	damageMul: number;
	cooldownMul: number;
}>;

export const DEFAULT_CHAINGUN_PROFILE: ChaingunProfile = {
	damageMul: 1,
	cooldownMul: 1,
};

/**
 * Per-skin profile registry. Every URL in CHAINGUN_SKIN_URLS MUST
 * have an entry; the contract test pins this.
 *
 *   chaingun (canonical) — identity. Seed=0 baseline.
 *   uzi                  — fast-spray: -15% damage per shot, -15%
 *                          cooldown (faster cyclic). Net DPS roughly
 *                          flat; feel is twitchier than the canonical.
 *   flamethrower (body)  — heavy-burst: +30% damage, +25% cooldown.
 *                          Reads as a single hard-hitting weapon rather
 *                          than a stream; the actual flamethrower slot
 *                          stays its own weapon with its own particle
 *                          path — this entry is the model only.
 */
// CHAINGUN_SKIN_URLS is a fixed-length array; every index below is provably
// in-bounds. Hoisting each entry into a named const documents the invariant
// and satisfies noUncheckedIndexedAccess.
function chaingunSkinUrl(i: number): string {
	const v = CHAINGUN_SKIN_URLS[i];
	if (v === undefined)
		throw new RangeError(
			`chaingunSkinUrl: index ${i} out of bounds (len ${CHAINGUN_SKIN_URLS.length})`,
		);
	return v;
}
const _cg0 = chaingunSkinUrl(0);
const _cg1 = chaingunSkinUrl(1);
const _cg2 = chaingunSkinUrl(2);
const _cg3 = chaingunSkinUrl(3);
const _cg4 = chaingunSkinUrl(4);
const _cg5 = chaingunSkinUrl(5);

export const CHAINGUN_PROFILES: Readonly<Record<string, ChaingunProfile>> = {
	[_cg0]: DEFAULT_CHAINGUN_PROFILE, // canonical
	[_cg1]: { damageMul: 0.85, cooldownMul: 0.85 }, // uzi
	[_cg2]: { damageMul: 1.3, cooldownMul: 1.25 }, // flamethrower
	// PD3b additions. AK-47 = punchier rifle (+10% damage, +10%
	// cooldown — feel reads as "heavy controlled bursts"). MAC-10 =
	// faster cyclic SMG (-10% damage, -20% cooldown). PM-9 = balanced
	// pistol-style auto (identity damage, +5% cooldown — slight
	// trigger discipline).
	[_cg3]: { damageMul: 1.1, cooldownMul: 1.1 }, // ak47
	[_cg4]: { damageMul: 0.9, cooldownMul: 0.8 }, // mac10
	[_cg5]: { damageMul: 1.0, cooldownMul: 1.05 }, // pm9
};

export function profileForChaingunSkin(url: string): ChaingunProfile {
	return CHAINGUN_PROFILES[url] ?? DEFAULT_CHAINGUN_PROFILE;
}

export function pickChaingunProfile(seed: number): ChaingunProfile {
	return profileForChaingunSkin(pickChaingunSkin(seed));
}
