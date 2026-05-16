/**
 * D9 — per-weapon skin rotation for chaingun + pistol.
 *
 * Mirrors src/world/meleeSkins.ts's pattern (COV9). Each weapon
 * has a small URL pool + a deterministic seed-derived picker.
 *
 * Pistol pool (2 skins):
 *   - Default: pistol.glb (the USP from the PSX hands pack, current
 *     E1 canon).
 *   - Variant: pistol_handcannon.glb (the references/Handcannon.glb
 *     asset promoted in this commit — a chunkier revolver silhouette).
 *
 * Chaingun pool (1 skin currently):
 *   - Default: chaingun.glb (the Uzi from the slasher pack, current
 *     canon). PRD §D9 listed the Uzi explicitly; it's already wired
 *     here. The pool is preserved as a single-entry array so a
 *     future Uzi skin variant fits in without restructuring the
 *     picker — same shape as PISTOL_SKIN_URLS.
 *
 * Wiring: WeaponViewmodel reads these arrays via pickWeaponSkin()
 * at mount time, passing the picked URL into the existing
 * WEAPON_MODELS.pistol / .chaingun.url field. Step-1 of D9 ships
 * the URL pool + picker + reachability test; step-2 will swap the
 * runtime resolution path (same pattern as COV9 step-1 vs step-2
 * for melee).
 */

import { A } from "@assets/assetUrl";
import type { WeaponId } from "@shared/weapons";

export const PISTOL_SKIN_URLS: readonly string[] = [
	A("/assets/models/weapons/pistol.glb"),
	A("/assets/models/weapons/pistol_handcannon.glb"),
];

export const CHAINGUN_SKIN_URLS: readonly string[] = [A("/assets/models/weapons/chaingun.glb")];

/**
 * Deterministic per-run weapon-skin pick. Returns the default
 * (index 0) when the pool has only one entry, so the picker is
 * a no-op for chaingun until a variant lands.
 *
 * Throws when called for melee/shotgun/flamethrower — those have
 * their own dedicated picker modules (meleeSkins.ts) or no skin
 * variation in this slice. The throw is the type-narrow path that
 * keeps the WeaponViewmodel call site honest at compile time
 * (TypeScript can prove the input is one of the supported kinds).
 */
export function pickWeaponSkin(weapon: WeaponId, seed: number): string {
	const pool =
		weapon === "pistol" ? PISTOL_SKIN_URLS : weapon === "chaingun" ? CHAINGUN_SKIN_URLS : null;
	if (pool === null) {
		throw new Error(`pickWeaponSkin: no skin pool for weapon "${weapon}"`);
	}
	const idx = (seed >>> 0) % pool.length;
	return pool[idx];
}
