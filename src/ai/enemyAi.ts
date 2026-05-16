/**
 * Faithful port of the reference's BaseEnemy state machine (game.js
 * `BaseEnemy._fsm_advance`):
 *
 *   state 0 (PATROL)  → if LOS to player, aggro → state 1
 *                       else drift along assigned bearing
 *   state 1 (CHASE)   → no LOS for >LOS_LOST_MS, fall back to 0
 *                       in range AND ready to shoot → state 3
 *                       else step toward player
 *   state 3 (SHOOT)   → spawn one EnemyBullet, then back to state 1
 *
 * gethelp(): when one enemy first acquires the player, all enemies within
 * GETHELP_RADIUS aggro to state 1 too. Matches reference behavior — keeps
 * the player from picking off patrolling enemies one-by-one.
 */

// Y1/Y3/Y8 — yuka-backed step math. The hand-rolled FSM stays
// (it's the "thin compat shim" Y8 calls out); the per-frame patrol +
// chase displacement now flows through `yukaStepToward` / `yukaWanderTarget`
// so the migration toward yuka.WanderBehavior / SeekBehavior has a
// landing spot. Tests are unaffected because the return shape is
// identical.
import { yukaAvoidObstacles, yukaStepToward, yukaWanderTarget } from "@ai/yukaIntegration";
import type { CollisionContext, Enemy, EnemyFsmState, ObjexoomMap, Vec2 } from "@engine/engine";
import { hasLineOfSightAny, resolveCollisionAny } from "@engine/engine";

export const GETHELP_RADIUS = 6.5;
export const LOS_LOST_MS = 2_500;
export const SHOOT_COOLDOWN_MS = 2_000;
export const SHOOT_RANGE = 8;
export const PATROL_SPEED = 0.4;
export const CHASE_SPEED_SKELETON = 1.1;
export const CHASE_SPEED_WRAITH = 1.5;
export const CHASE_SPEED_IMP = 0.9;

// Y2 — per-kind wander tuning. Skeletons wander tight, imps moderate,
// wraiths sweep wide. Bearing jitter per second adds organic drift
// (mirrors yuka.WanderBehavior's jitter parameter).
export const WANDER_RADIUS: Record<Enemy["kind"], number> = {
	skeleton: 0.7,
	imp: 1.0,
	wraith: 1.8,
};
export const WANDER_JITTER_RAD_PER_SEC: Record<Enemy["kind"], number> = {
	skeleton: 0.4,
	imp: 0.6,
	wraith: 0.9,
};

// Y3 — imp Pursuit lead. Imps anticipate the player's position by
// projecting along the player's recent velocity. Lead time scales
// with distance / chase speed so longer-range shots lead more.
export const IMP_LEAD_FACTOR = 0.35;

export type FsmTickInput = Readonly<{
	enemy: Enemy;
	player: Vec2;
	map: ObjexoomMap;
	ctx: CollisionContext;
	now: number;
	dt: number;
	allEnemies: readonly Enemy[];
	lastSeenAt: number;
	// Y3 — player's recent XZ velocity (units/sec). Imps lead the
	// target by projecting along this. Optional: defaults to zero so
	// existing callers (and tests) don't have to thread it.
	playerVelocity?: Vec2;
}>;

export type FsmTickOutput = Readonly<{
	nextState: EnemyFsmState;
	moveTarget: Vec2 | null; // null = don't move this tick
	fireBullet: boolean;
	gethelpFromIds: readonly number[]; // enemies that should also aggro
	lastSeenAt: number;
}>;

/**
 * One FSM step. Pure — no side effects. Callers apply the move target,
 * spawn bullets, propagate gethelp, and update the enemy's `fsmState` /
 * `lastSeenAt` based on the returned data.
 */
