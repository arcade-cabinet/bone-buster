/**
 * A6 — central registry of every per-archetype axis. CONV3 denormalized
 * `map.archetype` onto the map type; this file enumerates EVERY axis
 * keyed by `PropArchetype` so adding a 6th archetype has a single
 * audit-trail checklist instead of N independent grep targets.
 *
 * ARCHITECTURE audit §2.4 named the gap: 10+ `Record<PropArchetype,T>`
 * literals exist across the codebase, each compiled independently with
 * no cross-axis registry. The registry below documents — but does NOT
 * collapse — them. The collapse (single `ARCHETYPES[name]` mega-table)
 * is deferred until cross-axis coupling actually develops; preserving
 * the per-axis files keeps canonical-byte-stability proofs co-located
 * with the data each axis is responsible for.
 *
 * When adding a 6th archetype:
 * 1. Walk this registry top-to-bottom.
 * 2. Add the new key to EVERY axis. TypeScript will yell if you miss
 *    one (every record uses `Record<PropArchetype, T>`).
 * 3. Verify canonical-byte-stability — corridor seed-0 screenshots
 *    MUST still match after the change. The PASS_THROUGH / literal-
 *    preservation pattern (see DESIGN.md §"Archetype identity") means
 *    corridor is locked; new archetypes can take any shape.
 */

import type { PropArchetype } from "@world/scatter/propPool";

/**
 * One entry per known archetype axis. `axisName` is the conceptual
 * name; `module` is the file that owns the axis; `record` is the
 * exported `Record<PropArchetype, T>` literal (or sentinel-bearing
 * `Record`) the runtime reads.
 *
 * The list is REGISTRY-AS-SOURCE-OF-TRUTH — adding an axis means
 * adding an entry here too. The build step doesn't enforce this
 * (each consumer module imports its own typed record); the entry
 * here is the "this exists" claim.
 */
export type ArchetypeAxis = Readonly<{
	axisName: string;
	module: string;
	axisDescription: string;
}>;

export const ARCHETYPE_AXES: readonly ArchetypeAxis[] = [
	{
		axisName: "map shape",
		module: "src/world/archetypeMapShape.ts",
		axisDescription:
			"Sector density + size range per archetype — drives generateMap's pre-build shape.",
	},
	{
		axisName: "lighting palette",
		module: "src/scene/lighting/archetypePalette.ts",
		axisDescription: "Ambient color + directional sun + per-archetype gibFadeMs + flicker config.",
	},
	{
		axisName: "structures (wall pool)",
		module: "src/world/structures.ts",
		axisDescription: "WALLS_BY_ARCHETYPE — modular wall GLB pool used by SectorMapGeometry.",
	},
	{
		axisName: "enemy mix",
		module: "src/ai/enemyMix.ts",
		axisDescription:
			"BASE_MIX_WEIGHTS + WRAITH_BIAS (POL42) — per-archetype skeleton/wraith/imp distribution.",
	},
	{
		axisName: "prop pool",
		module: "src/world/scatter/propPool.ts",
		axisDescription: "POOLS — per-archetype prop GLB catalog consumed by propScatter.",
	},
	{
		axisName: "prop density",
		module: "src/world/scatter/propScatter.ts",
		axisDescription: "DENSITY_BY_ARCHETYPE — [min, max] props/sector per archetype.",
	},
	{
		axisName: "decal scatter density",
		module: "src/world/scatter/decalScatter.ts",
		axisDescription: "Density multiplier per archetype for floor decals.",
	},
	{
		axisName: "decals variant pool",
		module: "src/world/decals.ts",
		axisDescription: "DECALS_BY_ARCHETYPE — decal-URL pool per archetype.",
	},
	{
		axisName: "floor textures",
		module: "src/world/floorTextures.ts",
		axisDescription:
			"FLOOR_TEXTURES — PBR texture set per archetype (partial — corridor falls through to default).",
	},
	{
		axisName: "debris scatter density",
		module: "src/world/scatter/debrisScatter.ts",
		axisDescription: "[min, max] debris instances/sector per archetype.",
	},
	{
		axisName: "large-prop scatter density",
		module: "src/world/scatter/largePropScatter.ts",
		axisDescription: "[min, max] large props/sector per archetype.",
	},
	{
		axisName: "trap scatter density",
		module: "src/world/scatter/trapScatter.ts",
		axisDescription: "[min, max] traps/sector per archetype.",
	},
	{
		axisName: "kitchen scatter gate",
		module: "src/world/scatter/kitchenScatter.ts",
		axisDescription:
			"Library-only opt-in (other archetypes return []); KITCHEN_SECTOR_PROBABILITY constant.",
	},
	{
		axisName: "nature scatter gate",
		module: "src/world/scatter/natureScatter.ts",
		axisDescription: "Courtyard-only opt-in; [min, max] mega-pack natures/sector.",
	},
	{
		axisName: "npc scatter gate",
		module: "src/world/scatter/npcScatter.ts",
		axisDescription: "Library-only opt-in; [min, max] static NPCs/sector.",
	},
	{
		axisName: "ambient audio",
		module: "src/audio/sfx.ts",
		axisDescription:
			"Ambient pitch + volume per archetype (search for the ambient table near line 516).",
	},
	{
		axisName: "enemy-count multiplier",
		module: "src/engine/engine.ts",
		axisDescription:
			"ARCHETYPE_ENEMY_MULTIPLIER inside generateMap — scales total enemy count per archetype.",
	},
];

/**
 * Quick lookup of the axis-module map. Useful for tooling that wants
 * to flag undocumented per-archetype records that DON'T appear here.
 */
export function getAxisModules(): readonly string[] {
	return ARCHETYPE_AXES.map((a) => a.module);
}

/**
 * Type-safety helper. Any record keyed by PropArchetype satisfies this
 * shape — useful for new axes to opt into the registry-style typing.
 */
export type ArchetypeKeyedRecord<T> = Readonly<Record<PropArchetype, T>>;
