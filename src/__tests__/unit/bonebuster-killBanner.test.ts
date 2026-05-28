import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * PB2 — non-boss enemy-kill HUD banner. The KillBanner overlay listens
 * for `enemyKilled` events dispatched by fireResolution when a non-boss
 * enemy's HP crosses ≤0. Boss kills keep their own `bossDefeated`
 * event (covered by bonebuster-bossBanner.test.ts).
 *
 * These tests pin the dispatch contract; the React component is
 * exercised by playtest captures.
 */

interface CapturedEvent {
	type: string;
	enemyId?: number;
	kind?: string;
}

function captureBus() {
	const events: CapturedEvent[] = [];
	const listener = (e: Event) => {
		const ce = e as CustomEvent;
		events.push({ type: ce.type.replace(/^bonebuster:/, ""), ...ce.detail });
	};
	for (const t of ["bonebuster:enemyKilled", "bonebuster:bossDefeated"]) {
		window.addEventListener(t, listener);
	}
	return {
		events,
		cleanup: () => {
			for (const t of ["bonebuster:enemyKilled", "bonebuster:bossDefeated"]) {
				window.removeEventListener(t, listener);
			}
		},
	};
}

describe("PB2 enemy-kill banner dispatch", () => {
	let bus: ReturnType<typeof captureBus>;
	beforeEach(() => {
		bus = captureBus();
	});
	// Cleanup belongs in afterEach so a failing assertion still tears
	// down the listener. Otherwise a single failure leaks the listener
	// into every subsequent test in this file and pollutes counts.
	afterEach(() => {
		bus.cleanup();
	});

	it("enemyKilled carries the enemyId + kind payload", async () => {
		const { dispatch } = await import("@engine/events");
		dispatch({ type: "enemyKilled", enemyId: 42, kind: "plaguebeak" });
		expect(bus.events).toHaveLength(1);
		const ev0 = bus.events[0];
		if (!ev0) throw new Error("bus.events[0] missing after toHaveLength(1)");
		expect(ev0.type).toBe("enemyKilled");
		expect(ev0.enemyId).toBe(42);
		expect(ev0.kind).toBe("plaguebeak");
	});

	it("multi-kill bursts each dispatch their own event so the banner can stack-count", async () => {
		const { dispatch } = await import("@engine/events");
		for (let i = 0; i < 3; i += 1) {
			dispatch({ type: "enemyKilled", enemyId: 100 + i, kind: "rattler" });
		}
		const killEvents = bus.events.filter((e) => e.type === "enemyKilled");
		expect(killEvents).toHaveLength(3);
		expect(killEvents.map((e) => e.enemyId)).toEqual([100, 101, 102]);
	});

	it("enemyKilled and bossDefeated are distinct channels — listeners filter independently", async () => {
		const { dispatch } = await import("@engine/events");
		dispatch({ type: "enemyKilled", enemyId: 1, kind: "rattler" });
		dispatch({ type: "bossDefeated", enemyId: 99 });
		const kills = bus.events.filter((e) => e.type === "enemyKilled");
		const bosses = bus.events.filter((e) => e.type === "bossDefeated");
		expect(kills).toHaveLength(1);
		expect(bosses).toHaveLength(1);
		const kill0 = kills[0];
		const boss0 = bosses[0];
		if (!kill0 || !boss0) throw new Error("kills[0] or bosses[0] missing after toHaveLength(1)");
		expect(kill0.kind).toBe("rattler");
		expect(boss0.enemyId).toBe(99);
	});
});
