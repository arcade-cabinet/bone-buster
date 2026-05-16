import { generateMap, spawnPickups } from "@engine/engine";
import { TILE } from "@shared/constants";
import { describe, expect, it } from "vitest";

describe("objexoom pickup placement (D6)", () => {
	for (const seed of [12345, 67890, 42, 1729]) {
		it(`seed=${seed}: every pickup lands on a non-wall cell`, () => {
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

		it(`seed=${seed}: pickups don't overlap the key or exit`, () => {
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

		it(`seed=${seed}: pickup mix has at least one of each kind`, () => {
			const map = generateMap(seed);
			const kinds = new Set(map.pickupSpawns.map((p) => p.kind));
			expect(kinds.size).toBeGreaterThanOrEqual(2);
		});

		// L5 — pickup mix audit after L2 (no chaingunAmmo on procedural)
		// and L3 (chaingun unlimited).
		it(`seed=${seed}: procedural maps NEVER spawn chaingunAmmo (L2)`, () => {
			const map = generateMap(seed);
			for (const p of map.pickupSpawns) {
				expect(p.kind).not.toBe("chaingunAmmo");
			}
		});

		it(`seed=${seed}: procedural pickup kinds are bounded to {health, shotgunAmmo, flashlight}`, () => {
			const map = generateMap(seed);
			const allowed = new Set(["health", "shotgunAmmo", "flashlight"]);
			for (const p of map.pickupSpawns) {
				expect(allowed.has(p.kind)).toBe(true);
			}
		});

		it(`seed=${seed}: at least one health pickup is always present`, () => {
			const map = generateMap(seed);
			const hasHealth = map.pickupSpawns.some((p) => p.kind === "health");
			expect(hasHealth).toBe(true);
		});
	}
});
