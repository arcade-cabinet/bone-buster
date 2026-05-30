/**
 * E9 / STO1b — runHistory persistence smoke. Runs in real Chromium
 * (browser project) to exercise the full async runHistory API
 * (insert / listRecent / bestRun / runCount / clear) end-to-end.
 *
 * Backing store: `InMemoryDatabase` (the createDatabase factory's
 * fallback path when jeep-sqlite is not initialized). We do NOT call
 * `ensureJeepSqliteReady()` here — jeep-sqlite's bundled sql.js WASM
 * ABI is currently incompatible with our test harness's WASM loader
 * (LinkError on Import #34 "a" "I"), so we test the runtime SQL
 * surface (which is identical between CapacitorDatabase + InMemory)
 * and leave the WASM-load smoke for manual / e2e infra. Production
 * web builds DO initialize jeep-sqlite via app/main.tsx before
 * createDatabase runs, so the production path is CapacitorDatabase;
 * the runHistory SQL we exercise here is identical to that path.
 */

import { openRunHistory, type RunInsert } from "@store/runHistory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SAMPLE: RunInsert = {
	startedAt: 1_700_000_000_000,
	levelsCleared: 3,
	totalKills: 42,
	totalDamageTaken: 17,
	totalSecrets: 2,
	levelSet: "marrowed-vile-sepulcher",
	outcome: "died",
};

describe("runHistory (browser-mode, InMemory backing)", () => {
	beforeEach(() => {
		// Clear any lingering legacy-blob key so the migration path is
		// a guaranteed no-op for these tests.
		localStorage.removeItem("objexoom.runHistory");
		// Force the readiness flag off so createDatabase returns
		// InMemoryDatabase — see the module docstring.
		if (typeof window !== "undefined") {
			window.__bonebusterJeepSqliteReady = false;
		}
	});

	afterEach(() => {
		localStorage.removeItem("objexoom.runHistory");
	});

	it("inserts, lists, counts the in-memory database correctly", async () => {
		const db = await openRunHistory();
		expect(await db.runCount()).toBe(0);
		expect(await db.bestRun()).toBeNull();

		const a = await db.insert(SAMPLE, 1_700_000_300_000);
		expect(a.id).toBeGreaterThan(0);
		expect(a.levelsCleared).toBe(3);
		expect(a.endedAt).toBe(1_700_000_300_000);

		const b = await db.insert(
			{ ...SAMPLE, levelsCleared: 5, totalKills: 80, outcome: "won" },
			1_700_000_400_000,
		);
		expect(b.outcome).toBe("won");
		expect(await db.runCount()).toBe(2);

		// Best = furthest progress (5 > 3).
		const best = await db.bestRun();
		expect(best?.id).toBe(b.id);
		expect(best?.levelsCleared).toBe(5);

		// listRecent is newest-first.
		const recent = await db.listRecent(10);
		expect(recent.map((r) => r.id)).toEqual([b.id, a.id]);
	});

	it("clear() empties the table", async () => {
		const db = await openRunHistory();
		await db.insert(SAMPLE, 1_700_000_500_000);
		expect(await db.runCount()).toBe(1);
		await db.clear();
		expect(await db.runCount()).toBe(0);
	});

	it("POL5 — totalSecrets round-trips through insert + read", async () => {
		const db = await openRunHistory();
		await db.insert({ ...SAMPLE, totalSecrets: 4 }, 1_700_000_600_000);
		await db.insert({ ...SAMPLE, totalSecrets: 0 }, 1_700_000_700_000);
		const recent = await db.listRecent(10);
		expect(recent.map((r) => r.totalSecrets).sort()).toEqual([0, 4]);
	});
});
