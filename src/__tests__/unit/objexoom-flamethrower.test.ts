/**
 * E8 step-1 — Flamethrower weapon-slot contract.
 *
 * Pins the slot definition + spec shape that the existing fire-
 * resolution pellet/spread/cooldown primitives turn into continuous-
 * fire cone-AoE behavior. Doesn't run the actual fire path (that's
 * exercised by the browser-mode + e2e suites).
 */

import { WEAPON_ORDER, WEAPONS, type WeaponId } from "@shared/weapons";
import { describe, expect, it } from "vitest";
import { WEAPON_MODELS } from "../../models";

describe("E8 — flamethrower weapon slot", () => {
	it("WeaponId includes flamethrower", () => {
		const id: WeaponId = "flamethrower";
		expect(id).toBe("flamethrower");
	});

	it("WEAPONS.flamethrower has the PRD-spec'd cone-AoE shape", () => {
		const spec = WEAPONS.flamethrower;
		expect(spec.id).toBe("flamethrower");
		// PRD §E8: damage every 100 ms.
		expect(spec.cooldownMs).toBe(100);
		// Cone needs multiple pellets + wide spread to read as cone AoE.
		expect(spec.pellets).toBeGreaterThan(1);
		expect(spec.spreadRad).toBeGreaterThan(0.2);
		// Fuel canister pickup — discrete ammo, not infinite.
		expect(spec.ammoCostPerShot).toBeGreaterThan(0);
		expect(spec.startingAmmo).toBe(0);
		expect(spec.pickupAmmo).toBeGreaterThan(0);
		// Short range — close-quarters weapon.
		expect(spec.rangeTiles).toBeLessThan(WEAPONS.shotgun.rangeTiles);
	});

	it("WEAPON_ORDER includes flamethrower at the end (5th slot)", () => {
		expect(WEAPON_ORDER).toContain("flamethrower");
		expect(WEAPON_ORDER[WEAPON_ORDER.length - 1]).toBe("flamethrower");
	});

	it("flamethrower hud hotkey is 5", () => {
		expect(WEAPONS.flamethrower.hudHotkey).toBe("5");
	});

	it("WEAPON_MODELS.flamethrower points at the shipped GLB", () => {
		expect(WEAPON_MODELS.flamethrower.url).toMatch(/\/assets\/models\/weapons\/flamethrower\.glb$/);
	});

	it("WEAPON_MODELS.flamethrower has a muzzleBboxFrac (PA-MOD7 contract)", () => {
		expect(WEAPON_MODELS.flamethrower.muzzleBboxFrac).toHaveLength(3);
	});
});
