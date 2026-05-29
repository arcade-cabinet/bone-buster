/**
 * CR-H1eng — entity spawning from a map. Turns a map's `enemySpawns` /
 * `pickupSpawns` design data into live `Enemy` / `Pickup` instances, picks
 * the boss spawn, and resolves the per-enemy UV-hidden tag from the family
 * PRNG. Consumes map TYPES from `mapTypes.ts` and the forked RNG stream from
 * `rng.ts`.
 */

import { at } from "@engine/arrayAt";
import {
	BOSS_HP_MULTIPLIER,
	type BoneBusterMap,
	type Enemy,
	type EnemyKind,
	type EnemySpawn,
	type Pickup,
} from "@engine/mapTypes";
import { forkStream } from "@engine/rng";
import { CANONICAL_SEED_PHRASE } from "@engine/seedPhrase";
import { RATTLER_HP } from "@shared/constants";

function enemyBaseHp(kind: EnemyKind): number {
	switch (kind) {
		case "phaser":
			return Math.floor(RATTLER_HP * 0.7);
		case "bouncer":
			return Math.floor(RATTLER_HP * 1.5);
		case "bigfoot":
			// PF2 — between rattler (1.0×) and bighoss/heap-tier; tankier
			// brawler than the baseline melee, lighter than the heavy tier.
			return Math.floor(RATTLER_HP * 1.8);
		default:
			return RATTLER_HP;
	}
}

/**
 * E2 — pick which spawn becomes the boss. Returns the spawn-index
 * farthest from `map.playerSpawn` (the "final sector" per PRD §E2).
 * Returns -1 if there are no spawns. Deterministic given the map.
 */
export function pickBossSpawnIndex(map: BoneBusterMap): number {
	if (map.enemySpawns.length === 0) return -1;
	let bestIdx = 0;
	// Use -Infinity (not -1) so the comparison is independent of the loop
	// starting index — if a future refactor skips the first spawn for any
	// reason, the picker still works. Reviewer-caught issue from E2.
	let bestDistSq = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < map.enemySpawns.length; i += 1) {
		const spawn = at(map.enemySpawns, i);
		const dx = spawn.position.x - map.playerSpawn.x;
		const dy = spawn.position.y - map.playerSpawn.y;
		const d2 = dx * dx + dy * dy;
		if (d2 > bestDistSq) {
			bestDistSq = d2;
			bestIdx = i;
		}
	}
	return bestIdx;
}

/**
 * @param spawnsOverride — optional pre-remapped spawn list (E13 step-3
 * enemy mix). When absent, uses `map.enemySpawns` directly. Length and
 * order must match `map.enemySpawns` so bossIdx still aligns.
 */
export function spawnEnemies(map: BoneBusterMap, spawnsOverride?: readonly EnemySpawn[]): Enemy[] {
	// Enforce the documented contract: a reordered/short override would attach
	// the boss tier + uvHidden flags (both index-derived) to the WRONG spawns.
	// pickBossSpawnIndex reads map.enemySpawns, so the override must align 1:1.
	if (spawnsOverride && spawnsOverride.length !== map.enemySpawns.length) {
		throw new RangeError(
			`spawnEnemies: spawnsOverride length ${spawnsOverride.length} ≠ map.enemySpawns ${map.enemySpawns.length}`,
		);
	}
	const spawns = spawnsOverride ?? map.enemySpawns;
	const bossIdx = pickBossSpawnIndex(map);
	return spawns.map((spawn, i) => {
		const isBoss = i === bossIdx;
		const baseHp = enemyBaseHp(spawn.kind);
		const hp = isBoss ? baseHp * BOSS_HP_MULTIPLIER : baseHp;
		// Patrol bearings deterministic from spawn index — same seed → same
		// patrol pattern, which keeps headed e2e + screenshots reproducible.
		const bearing = (i * 1.732) % (Math.PI * 2);
		return {
			id: i,
			kind: spawn.kind,
			position: { ...spawn.position },
			hp,
			maxHp: hp,
			lastAttackAt: 0,
			dead: false,
			fsmState: 0 as const,
			patrolBearing: bearing,
			lastShotAt: 0,
			...(isBoss ? { tier: "boss" as const } : {}),
			// PC3 — UV-hidden tag, applied to ~1-in-8 non-boss enemies.
			// Deterministic per (seedPhrase, spawnIndex) so the same phrase
			// always hides the same enemies. Bosses never hide — the
			// goal-boss must remain visible without the UV reveal.
			uvHidden: isBoss ? false : pickUvHidden(map.seedPhrase, i),
		};
	});
}

// PC3 — ~12.5% of non-boss enemies hide. SEED2: forks the per-phrase ENMX
// stream and reads the spawnIndex-th draw, so the same phrase always hides
// the same enemies (replaces the old numeric mulberry32 + ENMX XOR). The
// CANONICAL_SEED_PHRASE short-circuit keeps the canonical screenshot baseline.
export function pickUvHidden(seedPhrase: string, spawnIndex: number): boolean {
	if (seedPhrase === CANONICAL_SEED_PHRASE) return false;
	const rng = forkStream(seedPhrase, "ENMX-UV");
	let draw = 0;
	for (let k = 0; k <= spawnIndex; k++) draw = rng();
	return draw < 0.125;
}

export function spawnPickups(map: BoneBusterMap): Pickup[] {
	return map.pickupSpawns.map((p, i) => ({
		id: i,
		kind: p.kind,
		position: { ...p.position },
		collected: false,
	}));
}
