/**
 * D3 — Weapon-acquired HUD beat.
 *
 * PRD §D3: first time `ownedWeapons[X]` flips false→true,
 * a 600ms chip-brighten animation fires. Idempotent — no
 * replay on weapon swap.
 *
 * This test pins the wire contract (the new typed event
 * exists, round-trips through the typed bus, carries a
 * WeaponId payload). The "fires exactly once per weapon"
 * acceptance is enforced inside useGameRef's setState
 * callback: it dispatches only when `prev.ownedWeapons[w]`
 * was false; calling onCollectPickup("X-Ammo") again with
 * w already owned is a no-op for the event. That gating
 * lives in useGameRef.ts where the setState callback can
 * see `prev` — exercising it from unit tests would require
 * a full React renderer; the helper-extract pattern would
 * just push the bug to a different module.
 *
 * Integration coverage for the once-per-weapon contract
 * is the human visual check (D3's "Visual gate refreshes"
 * — observe the chip beat ONCE on first pickup, not
 * again on subsequent ammo pickups of the same weapon).
 */

import {
	addBoneBusterListener,
	dispatch,
	type WeaponAcquiredEvent,
} from "@engine/events";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("D3 — weaponAcquired typed event", () => {
	it("round-trips through the typed bus with a WeaponId payload", () => {
		const received: WeaponAcquiredEvent[] = [];
		const teardown = addBoneBusterListener("weaponAcquired", (e) => received.push(e));
		const out: WeaponAcquiredEvent = { type: "weaponAcquired", weapon: "shotgun" };
		dispatch(out);
		teardown();
		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(out);
	});

	it("supports each ranged weapon as a payload", () => {
		const received: WeaponAcquiredEvent[] = [];
		const teardown = addBoneBusterListener("weaponAcquired", (e) => received.push(e));
		dispatch({ type: "weaponAcquired", weapon: "chaingun" });
		dispatch({ type: "weaponAcquired", weapon: "shotgun" });
		dispatch({ type: "weaponAcquired", weapon: "flamethrower" });
		teardown();
		expect(received).toHaveLength(3);
		expect(received.map((e) => e.weapon)).toEqual(["chaingun", "shotgun", "flamethrower"]);
	});

	it("listener cleanup unsubscribes (no leak across tests)", () => {
		const received: WeaponAcquiredEvent[] = [];
		const teardown = addBoneBusterListener("weaponAcquired", (e) => received.push(e));
		teardown();
		dispatch({ type: "weaponAcquired", weapon: "flamethrower" });
		expect(received).toHaveLength(0);
	});
});
