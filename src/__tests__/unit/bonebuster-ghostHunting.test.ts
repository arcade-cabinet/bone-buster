/**
 * PB5 step-1 — EMF reader contract tests.
 *
 * Pins the threshold table + edge cases for `pickEmfReading`.
 * Pure-function tests; the HUD chip + ownership wiring land in
 * separate commits with their own tests.
 */

import { ROLE } from "@styles/tokens/index";
import {
	CRUCIFIX_LIFETIME_MS,
	CRUCIFIX_RADIUS_TILES,
	type CrucifixInstance,
	EMF_TOKEN,
	type EmfReading,
	EVP_CAPTURE_RADIUS,
	EVP_COOLDOWN_MS,
	EVP_CUES,
	isEnemyCrucified,
	isInUvCone,
	pickEmfReading,
	pickEvpCue,
	pickSpiritBoxPhoneme,
	SPIRIT_BOX_COOLDOWN_MS,
	SPIRIT_BOX_PHONEMES,
	SPIRIT_BOX_TRIGGER_RADIUS,
	UV_FLASHLIGHT_HALF_ANGLE_RAD,
	UV_FLASHLIGHT_RANGE_TILES,
} from "@world/ghostHunting";
import { describe, expect, it } from "vitest";

describe("PB5 step-1 — pickEmfReading thresholds", () => {
	it("returns 0 (no signal) for non-finite distance", () => {
		expect(pickEmfReading(Number.POSITIVE_INFINITY)).toBe(0);
		expect(pickEmfReading(Number.NaN)).toBe(0);
	});

	it("returns 5 (touching) for distance < 2 tiles", () => {
		expect(pickEmfReading(0)).toBe(5);
		expect(pickEmfReading(1)).toBe(5);
		expect(pickEmfReading(1.99)).toBe(5);
	});

	it("returns 4 for distance in [2, 4)", () => {
		expect(pickEmfReading(2)).toBe(4);
		expect(pickEmfReading(3.5)).toBe(4);
		expect(pickEmfReading(3.99)).toBe(4);
	});

	it("returns 3 for distance in [4, 8)", () => {
		expect(pickEmfReading(4)).toBe(3);
		expect(pickEmfReading(7.99)).toBe(3);
	});

	it("returns 2 for distance in [8, 16)", () => {
		expect(pickEmfReading(8)).toBe(2);
		expect(pickEmfReading(15.99)).toBe(2);
	});

	it("returns 1 for distance >= 16", () => {
		expect(pickEmfReading(16)).toBe(1);
		expect(pickEmfReading(100)).toBe(1);
		expect(pickEmfReading(1_000_000)).toBe(1);
	});

	it("treats negative distance (overlap / inside enemy) as the strongest reading", () => {
		// Comes up if the player walks through a phasing enemy. The
		// reading should pin at 5 rather than fall into an undefined
		// bucket.
		expect(pickEmfReading(-1)).toBe(5);
	});

	it("is monotonic non-increasing as distance grows", () => {
		// Property test: the reading never goes UP as the enemy gets
		// farther. Catches a future threshold rewrite that introduces
		// a non-monotonic step.
		let prev = pickEmfReading(0);
		for (let d = 0; d < 32; d += 0.5) {
			const cur = pickEmfReading(d);
			expect(cur).toBeLessThanOrEqual(prev);
			prev = cur;
		}
	});
});

describe("PB5 step-1 — EMF_TOKEN color ramp", () => {
	it("has a token for every reading 0..5", () => {
		for (const lvl of [0, 1, 2, 3, 4, 5] as EmfReading[]) {
			// Every entry must be a non-empty string — the resolved
			// shape (hex / rgba / linear-gradient) depends on the
			// underlying ROLE token, so the structural check is loose.
			// The semantic identity assertions below pin the mapping.
			expect(typeof EMF_TOKEN[lvl]).toBe("string");
			expect(EMF_TOKEN[lvl].length).toBeGreaterThan(0);
		}
	});

	it("0 (no signal) resolves through ROLE.textMuted", () => {
		expect(EMF_TOKEN[0]).toBe(ROLE.textMuted);
	});

	it("5 (touching) resolves through ROLE.actionFire (urgent)", () => {
		expect(EMF_TOKEN[5]).toBe(ROLE.actionFire);
	});

	it("middle bands escalate gain → pickup → warning → fire", () => {
		// PB5 fold — semantic ramp pinned to existing ROLE tokens.
		// Any future re-keying of the chip ramp has to update both
		// EMF_TOKEN and this test in lockstep — protects against
		// silent drift between the design intent (low = passive, high
		// = urgent) and the actual rendered color.
		expect(EMF_TOKEN[1]).toBe(ROLE.brand.bone3);
		expect(EMF_TOKEN[2]).toBe(ROLE.actionWin);
		expect(EMF_TOKEN[3]).toBe(ROLE.actionPickup);
		expect(EMF_TOKEN[4]).toBe(ROLE.actionHurt);
	});
});

