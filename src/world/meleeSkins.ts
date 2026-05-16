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
