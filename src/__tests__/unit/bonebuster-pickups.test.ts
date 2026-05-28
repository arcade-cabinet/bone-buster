/**
 * D2 — Procedural maps spawn weapon-ammo pickups.
 *
 * Replaces the L2/L5 contract (which forbade chaingunAmmo on
 * procedural maps). PRD §D2: every generated map spawns at
 * least one chaingunAmmo + one shotgunAmmo; every 3rd map
 * additionally spawns ≥1 flamethrowerAmmo (gated by
 * `map.seed % 3 === 0`). Per-archetype bias: arena gets
 * extra chaingunAmmo, courtyard gets extra shotgunAmmo,
 * library gets rare-but-elevated flamethrowerAmmo.
 *
 * Chaingun.pickupAmmo is currently 0 (L3 unlimited still
 * holds) — chaingunAmmo pickups exist as world objects and
 * spawn correctly but their on-collect handler is a no-op
 * for now. A future commit (D6 vulnerability tags or a
 * balance pass) may flip L3 and give chaingun finite ammo;
 * D2 is scoped to the spawn-side only.
 *
 * The L3-respecting interpretation means: the SPAWN
 * contract is the only thing this test pins. Handler
 * behavior is tested separately (see useGameRef tests).
 */

import { generateMap, spawnPickups } from "@engine/engine";
import { cyrb128 } from "@engine/rng";
import { TILE } from "@shared/constants";
import { describe, expect, it } from "vitest";

const SEEDS = [
	"pk-12345",
	"pk-67890",
	"pk-42",
	"pk-1729",
	"pk-99",
	"pk-1000",
	"pk-2026",
	"pk-314159",
	"pk-27",
	"pk-8675309",
];

describe("D2 — procedural pickup contract", () => {
	for (const seed of SEEDS) {
		it(`seed=${seed}: at least one chaingunAmmo pickup spawns`, () => {
			const map = generateMap(seed);
			const count = map.pickupSpawns.filter((p) => p.kind === "chaingunAmmo").length;
			expect(count).toBeGreaterThanOrEqual(1);
		});

		it(`seed=${seed}: at least one shotgunAmmo pickup spawns`, () => {
			const map = generateMap(seed);
			const count = map.pickupSpawns.filter((p) => p.kind === "shotgunAmmo").length;
			expect(count).toBeGreaterThanOrEqual(1);
		});

		it(`seed=${seed}: flamethrowerAmmo spawns every 3rd map (gated by seed%3)`, () => {
			const map = generateMap(seed);
			const flameCount = map.pickupSpawns.filter((p) => p.kind === "flamethrowerAmmo").length;
			if (cyrb128(seed)[1] % 3 === 0) {
				expect(flameCount).toBeGreaterThanOrEqual(1);
			}
			// Non-3rd maps: the gate is "no guarantee" so flameCount can
			// be 0 OR positive (library archetype bias adds it). No
			// meaningful assertion — flameCount is a Number ≥ 0 by
			// definition of .filter().length.
		});

		it(`seed=${seed}: at least one health pickup is always present (regression)`, () => {
			const map = generateMap(seed);
			const hasHealth = map.pickupSpawns.some((p) => p.kind === "health");
			expect(hasHealth).toBe(true);
		});

		it(`seed=${seed}: every pickup lands on a non-wall cell (regression)`, () => {
			const map = generateMap(seed);
			const pickups = spawnPickups(map);
			expect(pickups.length).toBeGreaterThan(0);
			for (const p of pickups) {
				const gx = Math.floor(p.position.x / TILE);
				const gy = Math.floor(p.position.y / TILE);
				const cell = map.cells[gy]?.[gx];
				expect(cell).not.toBe("wall");
			}
		});

		it(`seed=${seed}: pickups don't overlap the key or exit (regression)`, () => {
			const map = generateMap(seed);
			const pickups = spawnPickups(map);
			for (const p of pickups) {
				const dKey = Math.hypot(p.position.x - map.keyPosition.x, p.position.y - map.keyPosition.y);
				const dExit = Math.hypot(
					p.position.x - map.exitPosition.x,
					p.position.y - map.exitPosition.y,
				);
				expect(dKey).toBeGreaterThan(0.5);
				expect(dExit).toBeGreaterThan(0.5);
			}
		});
	}
});

describe("D2 — per-archetype pickup bias", () => {
	// Archetype determined by `seed % 5`:
	//   0 corridor, 1 arena, 2 courtyard, 3 sewer, 4 library
	// Bias contract: arena chaingunAmmo > baseline; courtyard
	// shotgunAmmo > baseline; library flamethrowerAmmo > baseline.
	// The simplest verifiable form is "archetype-X seeds
	// have at least N of the biased kind", with N=2 (the
	// guaranteed-min is 1, so bias must add at least 1 more).
	function pickFor(archetypeIdx: number, count: number): string[] {
		// SEED2 — pick `count` seed PHRASES that hash to the given archetype
		// (cyrb128(phrase)[0] % 5 === archetypeIdx), replacing the old numeric
		// `seed % 5` selection.
		const out: string[] = [];
		let n = 0;
		while (out.length < count && n < 100000) {
			const p = `bias-${archetypeIdx}-${n}`;
			if (cyrb128(p)[0] % 5 === archetypeIdx) out.push(p);
			n += 1;
		}
		return out;
	}

	it("arena seeds (idx=1) average ≥2 chaingunAmmo per map", () => {
		const seeds = pickFor(1, 10);
		const total = seeds.reduce(
			(acc, seed) =>
				acc + generateMap(seed).pickupSpawns.filter((p) => p.kind === "chaingunAmmo").length,
			0,
		);
		const avg = total / seeds.length;
		expect(avg).toBeGreaterThanOrEqual(2);
	});

	it("courtyard seeds (idx=2) average ≥2 shotgunAmmo per map", () => {
		const seeds = pickFor(2, 10);
		const total = seeds.reduce(
			(acc, seed) =>
				acc + generateMap(seed).pickupSpawns.filter((p) => p.kind === "shotgunAmmo").length,
			0,
		);
		const avg = total / seeds.length;
		expect(avg).toBeGreaterThanOrEqual(2);
	});

	it("library seeds (idx=4) average ≥1 flamethrowerAmmo per map (rare-bias floor)", () => {
		const seeds = pickFor(4, 10);
		const total = seeds.reduce(
			(acc, seed) =>
				acc + generateMap(seed).pickupSpawns.filter((p) => p.kind === "flamethrowerAmmo").length,
			0,
		);
		const avg = total / seeds.length;
		expect(avg).toBeGreaterThanOrEqual(1);
	});
});
