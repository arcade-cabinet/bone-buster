import { beforeEach, describe, expect, it } from "vitest";

/**
 * POL36 — boss HUD banner. Two events feed the slot:
 *   bossSpotted   dispatched on first patrol→chase transition of any
 *                 tier="boss" enemy. Per-enemy idempotent via
 *                 bossSpottedFiredRef.
 *   bossDefeated  dispatched on every tier="boss" enemy kill in
 *                 fireResolution (NOT shot-aggregated).
 *
 * These tests pin only the dispatch contract — the BossBanner React
 * component is exercised by visual self-judge + playtest captures.
 */

interface CapturedEvent {
	type: string;
	enemyId?: number;
}

function captureBus() {
	const events: CapturedEvent[] = [];
	const listener = (e: Event) => {
		const ce = e as CustomEvent;
		events.push({ type: ce.type.replace(/^objexoom:/, ""), ...ce.detail });
	};
	for (const t of ["objexoom:bossSpotted", "objexoom:bossDefeated"]) {
		window.addEventListener(t, listener);
	}
	return {
		events,
		cleanup: () => {
			for (const t of ["objexoom:bossSpotted", "objexoom:bossDefeated"]) {
				window.removeEventListener(t, listener);
			}
		},
	};
}

describe("POL36 boss banner dispatch", () => {
	let bus: ReturnType<typeof captureBus>;
	beforeEach(() => {
		bus = captureBus();
	});

	it("bossSpotted dispatches exactly once per enemy id via the firedRef gate", async () => {
		const { dispatch } = await import("@engine/events");
		const fired = new Set<number>();

		// Simulate the enemyTickLoop gate: only dispatch if not already fired
		function maybeSpot(enemyId: number) {
			if (fired.has(enemyId)) return;
			fired.add(enemyId);
			dispatch({ type: "bossSpotted", enemyId });
		}
		maybeSpot(7);
		maybeSpot(7);
		maybeSpot(7);
		expect(bus.events.filter((e) => e.type === "bossSpotted")).toHaveLength(1);
		bus.cleanup();
	});

	it("bossSpotted dispatches independently for separate enemy ids", async () => {
		const { dispatch } = await import("@engine/events");
		const fired = new Set<number>();
		function maybeSpot(enemyId: number) {
			if (fired.has(enemyId)) return;
			fired.add(enemyId);
			dispatch({ type: "bossSpotted", enemyId });
		}
		maybeSpot(1);
		maybeSpot(2);
		maybeSpot(3);
		expect(bus.events.filter((e) => e.type === "bossSpotted")).toHaveLength(3);
		expect(bus.events.map((e) => e.enemyId)).toEqual([1, 2, 3]);
		bus.cleanup();
	});

	it("bossDefeated dispatches per-enemy not per-shot (multi-boss kill on same shot fires N events)", async () => {
		const { dispatch } = await import("@engine/events");
		// Simulate fireResolution's per-enemy branch in a shot that kills 2 bosses.
		const killedBossIds = [101, 102];
		for (const id of killedBossIds) dispatch({ type: "bossDefeated", enemyId: id });
		const defeats = bus.events.filter((e) => e.type === "bossDefeated");
		expect(defeats).toHaveLength(2);
		expect(defeats.map((e) => e.enemyId)).toEqual([101, 102]);
		bus.cleanup();
	});
});
