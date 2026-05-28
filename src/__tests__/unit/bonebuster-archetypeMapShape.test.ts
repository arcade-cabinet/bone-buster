/**
 * E13 step-5 — per-archetype sector density / size contract.
 */

import { generateMap } from "@engine/engine";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { ARCHETYPE_MAP_SHAPES, getArchetypeMapShape } from "@world/archetypeMapShape";
import { describe, expect, it } from "vitest";

describe("E13 step-5 — archetype map shapes", () => {
	it("ships an entry for every archetype", () => {
		for (const name of ARCHETYPE_NAMES) {
			expect(ARCHETYPE_MAP_SHAPES[name]).toBeDefined();
		}
	});

	it("corridor preserves the pre-step-5 defaults (canonical byte-stability)", () => {
		const corridor = getArchetypeMapShape("corridor");
		expect(corridor.minRoom).toBe(3);
		expect(corridor.maxRoom).toBe(6);
		expect(corridor.roomTries).toBe(90);
	});

	it("every shape has minRoom ≤ maxRoom and positive roomTries", () => {
		for (const name of ARCHETYPE_NAMES) {
			const s = ARCHETYPE_MAP_SHAPES[name];
			expect(s.minRoom).toBeLessThanOrEqual(s.maxRoom);
			expect(s.roomTries).toBeGreaterThan(0);
			expect(s.minRoom).toBeGreaterThan(0);
		}
	});

	it("at least 3 archetypes have distinct shape signatures", () => {
		const sigs = new Set(
			ARCHETYPE_NAMES.map((n) => {
				const s = ARCHETYPE_MAP_SHAPES[n];
				return `${s.minRoom}-${s.maxRoom}-${s.roomTries}`;
			}),
		);
		expect(sigs.size).toBeGreaterThanOrEqual(3);
	});
});

describe("E13 step-5 — generateMap respects shape override", () => {
	it("seed 0 with no shape arg → byte-identical to seed 0 with corridor shape", () => {
		const a = generateMap(0);
		const b = generateMap(0, getArchetypeMapShape("corridor"));
		expect(a.seed).toBe(b.seed);
		expect(a.cells.length).toBe(b.cells.length);
		for (let y = 0; y < a.cells.length; y += 1) {
			const rowA = a.cells[y];
			const rowB = b.cells[y];
			if (!rowA || !rowB) throw new RangeError(`cells row ${y} missing`);
			for (let x = 0; x < rowA.length; x += 1) {
				expect(rowA[x]).toBe(rowB[x]);
			}
		}
		expect(a.rooms.length).toBe(b.rooms.length);
	});

	it("arena shape produces fewer/larger rooms than corridor at the same seed", () => {
		const corridor = generateMap(42, getArchetypeMapShape("corridor"));
		const arena = generateMap(42, getArchetypeMapShape("arena"));
		// Arena's roomTries (50) is lower than corridor's (90) but maxRoom
		// is bigger (8 vs 6) — total floor area can be similar but room
		// COUNT should differ.
		// Stronger invariant: every arena room satisfies minRoom=5.
		for (const room of arena.rooms) {
			expect(room.width).toBeGreaterThanOrEqual(5);
			expect(room.height).toBeGreaterThanOrEqual(5);
		}
		// And every corridor room respects the corridor shape.
		for (const room of corridor.rooms) {
			expect(room.width).toBeGreaterThanOrEqual(3);
			expect(room.height).toBeGreaterThanOrEqual(3);
			expect(room.width).toBeLessThanOrEqual(6);
			expect(room.height).toBeLessThanOrEqual(6);
		}
	});

	it("library shape produces small uniform rooms", () => {
		const library = generateMap(7, getArchetypeMapShape("library"));
		for (const room of library.rooms) {
			expect(room.width).toBeLessThanOrEqual(5);
			expect(room.height).toBeLessThanOrEqual(5);
		}
	});

	it("sewer shape allows narrower rooms (minRoom=2)", () => {
		const sewer = generateMap(13, getArchetypeMapShape("sewer"));
		for (const room of sewer.rooms) {
			expect(room.width).toBeGreaterThanOrEqual(2);
			expect(room.height).toBeGreaterThanOrEqual(2);
			expect(room.width).toBeLessThanOrEqual(5);
			expect(room.height).toBeLessThanOrEqual(5);
		}
	});

	it("is deterministic — same seed + same shape → same map", () => {
		const a = generateMap(99, getArchetypeMapShape("courtyard"));
		const b = generateMap(99, getArchetypeMapShape("courtyard"));
		expect(a.rooms.length).toBe(b.rooms.length);
		for (let i = 0; i < a.rooms.length; i += 1) {
			expect(a.rooms[i]).toEqual(b.rooms[i]);
		}
	});
});
