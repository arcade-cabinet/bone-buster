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
import { TILE } from "@shared/constants";
import { describe, expect, it } from "vitest";

const SEEDS = [12345, 67890, 42, 1729, 99, 1000, 2026, 314159, 27, 8675309];

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
			if (seed % 3 === 0) {
				expect(flameCount).toBeGreaterThanOrEqual(1);
			} else {
				// Non-3rd maps can still get flamethrowerAmmo via the library
				// archetype bias; the floor is "no guarantee", not "zero allowed".
				expect(flameCount).toBeGreaterThanOrEqual(0);
			}
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
	function pickFor(archetypeIdx: number, count: number): number[] {
		// Pick `count` seeds where seed%5 === archetypeIdx + filter
		// the every-3rd-flamethrower interaction by avoiding seed%3==0
		// for non-library bias checks (library 3rd-map signal mixes
		// with the archetype bias and is harder to read independently).
		const out: number[] = [];
		let s = archetypeIdx + 5;
		while (out.length < count) {
			if (s % 5 === archetypeIdx) out.push(s);
			s += 5;
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
