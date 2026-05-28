/**
 * PD3 — chaingun skin pool + per-skin profile contract.
 *
 * Mirrors COV9/PB4/PD1 tests. Structural invariants only — the
 * tuning numbers live in `chaingunSkins.ts` doc-comment.
 */

import {
	CHAINGUN_PROFILES,
	CHAINGUN_SKIN_URLS,
	DEFAULT_CHAINGUN_PROFILE,
	pickChaingunProfile,
	pickChaingunSkin,
	profileForChaingunSkin,
} from "@world/chaingunSkins";
import { describe, expect, it } from "vitest";

describe("PD3 — chaingun skin roster", () => {
	it("ships ≥3 skins (canonical + 2 variants)", () => {
		expect(CHAINGUN_SKIN_URLS.length).toBeGreaterThanOrEqual(3);
	});

	it("index 0 is the canonical chaingun.glb baseline (seed=0 byte-stability)", () => {
		expect(CHAINGUN_SKIN_URLS[0]).toMatch(/\/assets\/models\/weapons\/chaingun\.glb$/);
	});

	it("variant URLs live under /assets/models/weapons/chaingun-skins/", () => {
		for (let i = 1; i < CHAINGUN_SKIN_URLS.length; i += 1) {
			expect(CHAINGUN_SKIN_URLS[i]).toMatch(
				/\/assets\/models\/weapons\/chaingun-skins\/chaingun_[a-z][a-z0-9_]*\.glb$/,
			);
		}
	});

	it("URLs are unique", () => {
		expect(new Set(CHAINGUN_SKIN_URLS).size).toBe(CHAINGUN_SKIN_URLS.length);
	});
});

describe("PD3 — pickChaingunSkin", () => {
	it("is deterministic per seed", () => {
		expect(pickChaingunSkin(42)).toBe(pickChaingunSkin(42));
	});

	it("pickChaingunSkin(0) returns the canonical baseline", () => {
		// Canonical-screenshot invariant: seed=0 ALWAYS resolves to the
		// chaingun.glb baseline so existing screenshots stay byte-stable.
		expect(pickChaingunSkin(0)).toBe(CHAINGUN_SKIN_URLS[0]);
	});

	it("returns a URL from CHAINGUN_SKIN_URLS for any seed", () => {
		for (let s = 0; s < 50; s += 1) {
			expect(CHAINGUN_SKIN_URLS).toContain(pickChaingunSkin(s));
		}
	});

	it("all skins reachable across a sufficient seed range", () => {
		// D19 cosmetic stream — see pistolSkins test for the same rationale.
		const seen = new Set<string>();
		for (let s = 0; s < 200; s += 1) {
			seen.add(pickChaingunSkin(s));
		}
		expect(seen.size).toBe(CHAINGUN_SKIN_URLS.length);
	});

	it("handles negative seeds via unsigned-right-shift", () => {
		expect(CHAINGUN_SKIN_URLS).toContain(pickChaingunSkin(-1));
	});
});

describe("PD3 — CHAINGUN_PROFILES roster contract", () => {
	it("every CHAINGUN_SKIN_URLS entry has a profile", () => {
		for (const url of CHAINGUN_SKIN_URLS) {
			expect(CHAINGUN_PROFILES[url]).toBeDefined();
		}
	});

	it("the registry has no orphan entries", () => {
		const urlSet = new Set(CHAINGUN_SKIN_URLS);
		for (const key of Object.keys(CHAINGUN_PROFILES)) {
			expect(urlSet.has(key)).toBe(true);
		}
	});

	it("the canonical chaingun (index 0) maps to the identity profile", () => {
		const url0 = CHAINGUN_SKIN_URLS[0];
		if (!url0) throw new RangeError("CHAINGUN_SKIN_URLS[0] missing");
		expect(CHAINGUN_PROFILES[url0]).toEqual(DEFAULT_CHAINGUN_PROFILE);
	});

	it("damageMul + cooldownMul are finite and positive for every profile", () => {
		for (const p of Object.values(CHAINGUN_PROFILES)) {
			expect(Number.isFinite(p.damageMul)).toBe(true);
			expect(p.damageMul).toBeGreaterThan(0);
			expect(Number.isFinite(p.cooldownMul)).toBe(true);
			expect(p.cooldownMul).toBeGreaterThan(0);
		}
	});
});

describe("PD3 — profileForChaingunSkin + pickChaingunProfile", () => {
	it("profileForChaingunSkin returns the matching registry entry", () => {
		for (const url of CHAINGUN_SKIN_URLS) {
			expect(profileForChaingunSkin(url)).toBe(CHAINGUN_PROFILES[url]);
		}
	});

	it("falls back to identity for unknown URLs", () => {
		expect(profileForChaingunSkin("/nonexistent.glb")).toEqual(DEFAULT_CHAINGUN_PROFILE);
	});

	it("pickChaingunProfile is deterministic per seed", () => {
		expect(pickChaingunProfile(42)).toEqual(pickChaingunProfile(42));
	});

	it("pickChaingunProfile(seed) === profileForChaingunSkin(pickChaingunSkin(seed))", () => {
		for (let s = 0; s < 30; s += 1) {
			expect(pickChaingunProfile(s)).toBe(profileForChaingunSkin(pickChaingunSkin(s)));
		}
	});
});
