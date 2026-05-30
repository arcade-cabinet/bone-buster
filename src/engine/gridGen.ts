/**
 * CR-H1eng — procedural grid-map generation. `generateMap(seedPhrase)` is
 * the single entry point; everything else here is a private construction
 * helper (room carving, corridor carving, BFS reachability). Consumes the
 * map TYPES from `mapTypes.ts`, the grid `inBounds` predicate from
 * `gridCollision.ts`, and the family PRNG from `rng.ts`.
 */

import { at } from "@engine/arrayAt";
import type {
	BoneBusterGridMap,
	EnemySpawn,
	GenerateMapShape,
	PickupKind,
	PickupSpawn,
	Vec2,
} from "@engine/mapTypes";
import { difficultyForDepth } from "@engine/maze/difficulty";
import { generateGridMaze } from "@engine/maze/MazeGenerator";
import { createMapPrng, cyrb128, forkStream } from "@engine/rng";
import { TILE } from "@shared/constants";
import type { PropArchetype } from "@world/scatter/propPool";

const cellCenter = (gx: number, gy: number): Vec2 => ({
	x: (gx + 0.5) * TILE,
	y: (gy + 0.5) * TILE,
});

const ARCHETYPE_NAMES_INLINE = [
	"corridor",
	"arena",
	"courtyard",
	"sewer",
	"library",
] as const satisfies readonly PropArchetype[];

/**
 * STRUCT1 (DEPTH+PHRASE identity, docs/specs/97) — options for `generateMap`.
 *
 * - `shape` — per-biome room-size/density override (was the bare 2nd arg).
 * - `depth` — biomes cleared so far. Geometry forks per depth so the same
 *   phrase yields a deterministic maze SEQUENCE down the descent. **Depth 0
 *   (the default) maps to the legacy `createMapPrng(phrase)` seed verbatim**,
 *   so the canonical screenshots + the generateMap byte-snapshot stay green;
 *   depths ≥1 fork via `forkStream(phrase, "MAZE-<depth>")`.
 * - `biome` — the pressure-picked biome whose character "wears" this geometry.
 *   When omitted, the archetype falls back to `cyrb128(phrase)[0] % 5` (the
 *   legacy phrase-derived archetype) so byte-identity holds for callers that
 *   don't thread a biome (the snapshot guard).
 */
export type GenerateMapOptions = Readonly<{
	shape?: GenerateMapShape;
	depth?: number;
	biome?: PropArchetype;
}>;

/**
 * The map PRNG for a given (phrase, depth). Depth 0 reuses the historical
 * `createMapPrng(phrase)` seed EXACTLY so depth-0 maps are byte-identical to
 * the pre-STRUCT1 generation (canonical baseline). Depth ≥1 forks a fresh,
 * deterministic per-depth stream off the same phrase.
 */
function mapPrngForDepth(seedPhrase: string, depth: number): () => number {
	return depth === 0 ? createMapPrng(seedPhrase) : forkStream(seedPhrase, `MAZE-${depth}`);
}

