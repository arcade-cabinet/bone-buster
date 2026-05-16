/**
 * D9 — weapon skin rotation reachability.
 *
 * PRD §D9: Uzi.zip as chaingun skin variant; Handcannon.glb as
 * pistol variant. Unit test pins full reachability — over a
 * sweep of 50 seeds, every URL in each pool is hit at least once.
 */

import { CHAINGUN_SKIN_URLS, PISTOL_SKIN_URLS, pickWeaponSkin } from "@world/weaponSkins";
import { describe, expect, it } from "vitest";

describe("D9 — pickWeaponSkin reachability", () => {
	it("pistol pool: every URL is reachable across 50 seeds", () => {
		const hit = new Set<string>();
		for (let seed = 0; seed < 50; seed += 1) {
			hit.add(pickWeaponSkin("pistol", seed));
		}
		for (const url of PISTOL_SKIN_URLS) {
			expect(hit.has(url)).toBe(true);
		}
	});

	it("chaingun pool: every URL is reachable across 50 seeds", () => {
		const hit = new Set<string>();
		for (let seed = 0; seed < 50; seed += 1) {
			hit.add(pickWeaponSkin("chaingun", seed));
		}
		for (const url of CHAINGUN_SKIN_URLS) {
			expect(hit.has(url)).toBe(true);
		}
	});

	it("pistol Handcannon variant is in the pool", () => {
		const hasHandcannon = PISTOL_SKIN_URLS.some((url) => url.includes("pistol_handcannon.glb"));
		expect(hasHandcannon).toBe(true);
	});

	it("pistol default (USP / pistol.glb) is index 0 — back-compat with E1 canon", () => {
		expect(PISTOL_SKIN_URLS[0]).toMatch(/\/pistol\.glb$/);
	});

	it("chaingun Uzi (chaingun.glb) is in the pool", () => {
		const hasUzi = CHAINGUN_SKIN_URLS.some((url) => url.includes("chaingun.glb"));
		expect(hasUzi).toBe(true);
	});

	it("deterministic — same (weapon, seed) returns the same URL", () => {
		expect(pickWeaponSkin("pistol", 12345)).toBe(pickWeaponSkin("pistol", 12345));
		expect(pickWeaponSkin("chaingun", 7)).toBe(pickWeaponSkin("chaingun", 7));
	});

	it("throws for weapons without a skin pool", () => {
		expect(() => pickWeaponSkin("melee", 0)).toThrow();
		expect(() => pickWeaponSkin("shotgun", 0)).toThrow();
		expect(() => pickWeaponSkin("flamethrower", 0)).toThrow();
	});
});
