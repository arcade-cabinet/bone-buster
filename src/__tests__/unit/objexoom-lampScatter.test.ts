/**
 * COV1 — lamp scatter contract.
 *
 * Pure-math layer. Verifies the scatter algorithm produces a
 * deterministic per-seed layout with at least 2 distinct variants
 * when ≥ 2 sectors are scattered, that lit lamps stay below
 * `MAX_LIT_LAMPS`, and that grid maps don't scatter lamps in this
 * slice.
 */

import type { ObjexoomGridMap, ObjexoomMap } from "@engine/engine";
import {
	countLampVariants,
	LAMP_VARIANTS_OFF,
	LAMP_VARIANTS_ON,
	lampUrlFor,
	MAX_LIT_LAMPS,
	spawnLamps,
} from "@world/lampScatter";
import { loadRefLevel } from "@world/refLevel";
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

describe("COV1 — lamp variant URL pool", () => {
	it("ships 5 off variants and 5 on variants", () => {
		expect(LAMP_VARIANTS_OFF).toHaveLength(5);
		expect(LAMP_VARIANTS_ON).toHaveLength(5);
	});

	it("every variant URL resolves via the A() helper (BASE_URL-aware)", () => {
		for (const url of [...LAMP_VARIANTS_OFF, ...LAMP_VARIANTS_ON]) {
			expect(url).toMatch(/\/assets\/models\/props\/lamps\/lamp_mx_[1-4][_a-z]*_(on|off)\.glb$/);
		}
	});

	it("lampUrlFor picks off when on=false and on when on=true", () => {
		const off = lampUrlFor({ id: 0, position: { x: 0, y: 0 }, variantIndex: 2, on: false });
		const on = lampUrlFor({ id: 0, position: { x: 0, y: 0 }, variantIndex: 2, on: true });
		expect(off).toBe(LAMP_VARIANTS_OFF[2]);
		expect(on).toBe(LAMP_VARIANTS_ON[2]);
	});
});

describe("COV1 — sector-map lamp scatter", () => {
	it("scatters at least 2 lamps on a multi-sector ref level", () => {
		const map = loadRefLevel(0);
		const lamps = spawnLamps(map);
		expect(lamps.length).toBeGreaterThanOrEqual(2);
	});

	it("uses at least 2 distinct variants when ≥ 2 lamps are placed", () => {
		const map = loadRefLevel(0);
		const lamps = spawnLamps(map);
		if (lamps.length >= 2) {
			expect(countLampVariants(lamps)).toBeGreaterThanOrEqual(2);
		}
	});

	it("is deterministic — same seed produces identical scatter", () => {
		const map = loadRefLevel(0);
		const a = spawnLamps(map);
		const b = spawnLamps(map);
		expect(a).toHaveLength(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].variantIndex).toBe(b[i].variantIndex);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
		}
	});

	it("ref levels 0/1/2 each scatter lamps", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const lamps = spawnLamps(map);
			expect(lamps.length).toBeGreaterThan(0);
		}
	});

	it("scatter respects skipRadius — no lamps placed near spawn/exit/key", () => {
		const map = loadRefLevel(0);
		const lamps = spawnLamps(map);
		const skipPoints = [map.playerSpawn, map.exitPosition, map.keyPosition];
		for (const lamp of lamps) {
			for (const p of skipPoints) {
				const d = Math.hypot(p.x - lamp.position.x, p.y - lamp.position.y);
				expect(d, `lamp ${lamp.id} too close to a skip point`).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it("E4 — first MAX_LIT_LAMPS lamps are lit (on=true); rest stay off", () => {
		const map = loadRefLevel(0);
		const lamps = spawnLamps(map);
		const litCount = lamps.filter((l) => l.on).length;
		expect(litCount).toBeLessThanOrEqual(MAX_LIT_LAMPS);
		expect(litCount).toBe(Math.min(MAX_LIT_LAMPS, lamps.length));
		// Lit subset is the prefix, off subset is the suffix.
		for (let i = 0; i < lamps.length; i += 1) {
			if (i < MAX_LIT_LAMPS) expect(lamps[i].on).toBe(true);
			else expect(lamps[i].on).toBe(false);
		}
	});

	it("variantIndex always in [0, LAMP_VARIANTS_OFF.length)", () => {
		const map = loadRefLevel(0);
		const lamps = spawnLamps(map);
		for (const lamp of lamps) {
			expect(lamp.variantIndex).toBeGreaterThanOrEqual(0);
			expect(lamp.variantIndex).toBeLessThan(LAMP_VARIANTS_OFF.length);
		}
	});
});

describe("COV1 — grid maps don't scatter lamps in this slice", () => {
	it("spawnLamps returns [] on a grid map", () => {
		const grid: ObjexoomMap = makeGridMap();
		expect(spawnLamps(grid)).toEqual([]);
	});
});

describe("COV1 — lit-lamp budget", () => {
	it("MAX_LIT_LAMPS is conservative (≤ 8) for shadow-map budget", () => {
		expect(MAX_LIT_LAMPS).toBeLessThanOrEqual(8);
	});
});
