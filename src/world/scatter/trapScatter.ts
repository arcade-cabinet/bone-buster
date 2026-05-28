/**
 * COV8 step-2 — trap scatter + sector-disarm state.
 *
 * Sparse per-sector trap placement (0-2 per sector, archetype-biased):
 *   - sewer + arena lean trap-heavy (max 2 per sector)
 *   - corridor + courtyard mid (0-1 per sector)
 *   - library light (rare — paper place, not a death trap)
 *
 * Each instance carries (id, sectorId, position, def, disarmed flag).
 * Trigger-kind traps (lever + base) are placed alongside hazard traps;
 * walking over a trigger flips `disarmed` for every trap in the same
 * sector (E6-style "switches disarm secrets" pattern, sector-scoped).
 *
 * Player-overlap damage is computed elsewhere (engine.ts → `tickTrapDamage`)
 * so this module stays pure data.
 *
 * PRNG seed: `map.seed XOR 0x54524150` ("TRAP" tag) — diverges from
 * every other scatter sequence.
 */

import type { BoneBusterMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { mulberry32, RNG_TAGS } from "@engine/prng";
import { pickArchetype } from "@world/archetype";
import type { PropArchetype } from "@world/scatter/propPool";
import { TRAPS, type TrapDef, type TrapKind } from "@world/traps";

const SKIP_RADIUS = 3;
const MIN_TRAP_SPACING = 2.0;
const MAX_SAMPLE_ATTEMPTS = 12;
const ID_STRIDE = 100;

export interface TrapInstance {
	readonly id: number;
	readonly sectorId: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly def: TrapDef;
	/**
	 * Mutable runtime state — once true, the trap stops applying damage
	 * (or stops being a player-trigger if it's a `trigger` kind).
	 */
	disarmed: boolean;
}

/** Archetype → [min, max] hazard-trap count per sector. */
const HAZARD_PER_SECTOR: Readonly<Record<PropArchetype, readonly [number, number]>> = {
	corridor: [0, 1],
	arena: [1, 2],
	courtyard: [0, 1],
	sewer: [1, 2],
	library: [0, 1],
};

/** Hazard kinds (the 3 that damage on overlap). Triggers are separate. */
const HAZARD_KINDS: readonly TrapKind[] = ["spike", "blade", "rolling"];

function bboxOf(verts: readonly Vec2[]): {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
} {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const v of verts) {
		if (v.x < minX) minX = v.x;
		if (v.x > maxX) maxX = v.x;
		if (v.y < minY) minY = v.y;
		if (v.y > maxY) maxY = v.y;
	}
	return { minX, maxX, minY, maxY };
}

function nearAny(point: Vec2, others: readonly Vec2[], radius: number): boolean {
	for (const o of others) {
		if (Math.hypot(o.x - point.x, o.y - point.y) < radius) return true;
	}
	return false;
}

function pickHazardOfKinds(kinds: readonly TrapKind[], rng: () => number): TrapDef {
	const candidates = TRAPS.filter((t) => kinds.includes(t.kind));
	if (candidates.length === 0)
		throw new Error("pickHazardOfKinds: no candidates for kinds " + kinds.join(","));
	// Math.floor(rng()*length) with rng ∈ [0,1) is provably in [0, length).
	const def = candidates[Math.floor(rng() * candidates.length)];
	if (def === undefined) throw new RangeError("pickHazardOfKinds: index out of bounds");
	return def;
}

function pickTrigger(rng: () => number): TrapDef {
	const candidates = TRAPS.filter((t) => t.kind === "trigger");
	if (candidates.length === 0) throw new Error("pickTrigger: no trigger candidates in TRAPS");
	// Math.floor(rng()*length) with rng ∈ [0,1) is provably in [0, length).
	const def = candidates[Math.floor(rng() * candidates.length)];
	if (def === undefined) throw new RangeError("pickTrigger: index out of bounds");
	return def;
}

/**
 * Deterministic per-map trap scatter. Same `map.seed` → byte-identical
 * placement. Returns mutable instances (disarmed flag mutates over the
 * level's lifetime).
 */