export function tickEnemyFsm(input: FsmTickInput): FsmTickOutput {
	const { enemy, player, map, ctx, now, allEnemies } = input;
	const dx = player.x - enemy.position.x;
	const dy = player.y - enemy.position.y;
	const dist = Math.hypot(dx, dy);
	const sees = hasLineOfSightAny(enemy.position, player, map, ctx);
	const lastSeenAt = sees ? now : input.lastSeenAt;

	const chaseSpeed =
		enemy.kind === "wraith"
			? CHASE_SPEED_WRAITH
			: enemy.kind === "imp"
				? CHASE_SPEED_IMP
				: CHASE_SPEED_SKELETON;

	// State 0 — patrol.
	if (enemy.fsmState === 0) {
		if (sees) {
			// First-acquire — propagate gethelp to anyone within radius.
			const helpIds = allEnemies
				.filter(
					(e) =>
						!e.dead &&
						e.id !== enemy.id &&
						e.fsmState === 0 &&
						Math.hypot(e.position.x - enemy.position.x, e.position.y - enemy.position.y) <
							GETHELP_RADIUS,
				)
				.map((e) => e.id);
			return {
				nextState: 1,
				moveTarget: null,
				fireBullet: false,
				gethelpFromIds: helpIds,
				lastSeenAt,
			};
		}
		// Y2 — per-kind wander. Mirrors yuka.WanderBehavior with kind-
		// specific radius + jitter so skeletons drift tight, imps moderate,
		// wraiths sweep wide. Bearing is jittered every frame by a
		// deterministic-ish offset (uses enemy.id as a seed so the same
		// enemy always jitters the same way across reruns).
		const jitterPerSec = WANDER_JITTER_RAD_PER_SEC[enemy.kind];
		const jitterPhase = Math.sin(now * 0.001 + enemy.id * 1.7);
		enemy.patrolBearing += jitterPhase * jitterPerSec * input.dt;
		const wanderTarget = yukaWanderTarget(
			enemy.position,
			enemy.patrolBearing,
			WANDER_RADIUS[enemy.kind],
		);
		return {
			nextState: 0,
			moveTarget: yukaStepToward(enemy.position, wanderTarget, PATROL_SPEED, input.dt),
			fireBullet: false,
			gethelpFromIds: [],
			lastSeenAt,
		};
	}

	// State 1 — chase.
	if (enemy.fsmState === 1) {
		if (!sees && now - lastSeenAt > LOS_LOST_MS) {
			return {
				nextState: 0,
				moveTarget: null,
				fireBullet: false,
				gethelpFromIds: [],
				lastSeenAt,
			};
		}
		// Can we shoot? wraiths + imps shoot; skeletons don't.
		const canShoot = enemy.kind !== "skeleton";
		if (canShoot && sees && dist <= SHOOT_RANGE && now - enemy.lastShotAt > SHOOT_COOLDOWN_MS) {
			return {
				nextState: 3,
				moveTarget: null,
				fireBullet: false,
				gethelpFromIds: [],
				lastSeenAt,
			};
		}
		// Y3 — chase step. Skeletons + wraiths Seek the player's current
		// position. Imps use Pursuit: project the player's recent velocity
		// forward by IMP_LEAD_FACTOR × (dist / chaseSpeed) seconds so the
		// imp anticipates where the player will be when it arrives.
		//
		// Y4 — ground-bound enemies (skeleton, imp) deflect around walls
		// via yukaAvoidObstacles. Wraiths skip it (they no-clip, per I3).
		// The Scene still applies the actual collision resolver after the
		// FSM returns.
		if (dist > 1e-3) {
			let chaseTarget = input.player;
			if (enemy.kind === "imp" && input.playerVelocity) {
				const leadTime = IMP_LEAD_FACTOR * (dist / chaseSpeed);
				chaseTarget = {
					x: input.player.x + input.playerVelocity.x * leadTime,
					y: input.player.y + input.playerVelocity.y * leadTime,
				};
			}
			if (enemy.kind !== "wraith") {
				chaseTarget = yukaAvoidObstacles(
					enemy.position,
					chaseTarget,
					chaseSpeed * input.dt * 6,
					(p) => {
						// Use the Scene's collision dispatcher as the obstacle
						// probe: if a resolved position drifts from `p` by more
						// than a small epsilon, something pushed us out (i.e.
						// `p` was inside a wall).
						const resolved = resolveCollisionAny(p, input.map, input.ctx, 0.4);
						return Math.abs(resolved.x - p.x) > 0.05 || Math.abs(resolved.y - p.y) > 0.05;
					},
				);
			}
			return {
				nextState: 1,
				moveTarget: yukaStepToward(enemy.position, chaseTarget, chaseSpeed, input.dt),
				fireBullet: false,
				gethelpFromIds: [],
				lastSeenAt,
			};
		}
		return {
			nextState: 1,
			moveTarget: null,
			fireBullet: false,
			gethelpFromIds: [],
			lastSeenAt,
		};
	}

	// State 3 — shoot once, then back to chase.
	return {
		nextState: 1,
		moveTarget: null,
		fireBullet: true,
		gethelpFromIds: [],
		lastSeenAt,
	};
}
