/**
 * PD1 — pistol skin pool + per-skin profile contract.
 *
 * Mirrors the COV9/PB4 melee tests. The structural invariants are
 * what CI pins; the actual damage/cooldown numbers live in the
 * `pistolSkins.ts` doc-comment.
 */

import {
	DEFAULT_PISTOL_PROFILE,
	PISTOL_PROFILES,
	PISTOL_SKIN_URLS,
	pickPistolProfile,
	pickPistolSkin,
	profileForPistolSkin,
} from "@world/pistolSkins";
import { describe, expect, it } from "vitest";

describe("PD1 — pistol skin roster", () => {
	it("ships ≥4 skins (PRD: usp/handcannon/revolver/allegiance)", () => {
		expect(PISTOL_SKIN_URLS.length).toBeGreaterThanOrEqual(4);
	});

	it("index 0 is the canonical USP-S baseline (seed=0 byte-stability)", () => {
		expect(PISTOL_SKIN_URLS[0]).toMatch(/pistol_usp\.glb$/);
	});

	it("every URL resolves to /assets/models/weapons/pistol-skins/pistol_*.glb", () => {
		for (const url of PISTOL_SKIN_URLS) {
			expect(url).toMatch(/\/assets\/models\/weapons\/pistol-skins\/pistol_[a-z]+\.glb$/);
		}
	});

	it("URLs are unique across the roster", () => {
		expect(new Set(PISTOL_SKIN_URLS).size).toBe(PISTOL_SKIN_URLS.length);
	});
});

describe("PD1 — pickPistolSkin", () => {
	it("is deterministic — same seed → same URL", () => {
		expect(pickPistolSkin(42)).toBe(pickPistolSkin(42));
	});

	it("pickPistolSkin(0) returns the canonical USP baseline", () => {
		// Canonical-screenshot invariant: seed=0 ALWAYS resolves to the
		// identity skin so the existing canonical screenshots stay
		// byte-stable across reference-asset overhauls.
		expect(pickPistolSkin(0)).toBe(PISTOL_SKIN_URLS[0]);
	});

	it("returns a URL from PISTOL_SKIN_URLS for any seed", () => {
		for (let s = 0; s < 50; s += 1) {
			expect(PISTOL_SKIN_URLS).toContain(pickPistolSkin(s));
		}
	});

	it("all skins reachable across a sufficient seed range", () => {
		// Under D19's cosmetic stream (alea-backed), seed→pool isn't a clean
		// modulo bijection — adjacent seeds may collide. Widen the range to
		// 200 seeds; every entry MUST be reachable somewhere in that span or
		// the cosmetic distribution is broken.
		const seen = new Set<string>();
		for (let s = 0; s < 200; s += 1) {
			seen.add(pickPistolSkin(s));
		}
		expect(seen.size).toBe(PISTOL_SKIN_URLS.length);
	});

	it("handles negative seeds via unsigned-right-shift", () => {
		expect(PISTOL_SKIN_URLS).toContain(pickPistolSkin(-1));
	});
});

describe("PD1 — PISTOL_PROFILES roster contract", () => {
	it("every PISTOL_SKIN_URLS entry has a profile", () => {
		for (const url of PISTOL_SKIN_URLS) {
			expect(PISTOL_PROFILES[url]).toBeDefined();
		}
	});

	it("the registry has no orphan entries", () => {
		const urlSet = new Set(PISTOL_SKIN_URLS);
		for (const key of Object.keys(PISTOL_PROFILES)) {
			expect(urlSet.has(key)).toBe(true);
		}
	});

	it("the canonical USP (index 0) maps to the identity profile", () => {
		// Identity invariant: any deviation would shift per-shot damage
		// on seed=0 and break the canonical screenshot battery.
		expect(PISTOL_PROFILES[PISTOL_SKIN_URLS[0]]).toEqual(DEFAULT_PISTOL_PROFILE);
	});

	it("damageMul is finite and positive for every profile", () => {
		for (const p of Object.values(PISTOL_PROFILES)) {
			expect(Number.isFinite(p.damageMul)).toBe(true);
			expect(p.damageMul).toBeGreaterThan(0);
		}
	});

	it("cooldownMul is finite and positive for every profile", () => {
		for (const p of Object.values(PISTOL_PROFILES)) {
			expect(Number.isFinite(p.cooldownMul)).toBe(true);
			expect(p.cooldownMul).toBeGreaterThan(0);
		}
	});

	it("includes the directive-named distinct profiles", () => {
		// PD1 calls out handcannon (heavy-slow) and allegiance (SMG-style
		// fast-weak) as the two distinct profiles bracketing the identity
		// baseline. Re-balance that flattens these to identity has to
		// update this test.
		const handcannon = PISTOL_PROFILES[PISTOL_SKIN_URLS[1]];
		const allegiance = PISTOL_PROFILES[PISTOL_SKIN_URLS[3]];
		// Handcannon = heavy-slow.
		expect(handcannon.damageMul).toBeGreaterThan(1);
		expect(handcannon.cooldownMul).toBeGreaterThan(1);
		// Allegiance = fast-weak (SMG-style).
		expect(allegiance.damageMul).toBeLessThan(1);
		expect(allegiance.cooldownMul).toBeLessThan(1);
	});
});

describe("PD1 — profileForPistolSkin + pickPistolProfile", () => {
	it("profileForPistolSkin returns the matching registry entry", () => {
		for (const url of PISTOL_SKIN_URLS) {
			expect(profileForPistolSkin(url)).toBe(PISTOL_PROFILES[url]);
		}
	});

	it("profileForPistolSkin falls back to the identity profile for unknown URLs", () => {
		expect(profileForPistolSkin("/nonexistent.glb")).toEqual(DEFAULT_PISTOL_PROFILE);
	});

	it("pickPistolProfile is deterministic per seed", () => {
		expect(pickPistolProfile(42)).toEqual(pickPistolProfile(42));
	});

	it("pickPistolProfile(seed) === profileForPistolSkin(pickPistolSkin(seed))", () => {
		// Lockstep contract: viewmodel + damage MUST resolve to the same
		// profile on the same seed; otherwise a player sees one skin but
		// gets the damage numbers of another.
		for (let s = 0; s < 30; s += 1) {
			expect(pickPistolProfile(s)).toBe(profileForPistolSkin(pickPistolSkin(s)));
		}
	});
});
