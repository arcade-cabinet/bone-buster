/**
 * COV14 step-2 — ambient NPC scatter contract.
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/mapTypes";
import { ARCHETYPE_NAMES, archetypeForPhrase } from "@world/archetype";
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
function libraryMap(seedPhrase: string): BoneBusterSectorMap {
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
		seedPhrase,
		archetype: archetypeForPhrase(seedPhrase),
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
		expect(spawnNpcs(libraryMap("test-11"))).toEqual([]); // corridor
	});

	it("returns [] for grid maps", () => {
		const grid = { ...libraryMap("test-0"), kind: "grid" } as unknown as BoneBusterSectorMap;
		expect(spawnNpcs(grid)).toEqual([]);
	});

	it("populates instances on library-archetype maps", () => {
		const out = spawnNpcs(libraryMap("test-0"));
		expect(out.length).toBeGreaterThan(0);
	});
});

describe("COV14 step-2 — spawnNpcs invariants", () => {
	it("is deterministic — same seed → byte-identical layout", () => {
		const a = spawnNpcs(libraryMap("test-0"));
		const b = spawnNpcs(libraryMap("test-0"));
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			const ai = a[i];
			const bi = b[i];
			if (!ai || !bi) throw new Error(`scatter missing element at index ${i}`);
			expect(ai.id).toBe(bi.id);
			expect(ai.position.x).toBe(bi.position.x);
			expect(ai.position.y).toBe(bi.position.y);
			expect(ai.yaw).toBe(bi.yaw);
			expect(ai.kind).toBe(bi.kind);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnNpcs(libraryMap("test-0"));
		const ids = new Set(out.map((i) => i.id));
		expect(ids.size).toBe(out.length);
	});

	it("yaw is finite and in [0, 2π)", () => {
		for (const inst of spawnNpcs(libraryMap("test-0"))) {
			expect(Number.isFinite(inst.yaw)).toBe(true);
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("respects 4-tile skip-radius from spawn/exit/key", () => {
		const m = libraryMap("test-0");
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
		for (const inst of spawnNpcs(libraryMap("test-0"))) {
			expect(valid.has(inst.kind)).toBe(true);
		}
	});

	it("per-sector count never exceeds 2", () => {
		const out = spawnNpcs(libraryMap("test-0"));
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
		const out = spawnNpcs(libraryMap("test-0"));
		const kinds = new Set(out.map((i) => i.kind));
		expect(kinds.size).toBeGreaterThanOrEqual(2);
	});
});
