/**
 * STRUCT4 — log-scaled weapon UPGRADE tiers. A weapon starts at tier 0 (its base
 * spec); each tier found in the descent improves it along the axes that fit the
 * weapon — fire rate (shorter cooldown), damage, multi-shot (more pellets), and
 * tighter spread. Scaling is LOG-shaped per tier so early upgrades feel big and
 * deep stacks don't trivialize the game (endless play).
 *
 * Pure: `effectiveWeaponSpec(base, tier)` returns the tier-adjusted spec. Tier 0
 * returns the base unchanged (byte-identical to today's combat).
 */

import type { WeaponSpec } from "@shared/weapons";

/** Max tier a weapon can reach (5 upgrades past base). */
export const MAX_WEAPON_TIER = 5;

/** Log-shaped factor for `tier` upgrades — fast early, flattening. */
function tierFactor(tier: number): number {
	if (tier <= 0) return 0;
	// log2(tier+1): tier1→1, tier2→1.58, tier3→2, tier5→2.58.
	return Math.log2(tier + 1);
}

/**
 * Apply `tier` upgrades to a base weapon spec. Each weapon improves on the axes
 * that suit it; the magnitudes are tuned so tier 5 is a clear power spike
 * without breaking the cooldown floor / spread floor.
 *
 * - cooldownMs: shrinks toward a floor (faster fire) — every weapon.
 * - damage: grows — every weapon.
 * - pellets: multi-shot weapons (pellets ≥ 1) gain pellets at higher tiers;
 *   single-pellet hitscan weapons stay 1 (an extra pellet there would be a
 *   second ray, which we reserve for the genuinely multi-shot weapons).
 * - spreadRad: tightens toward a floor for spread weapons (better accuracy).
 */
export function effectiveWeaponSpec(base: WeaponSpec, tier: number): WeaponSpec {
	const clamped = Math.max(0, Math.min(MAX_WEAPON_TIER, Math.floor(tier)));
	if (clamped === 0) return base;
	const f = tierFactor(clamped);

	// Fire rate: up to ~45% faster at tier 5, floored so it never hits 0.
	const cooldownMs = Math.max(40, Math.round(base.cooldownMs * (1 - 0.18 * f)));
	// Damage: +~22% per log-tier.
	const damage = Math.round(base.damage * (1 + 0.22 * f));
	// Multi-shot: spread weapons (pellets > 1) gain +1 pellet per 2 tiers.
	const pellets = base.pellets > 1 ? base.pellets + Math.floor(clamped / 2) : base.pellets;
	// Spread: tighten toward 30% of base for spread weapons (accuracy reward).
	const spreadRad =
		base.spreadRad > 0 ? base.spreadRad * Math.max(0.3, 1 - 0.14 * f) : base.spreadRad;

	return { ...base, cooldownMs, damage, pellets, spreadRad };
}
