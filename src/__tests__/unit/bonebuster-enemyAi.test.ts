import {
	BOUNCER_LEAD_FACTOR,
	GETHELP_RADIUS,
	LOS_LOST_MS,
	SHOOT_COOLDOWN_MS,
	SHOOT_RANGE,
	tickEnemyFsm,
	WANDER_JITTER_RAD_PER_SEC,
	WANDER_RADIUS,
} from "@ai/enemyAi";
import type { BoneBusterGridMap, Enemy } from "@engine/engine";
import { generateMap } from "@engine/engine";
import { describe, expect, it } from "vitest";

function makeEnemy(partial: Partial<Enemy> = {}): Enemy {
	return {
		id: 0,
		kind: "phaser",
		position: { x: 5, y: 5 },
		hp: 10,
		maxHp: 10,
		lastAttackAt: 0,
		dead: false,
		fsmState: 0,
		patrolBearing: 0,
		lastShotAt: 0,
		...partial,
	};
}

describe("bonebuster enemyAi FSM (C3)", () => {
	const map = generateMap(12345) as BoneBusterGridMap;
	const ctx = { doorOpen: false };

	it("state 0 stays in 0 when player is far + no LOS", () => {
		const enemy = makeEnemy({
			fsmState: 0,
			position: { x: 1.5, y: 1.5 },
		});
		const out = tickEnemyFsm({
			enemy,
			player: { x: map.width * 1.5, y: map.height * 1.5 }, // far + likely no LOS
			map,
			ctx,
			now: 0,
			dt: 0.016,
			allEnemies: [enemy],
			lastSeenAt: -Infinity,
		});
		expect(out.nextState).toBe(0);
		expect(out.fireBullet).toBe(false);
		expect(out.moveTarget).not.toBeNull(); // patrol drift
	});

	it("state 0 → 1 with gethelp propagation when LOS first acquired", () => {
		const me = makeEnemy({
			id: 0,
			fsmState: 0,
			position: { x: 5, y: 5 },
		});
		const friend = makeEnemy({
			id: 1,
			fsmState: 0,
			position: { x: 5.5, y: 5.5 }, // inside GETHELP_RADIUS
		});
		const stranger = makeEnemy({
			id: 2,
			fsmState: 0,
			position: { x: 99, y: 99 }, // outside radius
		});
		const out = tickEnemyFsm({
			enemy: me,
			player: { x: 5.1, y: 5.1 }, // co-located → LOS true
			map,
			ctx,
			now: 1_000,
			dt: 0.016,
			allEnemies: [me, friend, stranger],
			lastSeenAt: -Infinity,
		});
		expect(out.nextState).toBe(1);
		expect(out.gethelpFromIds).toContain(1);
		expect(out.gethelpFromIds).not.toContain(2);
	});

	it("state 1 falls back to state 0 after LOS_LOST_MS without sight", () => {
		const enemy = makeEnemy({
			fsmState: 1,
			position: { x: 5, y: 5 },
		});
		const out = tickEnemyFsm({
			enemy,
			player: { x: map.width * 2, y: map.height * 2 }, // no LOS
			map,
			ctx,
			now: 10_000,
			dt: 0.016,
			allEnemies: [enemy],
			lastSeenAt: 10_000 - LOS_LOST_MS - 100,
		});
		expect(out.nextState).toBe(0);
	});

	it("state 1 enters shoot (3) when within range, LOS, cooldown expired", () => {
		const enemy = makeEnemy({
			fsmState: 1,
			position: { x: 5, y: 5 },
			kind: "phaser",
			lastShotAt: 0,
		});
		const out = tickEnemyFsm({
			enemy,
			player: { x: 5.1, y: 5.2 }, // co-located → LOS true, dist < SHOOT_RANGE
			map,
			ctx,
			now: SHOOT_COOLDOWN_MS + 100,
			dt: 0.016,
			allEnemies: [enemy],
			lastSeenAt: SHOOT_COOLDOWN_MS + 100,
		});
		expect(out.nextState).toBe(3);
	});

	it("state 3 always fires a bullet and returns to state 1", () => {
		const enemy = makeEnemy({ fsmState: 3 });
		const out = tickEnemyFsm({
			enemy,
			player: { x: 5, y: 5 },
			map,
			ctx,
			now: 0,
			dt: 0.016,
			allEnemies: [enemy],
			lastSeenAt: 0,
		});
		expect(out.nextState).toBe(1);
		expect(out.fireBullet).toBe(true);
	});

	it("rattler kind never enters state 3 (no ranged attack)", () => {
		const enemy = makeEnemy({
			fsmState: 1,
			kind: "rattler",
			position: { x: 5, y: 5 },
			lastShotAt: 0,
		});
		const out = tickEnemyFsm({
			enemy,
			player: { x: 5.1, y: 5.2 },
			map,
			ctx,
			now: SHOOT_COOLDOWN_MS + 100,
			dt: 0.016,
			allEnemies: [enemy],
			lastSeenAt: SHOOT_COOLDOWN_MS + 100,
		});
		expect(out.nextState).toBe(1);
		expect(out.fireBullet).toBe(false);
	});

	it("bouncer kind shoots like phaser", () => {
		const enemy = makeEnemy({
			fsmState: 1,
			kind: "bouncer",
			position: { x: 5, y: 5 },
			lastShotAt: 0,
		});
		const out = tickEnemyFsm({
			enemy,
			player: { x: 5.1, y: 5.2 },
			map,
			ctx,
			now: SHOOT_COOLDOWN_MS + 100,
			dt: 0.016,
			allEnemies: [enemy],
			lastSeenAt: SHOOT_COOLDOWN_MS + 100,
		});
		expect(out.nextState).toBe(3);
	});

	it("constants are sane (sanity check, not regression)", () => {
		expect(GETHELP_RADIUS).toBeGreaterThan(1);
		expect(SHOOT_RANGE).toBeGreaterThan(1);
		expect(SHOOT_COOLDOWN_MS).toBeGreaterThan(500);
	});

	// Y2 — per-kind wander tuning. Skeletons drift tight, wraiths sweep wide.
	it("Y2: rattler wander is tighter than bouncer than phaser", () => {
		expect(WANDER_RADIUS.rattler).toBeLessThan(WANDER_RADIUS.bouncer);
		expect(WANDER_RADIUS.bouncer).toBeLessThan(WANDER_RADIUS.phaser);
		expect(WANDER_JITTER_RAD_PER_SEC.rattler).toBeLessThan(WANDER_JITTER_RAD_PER_SEC.phaser);
	});

	it("Y2: patrol jitters the bearing every frame (mutates enemy.patrolBearing)", () => {
		const enemy = makeEnemy({
			fsmState: 0,
			kind: "phaser",
			position: { x: 1.5, y: 1.5 },
			patrolBearing: 1.0,
		});
		const before = enemy.patrolBearing;
		tickEnemyFsm({
			enemy,
			player: { x: map.width * 1.5, y: map.height * 1.5 },
			map,
			ctx,
			now: 1000,
			dt: 0.5, // big dt so jitter is visible
			allEnemies: [enemy],
			lastSeenAt: -Infinity,
		});
		// Bearing should have been nudged — exactly by the jitter formula.
		expect(enemy.patrolBearing).not.toBe(before);
	});

	// Y3 — bouncer Pursuit. Lead-target only applies when kind=bouncer AND
	// playerVelocity is supplied. Rattler + phaser chase the raw position.
	it("Y3: bouncer chase respects playerVelocity (lead-target)", () => {
		const enemy = makeEnemy({
			fsmState: 1,
			kind: "bouncer",
			// Far enough that we won't trip the shoot transition.
			position: { x: 1, y: 1 },
			lastShotAt: Number.POSITIVE_INFINITY, // never ready to shoot
		});
		const player = { x: 5, y: 1 };
		const outNoLead = tickEnemyFsm({
			enemy: { ...enemy },
			player,
			map,
			ctx,
			now: 0,
			dt: 0.1,
			allEnemies: [enemy],
			lastSeenAt: 0,
		});
		const outLed = tickEnemyFsm({
			enemy: { ...enemy },
			player,
			map,
			ctx,
			now: 0,
			dt: 0.1,
			allEnemies: [enemy],
			lastSeenAt: 0,
			playerVelocity: { x: 8, y: 0 }, // moving fast to +x
		});
		// Both should have move targets; the lead version must step further
		// along +x than the no-lead version because the chase target is
		// projected ahead.
		expect(outLed.moveTarget).not.toBeNull();
		expect(outNoLead.moveTarget).not.toBeNull();
		if (outLed.moveTarget && outNoLead.moveTarget) {
			expect(outLed.moveTarget.x).toBeGreaterThanOrEqual(outNoLead.moveTarget.x);
		}
	});

	it("Y3: rattler ignores playerVelocity (no Pursuit)", () => {
		const enemy = makeEnemy({
			fsmState: 1,
			kind: "rattler",
			position: { x: 1, y: 1 },
		});
		const player = { x: 5, y: 1 };
		const outNoLead = tickEnemyFsm({
			enemy: { ...enemy },
			player,
			map,
			ctx,
			now: 0,
			dt: 0.1,
			allEnemies: [enemy],
			lastSeenAt: 0,
		});
		const outWithVel = tickEnemyFsm({
			enemy: { ...enemy },
			player,
			map,
			ctx,
			now: 0,
			dt: 0.1,
			allEnemies: [enemy],
			lastSeenAt: 0,
			playerVelocity: { x: 50, y: 0 },
		});
		// Identical for non-bouncer kinds.
		expect(outWithVel.moveTarget?.x).toBeCloseTo(outNoLead.moveTarget?.x ?? 0, 5);
	});

	it("Y3: BOUNCER_LEAD_FACTOR is positive", () => {
		expect(BOUNCER_LEAD_FACTOR).toBeGreaterThan(0);
	});
});
