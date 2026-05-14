/**
 * COV12 step-1 — fantasy loot pool contract.
 */

import { describe, expect, it } from "vitest";
import { LOOT_URL_LIST, LOOT_URLS, type LootKind, pickLootKind } from "../../loot";

describe("COV12 — fantasy loot pool", () => {
	it("ships 3 loot kinds (bottles/books/treasure)", () => {
		expect(Object.keys(LOOT_URLS).sort()).toEqual(["books", "bottles", "treasure"]);
	});

	it("LOOT_URL_LIST length matches LOOT_URLS entry count", () => {
		expect(LOOT_URL_LIST.length).toBe(Object.keys(LOOT_URLS).length);
	});

	it("every URL resolves to /assets/models/props/loot/*.glb", () => {
		for (const url of LOOT_URL_LIST) {
			expect(url).toMatch(/\/assets\/models\/props\/loot\/[A-Za-z]+\.glb$/);
		}
	});
});

describe("COV12 — pickLootKind", () => {
	it("is deterministic", () => {
		expect(pickLootKind(42)).toBe(pickLootKind(42));
	});

	it("returns a valid LootKind for any hash", () => {
		const validKinds: LootKind[] = ["bottles", "books", "treasure"];
		for (let h = 0; h < 30; h += 1) {
			expect(validKinds).toContain(pickLootKind(h));
		}
	});

	it("all 3 kinds reachable across hashes 0..2", () => {
		const seen = new Set<LootKind>();
		for (let h = 0; h < 3; h += 1) {
			seen.add(pickLootKind(h));
		}
		expect(seen.size).toBe(3);
	});

	it("handles negative hashes via unsigned right-shift", () => {
		const validKinds: LootKind[] = ["bottles", "books", "treasure"];
		expect(validKinds).toContain(pickLootKind(-1));
	});
});
