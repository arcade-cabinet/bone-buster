/**
 * PB4 step-1 — per-skin melee damage-profile contract.
 *
 * Pins the per-skin profile table against the URL roster so a future
 * skin addition either gets a profile or fails CI loudly. The damage
 * + cooldown numbers themselves are gameplay-design and live in the
 * `meleeSkins.ts` doc-comment; this file only enforces structural
 * invariants (every URL has a profile, identity profile holds for
 * the canonical machete, multipliers are finite + positive where
 * the schema requires it).
 *
 * Step-2 (fireResolution wire-in) will add gameplay tests covering
 * the actual damage math; that's intentionally out of scope here
 * because the wire-in lives on a separate commit.
 */

import {
	DEFAULT_MELEE_PROFILE,
	MELEE_PROFILES,
	MELEE_SKIN_URLS,
	pickMeleeProfile,
	pickMeleeSkin,
	profileForMeleeSkin,
} from "@world/meleeSkins";
import { describe, expect, it } from "vitest";

describe("PB4 — MELEE_PROFILES roster contract", () => {
	it("every MELEE_SKIN_URLS entry has a profile", () => {
		for (const url of MELEE_SKIN_URLS) {
			expect(MELEE_PROFILES[url]).toBeDefined();
		}
	});

	it("the registry has no orphan entries", () => {
		// Catches the inverse of the above — a profile keyed off a
		// URL that no longer appears in MELEE_SKIN_URLS, which would
		// silently land at no call-site.
		const urlSet = new Set(MELEE_SKIN_URLS);
		for (const key of Object.keys(MELEE_PROFILES)) {
			expect(urlSet.has(key)).toBe(true);
		}
	});

	it("the canonical machete (index 0) maps to the identity profile", () => {
		// Canonical-screenshot back-compat: any deviation from identity
		// on the E1 default would shift the per-shot damage and break
		// the existing balance assumptions.
		expect(MELEE_PROFILES[MELEE_SKIN_URLS[0]]).toEqual(DEFAULT_MELEE_PROFILE);
	});

	it("damageMul is finite and positive for every profile", () => {
		for (const p of Object.values(MELEE_PROFILES)) {
			expect(Number.isFinite(p.damageMul)).toBe(true);
			expect(p.damageMul).toBeGreaterThan(0);
		}
	});

	it("cooldownMul is finite and positive for every profile", () => {
		// Cooldown multiplier of 0 would mean infinite fire rate; the
		// schema requires a real positive multiplier so the resulting
		// `cooldownMs = base × mul` is also strictly positive.
		for (const p of Object.values(MELEE_PROFILES)) {
			expect(Number.isFinite(p.cooldownMul)).toBe(true);
			expect(p.cooldownMul).toBeGreaterThan(0);
		}
	});

	it("knockbackMul is finite (negative is allowed for pull-style)", () => {
		// Meathook uses -1 to pull rather than push. Only the magnitude
		// + sign matter; the schema allows the full signed real line.
		for (const p of Object.values(MELEE_PROFILES)) {
			expect(Number.isFinite(p.knockbackMul)).toBe(true);
		}
	});

	it("includes the three directive-named distinct profiles", () => {
		// Directive PB4 calls out chainsaw / meathook / axe as the
		// distinct damage-profile triple. This test makes the table
		// changes visible: any future re-balance that flattens these
		// to identity would have to update this expectation.
		const axe = MELEE_PROFILES[MELEE_SKIN_URLS[1]];
		const chainsaw = MELEE_PROFILES[MELEE_SKIN_URLS[2]];
		const meathook = MELEE_PROFILES[MELEE_SKIN_URLS[4]];
		// Axe = heavy-slow.
		expect(axe.damageMul).toBeGreaterThan(1);
		expect(axe.cooldownMul).toBeGreaterThan(1);
		// Chainsaw = fast-loud (faster cooldown).
		expect(chainsaw.cooldownMul).toBeLessThan(1);
		// Meathook = pull-style (negative knockback).
		expect(meathook.knockbackMul).toBeLessThan(0);
	});
});

describe("PB4 — profileForMeleeSkin + pickMeleeProfile", () => {
	it("profileForMeleeSkin returns the matching registry entry", () => {
		for (const url of MELEE_SKIN_URLS) {
			expect(profileForMeleeSkin(url)).toBe(MELEE_PROFILES[url]);
		}
	});

	it("profileForMeleeSkin falls back to the identity profile for unknown URLs", () => {
		// Defensive fallback — keeps the runtime predictable if a
		// future asset addition lands without a profile (the contract
		// test above catches that in CI; the runtime stays safe).
		expect(profileForMeleeSkin("/nonexistent.glb")).toEqual(DEFAULT_MELEE_PROFILE);
	});

	it("pickMeleeProfile is deterministic per seed", () => {
		expect(pickMeleeProfile(42)).toEqual(pickMeleeProfile(42));
	});

	it("pickMeleeProfile(seed) === profileForMeleeSkin(pickMeleeSkin(seed))", () => {
		// Lockstep contract: the two pickers MUST agree, because the
		// runtime resolves both from the same level.seed every map.
		// A divergence (different RNG / different modulo) would produce
		// a screenshot of one weapon doing damage as if it were another.
		for (let s = 0; s < 30; s += 1) {
			expect(pickMeleeProfile(s)).toBe(profileForMeleeSkin(pickMeleeSkin(s)));
		}
	});
});