export function spawnTraps(map: BoneBusterMap): TrapInstance[] {
	if (map.kind !== "sectors") return [];
	const out: TrapInstance[] = [];
	const archetype = pickArchetype(map);
	const [hazardMin, hazardMax] = HAZARD_PER_SECTOR[archetype];
	const rng = mulberry32((map.seed >>> 0) ^ RNG_TAGS.TRAP);
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		const { minX, maxX, minY, maxY } = bboxOf(sector.vertices);
		const target = hazardMin + Math.floor(rng() * (hazardMax - hazardMin + 1));
		if (target === 0) continue;

		const placed: Vec2[] = [];
		for (let i = 0; i < target; i += 1) {
			let accepted: Vec2 | null = null;
			for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS; attempt += 1) {
				const candidate: Vec2 = {
					x: minX + rng() * (maxX - minX),
					y: minY + rng() * (maxY - minY),
				};
				if (!polygonContains(candidate, sector.vertices)) continue;
				if (nearAny(candidate, skipPoints, SKIP_RADIUS)) continue;
				if (nearAny(candidate, placed, MIN_TRAP_SPACING)) continue;
				accepted = candidate;
				break;
			}
			if (accepted === null) continue;
			placed.push(accepted);
			out.push({
				id: sector.id * ID_STRIDE + placed.length - 1,
				sectorId: sector.id,
				position: accepted,
				yaw: rng() * Math.PI * 2,
				def: pickHazardOfKinds(HAZARD_KINDS, rng),
				disarmed: false,
			});
		}

		// Place one lever per sector that contains hazards — gives the
		// player a way to disarm the sector. The lever sits at a separate
		// sampled point (sharing the same min-spacing constraint with the
		// hazards). If sampling fails the sector has no lever, which is
		// fine — some sectors are just dangerous.
		if (placed.length > 0) {
			let leverPos: Vec2 | null = null;
			for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS; attempt += 1) {
				const candidate: Vec2 = {
					x: minX + rng() * (maxX - minX),
					y: minY + rng() * (maxY - minY),
				};
				if (!polygonContains(candidate, sector.vertices)) continue;
				if (nearAny(candidate, skipPoints, SKIP_RADIUS)) continue;
				if (nearAny(candidate, placed, MIN_TRAP_SPACING)) continue;
				leverPos = candidate;
				break;
			}
			if (leverPos !== null) {
				placed.push(leverPos);
				out.push({
					id: sector.id * ID_STRIDE + placed.length - 1,
					sectorId: sector.id,
					position: leverPos,
					yaw: rng() * Math.PI * 2,
					def: pickTrigger(rng),
					disarmed: false,
				});
			}
		}
	}

	return out;
}

/**
 * PT1 — render-visibility predicate for an instanced trap mesh.
 *
 * Hazards (spikes / blade / rolling) disappear once disarmed (the
 * sector is now safe; the visual cue is the absence). Triggers
 * (pressure plates) stay visible after disarm so the player sees
 * the "I activated this" tell.
 *
 * Returned by `TrapField`'s instance filter; pinned by a unit test
 * so the runtime contract can't drift silently.
 */
export function isTrapVisible(trap: Pick<TrapInstance, "disarmed" | "def">): boolean {
	return !trap.disarmed || trap.def.kind === "trigger";
}

/**
 * Mark every trap in `sectorId` as disarmed. Called when the player
 * walks over a `trigger`-kind trap. Returns the count of newly-disarmed
 * traps for telemetry/sfx.
 */
export function disarmSector(traps: TrapInstance[], sectorId: number): number {
	let count = 0;
	for (const t of traps) {
		if (t.sectorId === sectorId && !t.disarmed) {
			t.disarmed = true;
			count += 1;
		}
	}
	return count;
}

/**
 * Find the first hazard trap whose center is within `radius` of `point`
 * AND is not disarmed. Used by the per-frame tick to apply damage. Returns
 * the trap (so the caller can tag it) or null.
 */
export function trapAt(
	traps: readonly TrapInstance[],
	point: Vec2,
	radius: number,
): TrapInstance | null {
	for (const t of traps) {
		if (t.disarmed) continue;
		if (t.def.kind === "trigger") continue;
		const d = Math.hypot(t.position.x - point.x, t.position.y - point.y);
		if (d < radius) return t;
	}
	return null;
}

/**
 * Find the first trigger trap whose center is within `radius` of `point`
 * AND has not been activated yet (disarmed flag doubles as "used"). Used
 * by the per-frame tick to disarm the sector on contact.
 */
export function triggerAt(
	traps: readonly TrapInstance[],
	point: Vec2,
	radius: number,
): TrapInstance | null {
	for (const t of traps) {
		if (t.disarmed) continue;
		if (t.def.kind !== "trigger") continue;
		const d = Math.hypot(t.position.x - point.x, t.position.y - point.y);
		if (d < radius) return t;
	}
	return null;
}

/** Tick damage per overlap pulse (HP). */
export const TRAP_TICK_DAMAGE = {
	spike: 5,
	blade: 7,
	rolling: 10,
} as const;

/** Min ms between successive tick-damage hits on the same trap. */
export const TRAP_TICK_COOLDOWN_MS = 500;

/** Player-trap overlap radius (world units). */
export const TRAP_OVERLAP_RADIUS = 0.7;

/** Player-trigger overlap radius (larger — easy to activate by walking). */
export const TRIGGER_OVERLAP_RADIUS = 1.0;
