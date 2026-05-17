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

export const CHAINGUN_SKIN_URLS: readonly string[] = [
	A("/assets/models/weapons/chaingun.glb"), // canonical (seed=0)
	A("/assets/models/weapons/chaingun-skins/chaingun_uzi.glb"),
	A("/assets/models/weapons/chaingun-skins/chaingun_flamethrower.glb"),
];

export function pickChaingunSkin(seed: number): string {
	const idx = (seed >>> 0) % CHAINGUN_SKIN_URLS.length;
	return CHAINGUN_SKIN_URLS[idx];
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
export const CHAINGUN_PROFILES: Readonly<Record<string, ChaingunProfile>> = {
	[CHAINGUN_SKIN_URLS[0]]: DEFAULT_CHAINGUN_PROFILE, // canonical
	[CHAINGUN_SKIN_URLS[1]]: { damageMul: 0.85, cooldownMul: 0.85 }, // uzi
	[CHAINGUN_SKIN_URLS[2]]: { damageMul: 1.3, cooldownMul: 1.25 }, // flamethrower
};

export function profileForChaingunSkin(url: string): ChaingunProfile {
	return CHAINGUN_PROFILES[url] ?? DEFAULT_CHAINGUN_PROFILE;
}

export function pickChaingunProfile(seed: number): ChaingunProfile {
	return profileForChaingunSkin(pickChaingunSkin(seed));
}
