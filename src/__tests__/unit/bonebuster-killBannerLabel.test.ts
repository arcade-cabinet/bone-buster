/**
 * SLA4 — KillBanner flavor-name behavior.
 *
 * Exercises the skin-roster derivation by enemyId so the variant
 * surfaces correctly in the kill ticker. Direct test of the
 * pickEnemySkin → flavorName path that KillBanner now consumes.
 */

import { pickEnemySkin } from "@assets/models";
import { describe, expect, it } from "vitest";

describe("SLA4 — pickEnemySkin variant flavor names", () => {
	it("rattler roster has flavor names on non-canonical skins", () => {
		// Roster: skeleton (canonical, no flavor) / sewerfiend / horned / nun.
		const canonical = pickEnemySkin("rattler", 0);
		expect(canonical.flavorName).toBeUndefined();
		// id=1 hits index 1 — sewerfiend.
		expect(pickEnemySkin("rattler", 1).flavorName).toBe("SEWERFIEND");
		expect(pickEnemySkin("rattler", 2).flavorName).toBe("HORNED");
		expect(pickEnemySkin("rattler", 3).flavorName).toBe("CASSOCK");
	});

	it("phaser roster has flavor on the alien variant only", () => {
		expect(pickEnemySkin("phaser", 0).flavorName).toBeUndefined();
		expect(pickEnemySkin("phaser", 1).flavorName).toBe("INVADER");
	});

	it("bouncer roster has flavor names on every non-canonical skin", () => {
		// imp (canonical, no flavor) at index 0.
		expect(pickEnemySkin("bouncer", 0).flavorName).toBeUndefined();
		// PB / EL / AB / ST / AN / JE / GR map to indices 1..7.
		const flavors = [1, 2, 3, 4, 5, 6, 7].map((id) => pickEnemySkin("bouncer", id).flavorName);
		expect(flavors).toEqual([
			"BEAK",
			"ANTLERED",
			"ABOMINATION",
			"STUNTED",
			"ANOMALY",
			"JESTER",
			"GRINNER",
		]);
	});

	it("jester multi-skin model has CLOAKED on variant index 1", () => {
		expect(pickEnemySkin("jester", 0).flavorName).toBeUndefined();
		expect(pickEnemySkin("jester", 1).flavorName).toBe("CLOAKED");
	});

	it("heap multi-skin model has MUSCULAR on variant index 1", () => {
		expect(pickEnemySkin("heap", 0).flavorName).toBeUndefined();
		expect(pickEnemySkin("heap", 1).flavorName).toBe("MUSCULAR");
	});

	it("oneye multi-skin model has EYENOID on variant index 1", () => {
		expect(pickEnemySkin("oneye", 0).flavorName).toBeUndefined();
		expect(pickEnemySkin("oneye", 1).flavorName).toBe("EYENOID");
	});

	it("single-skin kinds (no roster variants) have no flavor name", () => {
		// devil is a one-roster kind (1 entry).
		expect(pickEnemySkin("devil", 0).flavorName).toBeUndefined();
		expect(pickEnemySkin("devil", 1).flavorName).toBeUndefined();
		expect(pickEnemySkin("bighoss", 0).flavorName).toBeUndefined();
	});

	it("skin pick is deterministic across calls", () => {
		expect(pickEnemySkin("rattler", 42).flavorName).toBe(pickEnemySkin("rattler", 42).flavorName);
	});
});
