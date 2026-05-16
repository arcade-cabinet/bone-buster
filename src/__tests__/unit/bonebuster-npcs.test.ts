/**
 * COV14 step-1 — NPC chibi pool contract.
 */

import { NPC_URL_LIST, NPC_URLS, type NpcKind, pickNpcKind } from "@world/npcs";
import { describe, expect, it } from "vitest";

describe("COV14 — NPC chibi pool", () => {
	it("ships ≥6 NPC kinds", () => {
		expect(Object.keys(NPC_URLS).length).toBeGreaterThanOrEqual(6);
	});

	it("NPC_URL_LIST matches NPC_URLS entry count", () => {
		expect(NPC_URL_LIST.length).toBe(Object.keys(NPC_URLS).length);
	});

	it("every URL resolves to /assets/models/enemies/npc/*.glb", () => {
		for (const url of NPC_URL_LIST) {
			expect(url).toMatch(/\/assets\/models\/enemies\/npc\/[a-z]+\.glb$/);
		}
	});

	it("URLs are unique", () => {
		expect(new Set(NPC_URL_LIST).size).toBe(NPC_URL_LIST.length);
	});
});

describe("COV14 — pickNpcKind", () => {
	it("is deterministic", () => {
		expect(pickNpcKind(42)).toBe(pickNpcKind(42));
	});

	it("returns a valid NpcKind for any hash", () => {
		const valid: NpcKind[] = ["archer", "knight", "merchant", "ninja", "student", "basemesh"];
		for (let h = 0; h < 30; h += 1) {
			expect(valid).toContain(pickNpcKind(h));
		}
	});

	it("all kinds reachable across hashes 0..N-1", () => {
		const seen = new Set<NpcKind>();
		for (let h = 0; h < 6; h += 1) {
			seen.add(pickNpcKind(h));
		}
		expect(seen.size).toBe(6);
	});

	it("handles negative hashes via unsigned right-shift", () => {
		const valid: NpcKind[] = ["archer", "knight", "merchant", "ninja", "student", "basemesh"];
		expect(valid).toContain(pickNpcKind(-1));
	});
});