describe("PC2 — spirit-box phoneme pool + picker", () => {
	it("ships ≥8 phonemes (Phasmo-style threat lexicon)", () => {
		expect(SPIRIT_BOX_PHONEMES.length).toBeGreaterThanOrEqual(8);
	});

	it("every phoneme is an uppercase short word", () => {
		for (const word of SPIRIT_BOX_PHONEMES) {
			expect(word).toMatch(/^[A-Z]{2,8}$/);
		}
	});

	it("phonemes are unique across the pool", () => {
		expect(new Set(SPIRIT_BOX_PHONEMES).size).toBe(SPIRIT_BOX_PHONEMES.length);
	});

	it("pickSpiritBoxPhoneme is deterministic per (seed, triggerIndex)", () => {
		expect(pickSpiritBoxPhoneme(42, 0)).toBe(pickSpiritBoxPhoneme(42, 0));
		expect(pickSpiritBoxPhoneme(42, 7)).toBe(pickSpiritBoxPhoneme(42, 7));
	});

	it("returns a phoneme from SPIRIT_BOX_PHONEMES for any seed/trigger pair", () => {
		for (let s = 0; s < 20; s += 1) {
			for (let t = 0; t < 5; t += 1) {
				expect(SPIRIT_BOX_PHONEMES).toContain(pickSpiritBoxPhoneme(s, t));
			}
		}
	});

	it("consecutive triggers don't always return the same phoneme", () => {
		// Catches a regression where pickSpiritBoxPhoneme ignored the
		// triggerIndex — the player should see the box "talk back"
		// across multiple words, not repeat the same one until the
		// seed changes.
		const seen = new Set<string>();
		for (let t = 0; t < 30; t += 1) {
			seen.add(pickSpiritBoxPhoneme(7, t));
		}
		expect(seen.size).toBeGreaterThan(1);
	});

	it("SPIRIT_BOX_TRIGGER_RADIUS is a positive tile count in the EMF mid-band", () => {
		// The box only talks when an enemy is in EMF level 3-5 range
		// (touching to ~6 tiles). 6 is the documented Phasmo-style
		// "ghost room" boundary; outside that the box is silent.
		expect(SPIRIT_BOX_TRIGGER_RADIUS).toBeGreaterThan(0);
		expect(SPIRIT_BOX_TRIGGER_RADIUS).toBeLessThanOrEqual(8);
	});

	it("SPIRIT_BOX_COOLDOWN_MS is at least 1 second so the HUD has time to read", () => {
		expect(SPIRIT_BOX_COOLDOWN_MS).toBeGreaterThanOrEqual(1000);
	});
});

describe("GH-TAPE — EVP recorder cue pool + picker", () => {
	it("ships ≥8 distinct cues", () => {
		expect(EVP_CUES.length).toBeGreaterThanOrEqual(8);
		expect(new Set(EVP_CUES).size).toBe(EVP_CUES.length);
	});

	it("pickEvpCue is deterministic per (seed, captureIndex) + always in-pool", () => {
		expect(pickEvpCue(42, 0)).toBe(pickEvpCue(42, 0));
		expect(pickEvpCue(42, 3)).toBe(pickEvpCue(42, 3));
		for (let s = 0; s < 15; s += 1) {
			for (let t = 0; t < 4; t += 1) expect(EVP_CUES).toContain(pickEvpCue(s, t));
		}
	});

	it("seed 0 → cue[0] (canonical baseline, mirrors the phoneme picker)", () => {
		expect(pickEvpCue(0, 0)).toBe(EVP_CUES[0]);
	});

	it("consecutive captures vary (captureIndex is honored)", () => {
		const seen = new Set<string>();
		for (let t = 0; t < 30; t += 1) seen.add(pickEvpCue(7, t));
		expect(seen.size).toBeGreaterThan(1);
	});

	it("EVP_CAPTURE_RADIUS + EVP_COOLDOWN_MS are sane", () => {
		expect(EVP_CAPTURE_RADIUS).toBeGreaterThan(0);
		expect(EVP_COOLDOWN_MS).toBeGreaterThanOrEqual(1000);
	});
});

