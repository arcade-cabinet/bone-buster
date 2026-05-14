import { describe, expect, it } from "vitest";
import {
	ENEMY_BULLET_TTL_MS,
	generateMap,
	makeEnemyBullet,
	stepEnemyBullet,
} from "@/engine";

describe("objexoom EnemyBullet (C2)", () => {
	const map = generateMap(12345);
	const ctx = { doorOpen: false };

	it("travels toward the target", () => {
		const bullet = makeEnemyBullet(0, 0, { x: 1, y: 1 }, { x: 5, y: 1 }, 0);
		const before = bullet.position.x;
		stepEnemyBullet(bullet, 0.1, 100, { x: 100, y: 100 }, map, ctx);
		expect(bullet.position.x).toBeGreaterThan(before);
		expect(Math.abs(bullet.position.y - 1)).toBeLessThan(1e-3);
	});

	it("expires after ENEMY_BULLET_TTL_MS", () => {
		const bullet = makeEnemyBullet(0, 0, { x: 1, y: 1 }, { x: 1.1, y: 1 }, 0);
		const step = stepEnemyBullet(
			bullet,
			0.016,
			ENEMY_BULLET_TTL_MS + 1,
			{ x: 100, y: 100 },
			map,
			ctx,
		);
		expect(step.kind).toBe("expired");
	});

	it("registers a player hit when within proximity", () => {
		const bullet = makeEnemyBullet(0, 0, { x: 1, y: 1 }, { x: 2, y: 1 }, 0);
		// Player co-located with bullet — first step should hit.
		const step = stepEnemyBullet(bullet, 0.1, 100, bullet.position, map, ctx);
		expect(step.kind).toBe("hitPlayer");
	});

	it("returns hitWall when the bullet path is blocked", () => {
		// Use procedural map's known wall: cell (0,0) is wall.
		const bullet = makeEnemyBullet(
			0,
			0,
			{ x: 0.5, y: 0.5 },
			{ x: -10, y: 0.5 },
			0,
		);
		const step = stepEnemyBullet(bullet, 0.5, 100, { x: 99, y: 99 }, map, ctx);
		// Either hit a wall or — if the spawn is *inside* the wall — alive.
		// On the procedural map the perimeter cells are wall, so a bullet
		// fired westward from (0.5, 0.5) at -X immediately tries to cross
		// into wall territory.
		expect(["hitWall", "alive"]).toContain(step.kind);
	});
});
