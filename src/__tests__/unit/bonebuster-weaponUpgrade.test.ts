/**
 * STRUCT4 — weapon upgrade tier math contract.
 */

import { WEAPONS } from "@shared/weapons";
import { effectiveWeaponSpec, MAX_WEAPON_TIER } from "@shared/weaponUpgrade";
import { describe, expect, it } from "vitest";

describe("STRUCT4 — effectiveWeaponSpec", () => {
	it("tier 0 returns the base spec unchanged (no combat drift)", () => {
		for (const w of Object.values(WEAPONS)) {
			expect(effectiveWeaponSpec(w, 0)).toBe(w);
		}
	});

	it("higher tier = faster fire + more damage (monotonic)", () => {
		const base = WEAPONS.chaingun;
		let prevCd = base.cooldownMs;
		let prevDmg = base.damage;
		for (let t = 1; t <= MAX_WEAPON_TIER; t += 1) {
			const s = effectiveWeaponSpec(base, t);
			expect(s.cooldownMs).toBeLessThanOrEqual(prevCd);
			expect(s.damage).toBeGreaterThanOrEqual(prevDmg);
			prevCd = s.cooldownMs;
			prevDmg = s.damage;
		}
	});

	it("cooldown never drops below the floor", () => {
		const s = effectiveWeaponSpec(WEAPONS.chaingun, MAX_WEAPON_TIER);
		expect(s.cooldownMs).toBeGreaterThanOrEqual(40);
	});

	it("spread weapons gain pellets at higher tiers; hitscan stays single", () => {
		// shotgun is multi-pellet.
		const sg = effectiveWeaponSpec(WEAPONS.shotgun, MAX_WEAPON_TIER);
		expect(sg.pellets).toBeGreaterThan(WEAPONS.shotgun.pellets);
		// pistol is single-pellet hitscan → stays 1.
		const ps = effectiveWeaponSpec(WEAPONS.pistol, MAX_WEAPON_TIER);
		expect(ps.pellets).toBe(WEAPONS.pistol.pellets);
	});

	it("spread tightens but never below 30% of base", () => {
		const base = WEAPONS.shotgun;
		const s = effectiveWeaponSpec(base, MAX_WEAPON_TIER);
		expect(s.spreadRad).toBeLessThan(base.spreadRad);
		expect(s.spreadRad).toBeGreaterThanOrEqual(base.spreadRad * 0.3 - 1e-9);
	});

	it("clamps out-of-range tiers", () => {
		expect(effectiveWeaponSpec(WEAPONS.pistol, -2)).toBe(WEAPONS.pistol);
		const overMax = effectiveWeaponSpec(WEAPONS.pistol, 99);
		const atMax = effectiveWeaponSpec(WEAPONS.pistol, MAX_WEAPON_TIER);
		expect(overMax).toEqual(atMax);
	});
});
