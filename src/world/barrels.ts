/**
 * E5 — Destructible barrels with AoE damage.
 *
 * Pure-sim module. Barrels live in their own registry, separate from
 * Enemy / Pickup, because their interaction model is different:
 *
 *  - They take damage from any weapon hit; the caller's fire-path
 *    runs `pickRayBarrel` alongside its enemy hit-test.
 *  - On HP ≤ 0, they explode and deal AoE damage to every Enemy + the
 *    player + any other barrel within `BARREL_AOE_RADIUS` tiles.
 *  - Chain reactions are handled by the caller pushing newly-exploded
 *    barrels onto a queue; this module just tells you who got hit.
 *
 * Why a separate type rather than reusing Enemy:
 *  - Barrels don't have FSM state, last-attack timers, or a kind tier.
 *  - Enemies pursue/aim at the player; barrels are dumb props.
 *  - The death event for an Enemy spawns body-parts + a kill counter
 *    increment; a barrel death spawns a much larger burst + AoE.
 *  - Keeping the types separate prevents subtle bugs where a barrel
 *    accidentally counts as a kill or vice versa.
 */

import type { BoneBusterMap, Vec2 } from "@engine/mapTypes";
import { forkStream } from "@engine/rng";

/** Default barrel HP. Tuned so a pistol shot doesn't pop a barrel on
 * the first hit (you need to actually aim at it), but the shotgun
 * pellet pattern reliably destroys one in a single trigger pull. */
export const BARREL_HP = 3;

/** Default AoE radius in tile-units. 2.5 tiles ≈ one room width on the
 * compact procedural maps; a barrel blown in a doorway clears the room
 * on the other side. */
export const BARREL_AOE_RADIUS = 2.5;

/** Default damage per AoE hit. Enemies take this; the player takes a
 * smaller fraction so a chained explosion doesn't insta-kill them. */
export const BARREL_AOE_DAMAGE = 35;

/** Player damage scaling — barrels caught the player too, but the
 * player has a 9-HP pool while enemies have ~50-100, so a flat 35 dmg
 * would feel like a one-shot kill. Scale to ~3 player HP per barrel. */
export const BARREL_PLAYER_AOE_DAMAGE = 3;

/** Visible radius (slightly larger than collision radius) so the
 * hitscan ray treats the barrel like a 0.4-tile cylinder. */
export const BARREL_HIT_RADIUS = 0.5;

export type Barrel = {
	id: number;
	position: Vec2;
	hp: number;
	exploded: boolean;
};

/**
 * Spawn barrels for the given map. Strategy is deliberately simple
 * here so the spawn rule can be re-tuned independently of E3 (sector
 * scatter), which will eventually take over barrel placement: ~3
 * barrels per level seeded by `map.seed`, placed at a deterministic
 * subset of pickup-spawn positions offset by a small jitter so they
 * don't sit directly on a key/health pickup.
 */
export function spawnBarrels(map: BoneBusterMap): Barrel[] {
	if (map.pickupSpawns.length === 0) return [];
	const out: Barrel[] = [];
	const rng = forkStream(map.seedPhrase, "BARL");
	const targetCount = Math.min(3, Math.floor(map.pickupSpawns.length / 2));
	const indexPool = [...map.pickupSpawns.keys()];
	// Fisher-Yates with seeded rng, then take the first `targetCount`.
	for (let i = indexPool.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		// i and j are both provably in [0, indexPool.length) by the loop
		// bounds and the floor(rng()*(i+1)) formula (rng ∈ [0,1)).
		const vi = indexPool[i];
		const vj = indexPool[j];
		if (vi === undefined || vj === undefined)
			throw new RangeError(`spawnBarrels: Fisher-Yates indices out of bounds (i=${i}, j=${j})`);
		indexPool[i] = vj;
		indexPool[j] = vi;
	}
	for (let i = 0; i < targetCount; i += 1) {
		// i < targetCount <= indexPool.length, and each indexPool[i] was a
		// valid index into map.pickupSpawns — provably in-bounds.
		const poolIdx = indexPool[i];
		if (poolIdx === undefined) throw new RangeError(`spawnBarrels: indexPool[${i}] missing`);
		const spawn = map.pickupSpawns[poolIdx];
		if (spawn === undefined) throw new RangeError(`spawnBarrels: pickupSpawns[${poolIdx}] missing`);
		const base = spawn.position;
		const dx = (rng() - 0.5) * 1.4;
		const dy = (rng() - 0.5) * 1.4;
		out.push({
			id: i,
			position: { x: base.x + dx, y: base.y + dy },
			hp: BARREL_HP,
			exploded: false,
		});
	}
	return out;
}

