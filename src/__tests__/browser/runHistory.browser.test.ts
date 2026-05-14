/**
 * E9 — runHistory persistence smoke. Runs in real Chromium (browser
 * project) because sql.js needs WASM and we want real localStorage,
 * neither of which is reliable in jsdom.
 *
 * The wasm artifact lives at `/assets/wasm/sql-wasm.wasm`, copied at
 * postinstall + prebuild by `scripts/prepare-web-wasm.mjs`. The Vitest
 * browser provider serves the project root, so the URL resolves.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openRunHistory, type RunInsert } from "../../runHistory";

const SAMPLE: RunInsert = {
	startedAt: 1_700_000_000_000,
	levelsCleared: 3,
	totalKills: 42,
	totalDamageTaken: 17,
	totalSecrets: 2,
	level: 1,
	outcome: "died",
};

describe("runHistory (sql.js, real browser)", () => {
	beforeEach(() => {
		localStorage.removeItem("objexoom.runHistory");
	});

	afterEach(() => {
		localStorage.removeItem("objexoom.runHistory");
	});

	it("inserts, lists, counts, and persists across reopens", async () => {
		const first = await openRunHistory();
		expect(first.runCount()).toBe(0);
		expect(first.bestRun()).toBeNull();

		const a = first.insert(SAMPLE, 1_700_000_300_000);
		expect(a.id).toBeGreaterThan(0);
		expect(a.levelsCleared).toBe(3);
		expect(a.endedAt).toBe(1_700_000_300_000);

		const b = first.insert(
			{ ...SAMPLE, levelsCleared: 5, totalKills: 80, outcome: "won" },
			1_700_000_400_000,
		);
		expect(b.outcome).toBe("won");
		expect(first.runCount()).toBe(2);

		// Best = furthest progress.
		const best = first.bestRun();
		expect(best?.id).toBe(b.id);
		expect(best?.levelsCleared).toBe(5);

		// listRecent is newest-first.
		const recent = first.listRecent(10);
		expect(recent.map((r) => r.id)).toEqual([b.id, a.id]);

		// Reopen and confirm persistence.
		const second = await openRunHistory();
		expect(second.runCount()).toBe(2);
		expect(second.bestRun()?.id).toBe(b.id);
	});

	it("clear() empties the table and survives reopen", async () => {
		const db = await openRunHistory();
		db.insert(SAMPLE, 1_700_000_500_000);
		expect(db.runCount()).toBe(1);

		db.clear();
		expect(db.runCount()).toBe(0);

		const reopened = await openRunHistory();
		expect(reopened.runCount()).toBe(0);
	});

	it("POL5 — totalSecrets round-trips through insert + read + reopen", async () => {
		const first = await openRunHistory();
		first.insert({ ...SAMPLE, totalSecrets: 4 }, 1_700_000_600_000);
		first.insert({ ...SAMPLE, totalSecrets: 0 }, 1_700_000_700_000);

		const recent = first.listRecent(10);
		expect(recent.map((r) => r.totalSecrets).sort()).toEqual([0, 4]);

		// Survive reopen.
		const reopened = await openRunHistory();
		const recentAfter = reopened.listRecent(10);
		expect(recentAfter.map((r) => r.totalSecrets).sort()).toEqual([0, 4]);
	});
});
