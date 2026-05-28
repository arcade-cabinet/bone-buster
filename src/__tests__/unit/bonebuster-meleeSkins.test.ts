/**
 * COV9 step-1 — melee skin roster contract.
 */

import {
	MELEE_PROFILES,
	MELEE_SKIN_URLS,
	pickMeleeSkin,
	profileForMeleeSkin,
} from "@world/meleeSkins";
import { describe, expect, it } from "vitest";

describe("COV9 — melee skin roster", () => {
	it("ships ≥4 skins (PRD: machete/katana/cleaver/bat baseline)", () => {
		expect(MELEE_SKIN_URLS.length).toBeGreaterThanOrEqual(4);
	});

	it("index 0 is the E1 machete default (back-compat)", () => {
		expect(MELEE_SKIN_URLS[0]).toMatch(/melee_machete\.glb$/);
	});

	it("every URL resolves to /assets/models/weapons/slasher/melee_*.glb", () => {
		for (const url of MELEE_SKIN_URLS) {
			expect(url).toMatch(/\/assets\/models\/weapons\/slasher\/melee_[a-z][a-z0-9_]*\.glb$/);
		}
	});

	it("URLs are unique across the roster", () => {
		expect(new Set(MELEE_SKIN_URLS).size).toBe(MELEE_SKIN_URLS.length);
	});
});

describe("COV9 — pickMeleeSkin", () => {
	it("is deterministic — same seed → same URL", () => {
		expect(pickMeleeSkin(42)).toBe(pickMeleeSkin(42));
	});

	it("pickMeleeSkin(0) returns the E1 machete default", () => {
		expect(pickMeleeSkin(0)).toBe(MELEE_SKIN_URLS[0]);
	});

	it("returns a URL from MELEE_SKIN_URLS for any seed", () => {
		for (let s = 0; s < 50; s += 1) {
			expect(MELEE_SKIN_URLS).toContain(pickMeleeSkin(s));
		}
	});

	it("all skins reachable across a sufficient seed range", () => {
		// D19 cosmetic stream — see pistolSkins test for the same rationale.
		const seen = new Set<string>();
		for (let s = 0; s < 500; s += 1) {
			seen.add(pickMeleeSkin(s));
		}
		expect(seen.size).toBe(MELEE_SKIN_URLS.length);
	});

	it("handles negative seeds via unsigned-right-shift", () => {
		expect(MELEE_SKIN_URLS).toContain(pickMeleeSkin(-1));
	});
});

describe("SLA1 — meathook knockback profile", () => {
	it("meathook (index 4) is the only skin with negative knockbackMul", () => {
		const meathookUrl = MELEE_SKIN_URLS[4];
		if (!meathookUrl) throw new RangeError("MELEE_SKIN_URLS[4] missing");
		expect(meathookUrl).toMatch(/melee_meathook\.glb$/);
		const meathookProfile = MELEE_PROFILES[meathookUrl];
		if (!meathookProfile) throw new Error("MELEE_PROFILES missing entry for meathookUrl");
		expect(meathookProfile.knockbackMul).toBe(-1);
		for (const [url, profile] of Object.entries(MELEE_PROFILES)) {
			if (url === meathookUrl) continue;
			expect(profile.knockbackMul).toBeGreaterThanOrEqual(0);
		}
	});

	it("default profile knockbackMul is identity (1)", () => {
		expect(profileForMeleeSkin("unknown://nope.glb").knockbackMul).toBe(1);
	});
});

describe("SLA2 — chainsaw loud-attract profile", () => {
	it("chainsaw (index 2) has attractRadiusTiles > 0", () => {
		const chainsawUrl = MELEE_SKIN_URLS[2];
		if (!chainsawUrl) throw new RangeError("MELEE_SKIN_URLS[2] missing");
		expect(chainsawUrl).toMatch(/melee_chainsaw\.glb$/);
		const chainsawProfile = MELEE_PROFILES[chainsawUrl];
		if (!chainsawProfile) throw new Error("MELEE_PROFILES missing entry for chainsawUrl");
		expect(chainsawProfile.attractRadiusTiles).toBeGreaterThan(0);
	});

	it("every non-chainsaw skin is silent (undefined or 0)", () => {
		const chainsawUrl = MELEE_SKIN_URLS[2];
		if (!chainsawUrl) throw new RangeError("MELEE_SKIN_URLS[2] missing");
		for (const [url, profile] of Object.entries(MELEE_PROFILES)) {
			if (url === chainsawUrl) continue;
			expect(profile.attractRadiusTiles ?? 0).toBe(0);
		}
	});
});