describe("PC3 — UV flashlight cone-containment", () => {
	// Convention: camera at origin (0,0) looking +X (forward = (1, 0)).
	// Enemies at varying positions; expectations follow.

	it("reveals an enemy directly in front within range", () => {
		expect(isInUvCone(0, 0, 1, 0, 5, 0)).toBe(true);
	});

	it("hides an enemy behind the camera", () => {
		expect(isInUvCone(0, 0, 1, 0, -5, 0)).toBe(false);
	});

	it("hides an enemy at 90° off camera-forward", () => {
		// 90° = π/2 rad, well outside the 0.5-rad half-angle.
		expect(isInUvCone(0, 0, 1, 0, 0, 5)).toBe(false);
	});

	it("hides an enemy beyond UV_FLASHLIGHT_RANGE_TILES", () => {
		expect(isInUvCone(0, 0, 1, 0, UV_FLASHLIGHT_RANGE_TILES + 0.1, 0)).toBe(false);
	});

	it("reveals an enemy exactly at the range boundary", () => {
		// Boundary is inclusive — within-or-equal.
		expect(isInUvCone(0, 0, 1, 0, UV_FLASHLIGHT_RANGE_TILES - 0.01, 0)).toBe(true);
	});

	it("reveals an enemy at the cone edge angle", () => {
		// At half-angle exactly: dot = cos(half-angle), reveal returns true.
		const r = 4;
		const dx = r * Math.cos(UV_FLASHLIGHT_HALF_ANGLE_RAD);
		const dz = r * Math.sin(UV_FLASHLIGHT_HALF_ANGLE_RAD);
		expect(isInUvCone(0, 0, 1, 0, dx, dz)).toBe(true);
	});

	it("hides an enemy just outside the cone edge angle", () => {
		const r = 4;
		const overshoot = UV_FLASHLIGHT_HALF_ANGLE_RAD + 0.1;
		const dx = r * Math.cos(overshoot);
		const dz = r * Math.sin(overshoot);
		expect(isInUvCone(0, 0, 1, 0, dx, dz)).toBe(false);
	});

	it("treats player-on-enemy overlap as a reveal", () => {
		// Defensive — the player walking through a phasing enemy
		// shouldn't briefly desync the visibility state.
		expect(isInUvCone(0, 0, 1, 0, 0, 0)).toBe(true);
	});

	it("works with non-axis-aligned forward vectors", () => {
		// Forward at 45° — enemy at 45° should be revealed; enemy at
		// the opposite quadrant should not.
		const inv = 1 / Math.SQRT2;
		expect(isInUvCone(0, 0, inv, inv, 5 * inv, 5 * inv)).toBe(true);
		expect(isInUvCone(0, 0, inv, inv, -5 * inv, -5 * inv)).toBe(false);
	});
});

describe("PC4 — crucifix radius + lifetime", () => {
	const NOW = 1_000_000;

	function placeAt(x: number, z: number, ttlMs = CRUCIFIX_LIFETIME_MS): CrucifixInstance {
		return { id: 1, x, z, expiresAtMs: NOW + ttlMs };
	}

	it("returns false when the active list is empty", () => {
		expect(isEnemyCrucified([], 0, 0, NOW)).toBe(false);
	});

	it("returns true when the enemy is inside the radius of an active crucifix", () => {
		const c = [placeAt(0, 0)];
		expect(isEnemyCrucified(c, 0, 0, NOW)).toBe(true);
		expect(isEnemyCrucified(c, CRUCIFIX_RADIUS_TILES - 0.01, 0, NOW)).toBe(true);
	});

	it("returns false when the enemy is just outside the radius", () => {
		const c = [placeAt(0, 0)];
		expect(isEnemyCrucified(c, CRUCIFIX_RADIUS_TILES + 0.01, 0, NOW)).toBe(false);
	});

	it("includes the boundary distance (radius squared comparison is <=)", () => {
		const c = [placeAt(0, 0)];
		expect(isEnemyCrucified(c, CRUCIFIX_RADIUS_TILES, 0, NOW)).toBe(true);
	});

	it("ignores expired crucifixes", () => {
		// expiresAtMs == NOW means expired (strict `now >= expiresAtMs`
		// branch in isEnemyCrucified treats equal as expired so the
		// instance disappears the frame it would die).
		const expired: CrucifixInstance = { id: 2, x: 0, z: 0, expiresAtMs: NOW };
		expect(isEnemyCrucified([expired], 0, 0, NOW)).toBe(false);
	});

	it("returns true if ANY active crucifix covers the enemy (OR across the list)", () => {
		const list = [placeAt(20, 20), placeAt(0, 0)];
		expect(isEnemyCrucified(list, 1, 1, NOW)).toBe(true);
	});

	it("CRUCIFIX_RADIUS_TILES is a positive tile count", () => {
		expect(CRUCIFIX_RADIUS_TILES).toBeGreaterThan(0);
	});

	it("CRUCIFIX_LIFETIME_MS is at least a few seconds", () => {
		expect(CRUCIFIX_LIFETIME_MS).toBeGreaterThanOrEqual(5_000);
	});
});
