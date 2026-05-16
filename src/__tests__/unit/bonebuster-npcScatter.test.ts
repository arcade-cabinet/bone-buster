/**
 * COV14 step-2 — ambient NPC scatter contract.
 */

import type { ObjexoomSectorMap, Vec2 } from "@engine/engine";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { spawnNpcs } from "@world/scatter/npcScatter";
import { describe, expect, it } from "vitest";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

// Library archetype = seed % 5 === 4.
function libraryMap(seed: number): ObjexoomSectorMap {
	const sectors = [];
	for (let i = 0; i < 20; i += 1) {
		sectors.push({
			id: i,
			vertices: bigSquare(i * 30, 0, 12),
			floorHeight: 0,
			ceilingHeight: 10,
		});
	}
	return {
		kind: "sectors",
		seed,
		archetype: ARCHETYPE_NAMES[(seed >>> 0) % ARCHETYPE_NAMES.length],
		sectors,
		playerSpawn: { x: -100, y: -100 },
		playerYaw: 0,
		enemySpawns: [],
		pickupSpawns: [],
		keyPosition: { x: 1000, y: 1000 },
		exitPosition: { x: 1001, y: 1001 },
		bounds: { minX: -110, minY: -110, maxX: 600, maxY: 110 },
	};
}

describe("COV14 step-2 — spawnNpcs archetype gating", () => {
	it("returns [] on non-library archetypes", () => {
		expect(spawnNpcs(libraryMap(0))).toEqual([]); // corridor
	});

	it("returns [] for grid maps", () => {
		const grid = { ...libraryMap(4), kind: "grid" } as unknown as ObjexoomSectorMap;
		expect(spawnNpcs(grid)).toEqual([]);
	});

	it("populates instances on library-archetype maps", () => {
		const out = spawnNpcs(libraryMap(4));
		expect(out.length).toBeGreaterThan(0);
	});
});

describe("COV14 step-2 — spawnNpcs invariants", () => {
	it("is deterministic — same seed → byte-identical layout", () => {
		const a = spawnNpcs(libraryMap(4));
		const b = spawnNpcs(libraryMap(4));
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].yaw).toBe(b[i].yaw);
			expect(a[i].kind).toBe(b[i].kind);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnNpcs(libraryMap(4));
		const ids = new Set(out.map((i) => i.id));
		expect(ids.size).toBe(out.length);
	});

	it("yaw is finite and in [0, 2π)", () => {
		for (const inst of spawnNpcs(libraryMap(4))) {
			expect(Number.isFinite(inst.yaw)).toBe(true);
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("respects 4-tile skip-radius from spawn/exit/key", () => {
		const m = libraryMap(4);
		const anchors = [m.playerSpawn, m.exitPosition, m.keyPosition];
		for (const inst of spawnNpcs(m)) {
			for (const a of anchors) {
				const d = Math.hypot(a.x - inst.position.x, a.y - inst.position.y);
				expect(d).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it("kinds are valid NpcKind values", () => {
		const valid = new Set(["archer", "knight", "merchant", "ninja", "student", "basemesh"]);
		for (const inst of spawnNpcs(libraryMap(4))) {
			expect(valid.has(inst.kind)).toBe(true);
		}
	});

	it("per-sector count never exceeds 2", () => {
		const out = spawnNpcs(libraryMap(4));
		const perSector = new Map<number, number>();
		for (const inst of out) {
			const sid = Math.floor(inst.id / 100);
			perSector.set(sid, (perSector.get(sid) ?? 0) + 1);
		}
		for (const count of perSector.values()) {
			expect(count).toBeLessThanOrEqual(2);
		}
	});

	it("over a large sample, multiple NpcKinds appear (no monoculture)", () => {
		const out = spawnNpcs(libraryMap(4));
		const kinds = new Set(out.map((i) => i.kind));
		expect(kinds.size).toBeGreaterThanOrEqual(2);
	});
});