export function generateMap(
	seedPhrase: string,
	options: GenerateMapOptions = {},
): BoneBusterGridMap {
	const { shape, depth = 0, biome } = options;
	const rand = mapPrngForDepth(seedPhrase, depth);
	// STRUCT1 — topology comes from the representation-agnostic MazeGenerator
	// core. `rand` is threaded in so the draw order is continuous with the
	// content draws below (byte-identical to the pre-extraction inline code;
	// pinned by the generateMap byte-snapshot guard).
	const topo = generateGridMaze(rand, shape);
	const { cells, rooms, width, height, startGx, startGy, exit, doorCell, key, openReach } = topo;

	// Enemy spawns: room centers + room corners, distance-biased.
	const enemyCandidates: Vec2[] = [];
	for (let gy = 0; gy < height; gy += 1) {
		const openReachRow = at(openReach, gy);
		const cellRow = at(cells, gy);
		for (let gx = 0; gx < width; gx += 1) {
			if (!openReachRow[gx]) continue;
			if (cellRow[gx] !== "empty") continue;
			if (gx === startGx && gy === startGy) continue;
			const d = Math.abs(gx - startGx) + Math.abs(gy - startGy);
			if (d < 5) continue;
			enemyCandidates.push(cellCenter(gx, gy));
		}
	}
	for (let i = enemyCandidates.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		const ci = at(enemyCandidates, i);
		const cj = at(enemyCandidates, j);
		enemyCandidates[i] = cj;
		enemyCandidates[j] = ci;
	}
	// E13 step-10 — per-archetype enemy-count multiplier. SEED2: the
	// archetype index now derives from the seed phrase via
	// `cyrb128(phrase)[0] % 5` (replaces the old `seed % 5`). CONV3
	// denormalized `archetype` onto the map type; that field is set in the
	// return value below using this same idx, keeping the one-source-of-truth
	// invariant: CANONICAL_SEED_PHRASE → idx 0 → "corridor".
	const ARCHETYPE_ENEMY_MULTIPLIER = [1.0, 1.4, 0.9, 1.1, 0.8] as const;
	// STRUCT1 — the biome (pressure-picked, threaded from buildMap) owns the
	// archetype skin over this geometry. When no biome is supplied (the
	// snapshot guard + any phrase-only caller), fall back to the legacy
	// phrase-derived archetype so depth-0 byte-identity holds: CANONICAL phrase
	// → cyrb128[0] % 5 → idx 0 → "corridor".
	const archetypeIdx = biome ? ARCHETYPE_NAMES_INLINE.indexOf(biome) : cyrb128(seedPhrase)[0] % 5;
	const archetype = at(ARCHETYPE_NAMES_INLINE, archetypeIdx);
	const baseEnemyCount = Math.max(6, Math.floor(rooms.length * 1.2));
	// STRUCT3 — log-scaled depth difficulty. `difficultyForDepth(0) === 1` so the
	// depth-0 count (and the canonical byte-snapshot) is unchanged; deeper levels
	// scale the count + the cap up to ~3× before flattening.
	const depthMul = difficultyForDepth(depth);
	const totalEnemies = Math.min(
		Math.round(16 * depthMul),
		Math.max(
			4,
			Math.round(baseEnemyCount * at(ARCHETYPE_ENEMY_MULTIPLIER, archetypeIdx) * depthMul),
		),
	);
	// Base trio stand-in. Production paths remap through
	// `remapEnemyMix` (see app/views/Scene.tsx:141) before consuming
	// `enemySpawns`, but cycle all three base kinds so any caller that
	// reads the raw list (incl. tests + the bypass-remap pickup path)
	// sees the full base mechanic surface.
	const baseKinds = ["rattler", "phaser", "bouncer"] as const;
	const enemySpawns: EnemySpawn[] = enemyCandidates.slice(0, totalEnemies).map((position, idx) => ({
		kind: at(baseKinds, idx % baseKinds.length),
		position,
	}));

	// D2 (supersedes L2) — procedural pickup pool now includes
	// chaingunAmmo + shotgunAmmo + flamethrowerAmmo alongside health.
	// Three guarantees, applied in this order so the head of the pool
	// is deterministic per-seed (canonical-byte stability is irrelevant
	// here — the L2 pool was never canon-byte-locked):
	//
	//   1. Reserve N head slots for guaranteed-min weapon ammo:
	//        - slot 0 → chaingunAmmo (≥1 per map)
	//        - slot 1 → shotgunAmmo  (≥1 per map)
	//        - slot 2 → flamethrowerAmmo (only if seed%3==0)
	//   2. Apply per-archetype bias to slots beyond the reserved head:
	//        arena    → chaingunAmmo every 3rd
	//        courtyard→ shotgunAmmo every 3rd
	//        library  → flamethrowerAmmo every 4th
	//   3. Remaining slots fill with health.
	//
	// E13 step-11 — per-archetype pickup-count multiplier preserved.
	// Combat-heavy archetypes (arena, sewer) get more pickups,
	// cleaner ones (library) less.
	const ARCHETYPE_PICKUP_MULTIPLIER = [1.0, 1.3, 1.0, 1.2, 0.7] as const;
	const pickupCandidates = enemyCandidates.slice(totalEnemies);
	const basePickupCount = Math.min(8, pickupCandidates.length);
	const pickupTotal = Math.min(
		pickupCandidates.length,
		Math.max(4, Math.round(basePickupCount * at(ARCHETYPE_PICKUP_MULTIPLIER, archetypeIdx))),
	);
	// SEED2 — tool-spawn cadence derives from a phrase-stable numeric
	// (cyrb128 word [1], independent of the archetype's word [0]) replacing
	// the old `seed % N`.
	const seedNum = cyrb128(seedPhrase)[1] >>> 0;
	const wantsFlame = seedNum % 3 === 0;
	// PB5 step-2 — EMF reader spawns on every 4th seed (seed%4==0). One
	// per map. Ownership resets on level transition — Shell.tsx
	// re-initializes hasEmfReader: false alongside hasFlashlight at
	// every new map / new run / respawn site, so the player re-acquires
	// the reader on each EMF-eligible level. Keeping the cadence sparse
	// so the tool reads as a discovery beat rather than a guaranteed
	// every-map find.
	const wantsEmf = seedNum % 4 === 0;
	// PC2 — Spirit box spawns on every 5th seed (offset from EMF's %4
	// so the two tools don't co-spawn on every shared multiple). Same
	// per-level ownership semantics as EMF.
	const wantsSpiritBox = seedNum % 5 === 0;
	// PC3 — UV flashlight spawns on every 6th seed (offset from EMF
	// and spirit box). Per-level ownership reset.
	const wantsUv = seedNum % 6 === 0;
	// PC4 — Crucifix spawns on every 7th seed. Inventory counter
	// resets per level alongside the other tool flags; the player
	// re-builds a small crucifix stockpile on each eligible map.
	const wantsCrucifix = seedNum % 7 === 0;
	const reserved: PickupKind[] = ["chaingunAmmo", "shotgunAmmo"];
	if (wantsFlame) reserved.push("flamethrowerAmmo");
	if (wantsEmf) reserved.push("emfReader");
	if (wantsSpiritBox) reserved.push("spiritBox");
	if (wantsUv) reserved.push("uvFlashlight");
	if (wantsCrucifix) reserved.push("crucifix");
	const pickupSpawns: PickupSpawn[] = pickupCandidates
		.slice(0, pickupTotal)
		.map((position, idx) => {
			if (idx < reserved.length) return { kind: at(reserved, idx), position };
			const tailIdx = idx - reserved.length;
			// Per-archetype bias on the tail. The cadence values (every 3rd
			// for arena/courtyard, every 4th for library) were picked so
			// the average over 10 seeds exceeds 2.0 (arena/courtyard) and
			// 1.0 (library) — pinned by the D2 archetype-bias tests.
			if (archetypeIdx === 1 && tailIdx % 3 === 0) {
				return { kind: "chaingunAmmo", position };
			}
			if (archetypeIdx === 2 && tailIdx % 3 === 0) {
				return { kind: "shotgunAmmo", position };
			}
			if (archetypeIdx === 4 && tailIdx % 4 === 0) {
				return { kind: "flamethrowerAmmo", position };
			}
			return { kind: "health", position };
		});

	at(cells, startGy)[startGx] = "spawn";

	return {
		kind: "grid",
		seedPhrase,
		archetype,
		width,
		height,
		cells,
		playerSpawn: cellCenter(startGx, startGy),
		playerYaw: rand() * Math.PI * 2,
		enemySpawns,
		pickupSpawns,
		keyPosition: cellCenter(key.gx, key.gy),
		exitPosition: cellCenter(exit.gx, exit.gy),
		doorCell,
		rooms,
	};
}
