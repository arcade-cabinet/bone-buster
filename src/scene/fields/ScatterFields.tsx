/**
 * CR-H1scene — the presentational scatter-field cluster, lifted verbatim out
 * of `BoneBusterScene`'s JSX. Every child here is a pure render of a spawned
 * instance list owned by a ref in the parent; none of them tick or own state
 * beyond their own instanced-mesh bookkeeping. Grouping them keeps the Scene
 * component's return focused on the entity + lighting + effect layers.
 *
 * Refs are passed as `.current` arrays (stable identity per Scene instance) so
 * this wrapper re-renders only when the parent does; the fields read their
 * instances at render time exactly as before the extraction.
 */

import type { LampInstance } from "@world/lampScatter";
import type { DebrisInstance } from "@world/scatter/debrisScatter";
import type { DecalInstance } from "@world/scatter/decalScatter";
import type { FloorTileInstance } from "@world/scatter/floorTiles";
import type { KitchenInstance } from "@world/scatter/kitchenScatter";
import type { LargePropInstance } from "@world/scatter/largePropScatter";
import type { NatureInstance } from "@world/scatter/natureScatter";
import type { NpcInstance } from "@world/scatter/npcScatter";
import type { PropInstance } from "@world/scatter/propScatter";
import type { TrapInstance } from "@world/scatter/trapScatter";
import type { Secret } from "@world/secrets";
import type { RefObject } from "react";
import {
	DebrisField,
	DecalField,
	FloorTileField,
	KitchenField,
	LampField,
	LargePropField,
	NatureField,
	NpcField,
	PropField,
	SecretField,
	TrapField,
	VehicleWreck,
} from "../index";

export type ScatterFieldsProps = Readonly<{
	secretsRef: RefObject<Secret[]>;
	lamps: readonly LampInstance[];
	lampLightColor: string;
	props: readonly PropInstance[];
	largeProps: readonly LargePropInstance[];
	traps: readonly TrapInstance[];
	trapsDisarmedVersion: number;
	kitchen: readonly KitchenInstance[];
	nature: readonly NatureInstance[];
	npcs: readonly NpcInstance[];
	floorTiles: readonly FloorTileInstance[];
	debris: readonly DebrisInstance[];
	decals: readonly DecalInstance[];
	/** COV10 — RV wreck position at the courtyard farthest-sector centroid; null on non-courtyard maps. */
	wreckPosition: { x: number; y: number } | null;
	mapSeedNum: number;
}>;

export function ScatterFields({
	secretsRef,
	lamps,
	lampLightColor,
	props,
	largeProps,
	traps,
	trapsDisarmedVersion,
	kitchen,
	nature,
	npcs,
	floorTiles,
	debris,
	decals,
	wreckPosition,
	mapSeedNum,
}: ScatterFieldsProps) {
	return (
		<>
			{/* E6 — secret switches + their hidden walls. Empty when the
			    current map has no `secrets` field (grid maps + future
			    secret-free ref levels). */}
			<SecretField secretsRef={secretsRef} />

			{/* COV1 — PSX Mega Pack II lamp scatter. Empty on grid maps
			    in this slice. E4 will flip a subset to `on` + wire
			    scoped pointLights. */}
			<LampField lamps={lamps} lightColor={lampLightColor} />

			{/* COV4 + E3 — decorative prop scatter from PSX Mega Pack II
			    Props pool. Step-1: "corridor" archetype default for
			    every sector; E13 will pick archetypes per mapSeedNum. */}
			<PropField props={props} />

			{/* COV2 step-2 — anchor-piece large-prop scatter (1-2 per
			    sector). Blocking entries (machinery, shipping container)
			    push the player out via the collision blocker list. */}
			<LargePropField props={largeProps} />

			{/* COV8 step-2 — trap scatter (0-2 hazards + 1 trigger per
			    sector, archetype-biased). Tick damage + lever-disarm
			    flow lives in the per-frame loop in BoneBusterScene. */}
			<TrapField traps={traps} disarmedVersion={trapsDisarmedVersion} />

			{/* COV13 step-2 — library-archetype kitchen scatter.
			    Empty on non-library archetypes. */}
			<KitchenField props={kitchen} />

			{/* COV11 step-2 — courtyard-archetype nature scatter.
			    Empty on non-courtyard archetypes. */}
			<NatureField instances={nature} />

			{/* COV14 step-2 — library-archetype ambient NPCs. Pure
			    set-dressing; no AI/LOS/damage tracks. */}
			<NpcField instances={npcs} />

			{/* COV3 step-1 — modular asphalt floor tiles. Empty unless
			    the map opts in via `useModularFloor: true`. */}
			<FloorTileField tiles={floorTiles} />

			{/* COV5 step-2 — sector-body debris scatter (3-5 per sector,
			    skip-radius 4 from spawn/exit/key). Reads as "overrun." */}
			<DebrisField debris={debris} />

			{/* COV6 step-2.1 — wall-face decals as billboard quads with
			    the GLB's primary texture extracted onto a 1.2×0.8 plane
			    aligned to the sector edge normal. */}
			<DecalField decals={decals} />

			{/* COV10 step-2 — one RV wreck at the courtyard archetype's
			    farthest-sector centroid. Null on non-courtyard maps. */}
			{wreckPosition && <VehicleWreck position={wreckPosition} seed={mapSeedNum} />}
		</>
	);
}
