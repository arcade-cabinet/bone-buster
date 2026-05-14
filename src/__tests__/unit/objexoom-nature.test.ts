/**
 * COV11 step-1 — nature pack contract.
 */

import { describe, expect, it } from "vitest";
import { NATURE_MEGA_PACK_URL } from "../../nature";

describe("COV11 — nature mega pack", () => {
	it("URL resolves to /assets/models/props/nature/Mega_Nature.glb", () => {
		expect(NATURE_MEGA_PACK_URL).toMatch(/\/assets\/models\/props\/nature\/Mega_Nature\.glb$/);
	});

	it("URL is a non-empty string", () => {
		expect(typeof NATURE_MEGA_PACK_URL).toBe("string");
		expect(NATURE_MEGA_PACK_URL.length).toBeGreaterThan(0);
	});
});