/**
 * Result of one barrel explosion. The caller iterates this list:
 *  - applies `enemyDamage` to each enemy in `affectedEnemyIds`
 *  - applies `playerDamage` to the player if `hitsPlayer`
 *  - pushes each barrel in `chainBarrelIds` onto its own explosion
 *    queue (which calls back into `resolveExplosion`)
 *
 * The reason this returns IDs rather than mutating directly is so the
 * unit tests can pin the algorithm without needing a real Enemy[]
 * registry, and so the caller can decide whether to dispatch a single
 * particle burst per explosion or batch them.
 */
export type ExplosionResult = Readonly<{
	affectedEnemyIds: ReadonlyArray<number>;
	chainBarrelIds: ReadonlyArray<number>;
	hitsPlayer: boolean;
	enemyDamage: number;
	playerDamage: number;
	position: Vec2;
}>;

/** Compute who's caught in a barrel's AoE. `playerPos` is the camera
 * XZ projected to the sim's Y axis (which is what the rest of the
 * engine uses for distance math). The exploding barrel is excluded
 * from `chainBarrelIds` by `id` (it can't trigger itself). */
export function resolveExplosion(
	barrel: Barrel,
	enemies: ReadonlyArray<{ id: number; position: Vec2; dead: boolean }>,
	otherBarrels: ReadonlyArray<Barrel>,
	playerPos: Vec2,
): ExplosionResult {
	const affectedEnemyIds: number[] = [];
	for (const e of enemies) {
		if (e.dead) continue;
		if (distSq(e.position, barrel.position) <= BARREL_AOE_RADIUS * BARREL_AOE_RADIUS) {
			affectedEnemyIds.push(e.id);
		}
	}
	const chainBarrelIds: number[] = [];
	for (const b of otherBarrels) {
		if (b.id === barrel.id) continue;
		if (b.exploded) continue;
		if (distSq(b.position, barrel.position) <= BARREL_AOE_RADIUS * BARREL_AOE_RADIUS) {
			chainBarrelIds.push(b.id);
		}
	}
	const hitsPlayer = distSq(playerPos, barrel.position) <= BARREL_AOE_RADIUS * BARREL_AOE_RADIUS;
	return {
		affectedEnemyIds,
		chainBarrelIds,
		hitsPlayer,
		enemyDamage: BARREL_AOE_DAMAGE,
		playerDamage: BARREL_PLAYER_AOE_DAMAGE,
		position: barrel.position,
	};
}

/** Ray-vs-barrel hit-test. Mirrors the enemy hit-test in
 * `BoneBusterScene.onFire`: project the barrel onto the ray, accept if
 * the perpendicular distance is within `BARREL_HIT_RADIUS`. Returns
 * the closest hit barrel + its forward distance, or `null` if no
 * barrel is hit within `maxDist`.
 *
 * `dir` MAY be passed in unnormalized — we normalize here defensively
 * so the forward-distance and perpendicular checks remain in tile
 * units regardless of caller convention. A zero-length `dir` returns
 * `null` (no ray to project against). */
export function pickRayBarrel(
	origin: Vec2,
	dir: Vec2,
	barrels: ReadonlyArray<Barrel>,
	maxDist: number,
): { barrel: Barrel; dist: number } | null {
	const len = Math.hypot(dir.x, dir.y);
	if (len === 0) return null;
	const nx = dir.x / len;
	const ny = dir.y / len;
	let best: { barrel: Barrel; dist: number } | null = null;
	for (const b of barrels) {
		if (b.exploded) continue;
		const ex = b.position.x - origin.x;
		const ey = b.position.y - origin.y;
		const t = ex * nx + ey * ny;
		if (t <= 0 || t > maxDist) continue;
		if (best && t > best.dist) continue;
		const perpX = ex - nx * t;
		const perpY = ey - ny * t;
		if (Math.hypot(perpX, perpY) > BARREL_HIT_RADIUS) continue;
		best = { barrel: b, dist: t };
	}
	return best;
}

function distSq(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}
