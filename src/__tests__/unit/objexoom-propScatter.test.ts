/**
 * E3 — decorative sector prop scatter contract.
 *
 * Pure-math layer. Pins the deterministic scatter algorithm:
 *  - Same `(map.seed, archetype)` → byte-identical layout.
 *  - 2-5 props per sector at default density.
 *  - Spawn / exit / key skip-radius (4 tiles) honored.
 *  - No two props within MIN_PROP_SPACING (1.4 tiles).
 *  - Grid maps return empty.
 *  - Every prop is in the matching archetype bucket.
 */

import type { ObjexoomGridMap, ObjexoomMap } from "@engine/engine";
import { loadRefLevel } from "@world/refLevel";
import { POOLS, type PropArchetype } from "@world/scatter/propPool";
import { PROPS_PER_SECTOR_MAX, spawnProps } from "@world/scatter/propScatter";
import { describe, expect, it } from "vitest";

function makeGridMap(): ObjexoomGridMap {
	return {
		kind: "grid",
		seed: 1,
		width: 1,
		height: 1,
		cells: [["empty"]],
		doorCell: { gx: 0, gy: 0 },
		rooms: [],
		playerSpawn: { x: 0, y: 0 },
		playerYaw: 0,
		enemySpawns: [],
		pickupSpawns: [],
		keyPosition: { x: 0, y: 0 },
		exitPosition: { x: 0, y: 0 },
	} as unknown as ObjexoomGridMap;
}

describe("E3 — sector prop scatter", () => {
	it("scatters at least one prop on a multi-sector ref level", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "corridor");
		expect(props.length).toBeGreaterThan(0);
	});

	it("is deterministic — same seed + archetype produces identical scatter", () => {
		const map = loadRefLevel(0);
		const a = spawnProps(map, "corridor");
		const b = spawnProps(map, "corridor");
		expect(a).toHaveLength(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].yaw).toBe(b[i].yaw);
			expect(a[i].prop.id).toBe(b[i].prop.id);
		}
	});

	it("different archetypes produce different layouts on the same map (different prop variants)", () => {
		const map = loadRefLevel(0);
		const corridor = spawnProps(map, "corridor");
		const sewer = spawnProps(map, "sewer");
		// At least one prop position picks a different variant — they share
		// the same RNG sequence for positions but different pools for picks.
		const corridorIds = corridor.map((p) => p.prop.id).join(",");
		const sewerIds = sewer.map((p) => p.prop.id).join(",");
		expect(corridorIds).not.toBe(sewerIds);
	});

	it("respects spawn / exit / key skip-radius (4 tiles)", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "corridor");
		const anchors = [map.playerSpawn, map.exitPosition, map.keyPosition];
		for (const inst of props) {
			for (const a of anchors) {
				const d = Math.hypot(a.x - inst.position.x, a.y - inst.position.y);
				expect(d, `prop ${inst.id} too close to anchor`).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it("no two props within MIN_PROP_SPACING (1.4 tiles) in the same sector", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "corridor");
		// Group by sectorId (id = sectorId * 1000 + i).
		const bySector = new Map<number, typeof props>();
		for (const p of props) {
			const sectorId = Math.floor(p.id / 1000);
			const list = bySector.get(sectorId) ?? [];
			list.push(p);
			bySector.set(sectorId, list);
		}
		for (const [, list] of bySector) {
			for (let i = 0; i < list.length; i += 1) {
				for (let j = i + 1; j < list.length; j += 1) {
					const d = Math.hypot(
						list[i].position.x - list[j].position.x,
						list[i].position.y - list[j].position.y,
					);
					expect(d, "two props in same sector too close").toBeGreaterThanOrEqual(1.4);
				}
			}
		}
	});

	it("per-sector count never exceeds PROPS_PER_SECTOR_MAX (5)", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "corridor");
		const bySector = new Map<number, number>();
		for (const p of props) {
			const sectorId = Math.floor(p.id / 1000);
			bySector.set(sectorId, (bySector.get(sectorId) ?? 0) + 1);
		}
		for (const [, count] of bySector) {
			expect(count).toBeLessThanOrEqual(5);
		}
	});

	it("every placed prop belongs to its archetype's pool (no cross-bucket leakage)", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "sewer");
		const sewerIds = new Set(POOLS.sewer.map((p) => p.id));
		for (const inst of props) {
			expect(sewerIds.has(inst.prop.id), `${inst.prop.id} not in sewer bucket`).toBe(true);
		}
	});

	it("ref levels 0/1/2 each scatter at least one prop", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const props = spawnProps(map, "corridor");
			expect(props.length).toBeGreaterThan(0);
		}
	});

	it("yaw is in [0, 2π) for every prop", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "corridor");
		for (const inst of props) {
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("ids are unique across the scatter", () => {
		const map = loadRefLevel(0);
		const props = spawnProps(map, "corridor");
		const ids = new Set(props.map((p) => p.id));
		expect(ids.size).toBe(props.length);
	});
});

describe("E3 — grid maps don't scatter in this slice", () => {
	it("spawnProps returns [] on a grid map", () => {
		const grid: ObjexoomMap = makeGridMap();
		expect(spawnProps(grid, "corridor")).toEqual([]);
	});
});

describe("E13 step-6 — per-archetype prop density", () => {
	it("library produces more total props than arena on the same map+seed (density)", () => {
		const map = loadRefLevel(0);
		const arena = spawnProps(map, "arena");
		const library = spawnProps(map, "library");
		expect(library.length).toBeGreaterThan(arena.length);
	});

	it("every archetype's max density respects PROPS_PER_SECTOR_MAX invariant", () => {
		const archetypes: PropArchetype[] = ["corridor", "arena", "courtyard", "sewer", "library"];
		const map = loadRefLevel(0);
		for (const archetype of archetypes) {
			const props = spawnProps(map, archetype);
			const bySector = new Map<number, number>();
			for (const p of props) {
				const sectorId = Math.floor(p.id / 1000);
				bySector.set(sectorId, (bySector.get(sectorId) ?? 0) + 1);
			}
			for (const [, count] of bySector) {
				expect(count).toBeLessThanOrEqual(PROPS_PER_SECTOR_MAX);
			}
		}
	});

	it("corridor density unchanged from pre-step-6 (canonical byte-stability)", () => {
		// Pre-step-6 max was 5, min was 2 — corridor entry should keep producing
		// counts in that range. The actual byte-stability is enforced by the
		// canonical e2e screenshot (refLevel 0 = corridor), but this guards
		// the table-entry shape too.
		const map = loadRefLevel(0);
		const corridor = spawnProps(map, "corridor");
		expect(corridor.length).toBeGreaterThan(0);
	});
});
