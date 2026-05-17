/**
 * COV4 — PSX Mega Pack II Props scatter pool.
 *
 * Stages the asset-enabler for E3 (decorative sector prop scatter).
 * 30 GLBs from the PSX Mega Pack II Props pack, sorted into the five
 * `docs/PRD.md §E13` archetypes (corridor / arena / courtyard / sewer
 * / library). Each prop carries `id`, BASE_URL-resolved `url`, and a
 * `blocking` flag (collision opt-in, default flat). Buckets overlap
 * intentionally — a metal barrel reads correctly in corridor, sewer,
 * and courtyard contexts.
 */

import { A } from "@assets/assetUrl";

export type PropArchetype = "corridor" | "arena" | "courtyard" | "sewer" | "library";

export interface PropDef {
	/** Stable identifier for E3's deterministic seeded picks. */
	readonly id: string;
	/** BASE_URL-resolved GLB url. */
	readonly url: string;
	/** When true, E3 should register a collider; default-flat scatter walks through. */
	readonly blocking: boolean;
}

/**
 * Master catalogue. Every prop appears here once with an inline static
 * URL (NOT template-literal interpolated) so `scripts/verify-runtime-
 * assets.mjs` can statically extract every `A("/assets/...")` literal
 * without having to evaluate JS at scan time. Buckets reference these
 * entries by identity (NOT by string lookup) so a typo in a bucket
 * fails at compile time.
 *
 * The `blocking` flag opts a prop into E3's collision system; defaults
 * to false (the player walks through it). Large props that read as
 * impassable (barrels, crates, benches, shelves, ladders, mailboxes,
 * gas cylinders, concrete blocks) are marked blocking.
 */
export const PROP_CATALOGUE = {
	bucket1: {
		id: "bucket_mx_1",
		url: A("/assets/models/props/scatter/bucket_mx_1.glb"),
		blocking: false,
	},
	bucket2: {
		id: "bucket_mx_2",
		url: A("/assets/models/props/scatter/bucket_mx_2.glb"),
		blocking: false,
	},
	cardboardBox1: {
		id: "cardboard_box_1",
		url: A("/assets/models/props/scatter/cardboard_box_1.glb"),
		blocking: false,
	},
	cardboardBox2: {
		id: "cardboard_box_2",
		url: A("/assets/models/props/scatter/cardboard_box_2.glb"),
		blocking: false,
	},
	cementBag: {
		id: "cement_bag_mp_1",
		url: A("/assets/models/props/scatter/cement_bag_mp_1.glb"),
		blocking: false,
	},
	concreteBlock: {
		id: "concrete_block_mx_1",
		url: A("/assets/models/props/scatter/concrete_block_mx_1.glb"),
		blocking: true,
	},
	gasCylinder: {
		id: "gas_cylinder_mx_1",
		url: A("/assets/models/props/scatter/gas_cylinder_mx_1.glb"),
		blocking: true,
	},
	gear1: { id: "gear_mx_1", url: A("/assets/models/props/scatter/gear_mx_1.glb"), blocking: false },
	gear3: { id: "gear_mx_3", url: A("/assets/models/props/scatter/gear_mx_3.glb"), blocking: false },
	jerrycan: {
		id: "jerrycan_mx_1",
		url: A("/assets/models/props/scatter/jerrycan_mx_1.glb"),
		blocking: false,
	},
	metalBarrel1: {
		id: "metal_barrel_hr_1",
		url: A("/assets/models/props/scatter/metal_barrel_hr_1.glb"),
		blocking: true,
	},
	metalBarrel2: {
		id: "metal_barrel_hr_2",
		url: A("/assets/models/props/scatter/metal_barrel_hr_2.glb"),
		blocking: true,
	},
	paintCan: {
		id: "paint_can_mx_1",
		url: A("/assets/models/props/scatter/paint_can_mx_1.glb"),
		blocking: false,
	},
	pipe1: { id: "pipe_mx_1", url: A("/assets/models/props/scatter/pipe_mx_1.glb"), blocking: false },
	pipe2: { id: "pipe_mx_2", url: A("/assets/models/props/scatter/pipe_mx_2.glb"), blocking: false },
	scrapMetal: {
		id: "scrap_metal_mx_1",
		url: A("/assets/models/props/scatter/scrap_metal_mx_1.glb"),
		blocking: false,
	},
	toolbox: {
		id: "toolbox_mx_1",
		url: A("/assets/models/props/scatter/toolbox_mx_1.glb"),
		blocking: false,
	},
	woodCrate1: {
		id: "wooden_crate_1",
		url: A("/assets/models/props/scatter/wooden_crate_1.glb"),
		blocking: true,
	},
	woodCrate2: {
		id: "wooden_crate_2_a",
		url: A("/assets/models/props/scatter/wooden_crate_2_a.glb"),
		blocking: true,
	},
	woodPlank1: {
		id: "wooden_plank_1",
		url: A("/assets/models/props/scatter/wooden_plank_1.glb"),
		blocking: false,
	},
	woodPlank2: {
		id: "wooden_plank_2",
		url: A("/assets/models/props/scatter/wooden_plank_2.glb"),
		blocking: false,
	},
	tire: { id: "tire_1", url: A("/assets/models/props/scatter/tire_1.glb"), blocking: false },
	ladder: {
		id: "ladder_hr_1_short",
		url: A("/assets/models/props/scatter/ladder_hr_1_short.glb"),
		blocking: true,
	},
	mailbox: {
		id: "mail_box_mx_1",
		url: A("/assets/models/props/scatter/mail_box_mx_1.glb"),
		blocking: true,
	},
	bench: {
		id: "bench_mx_1",
		url: A("/assets/models/props/scatter/bench_mx_1.glb"),
		blocking: true,
	},
	stool: {
		id: "stool_mx_1",
		url: A("/assets/models/props/scatter/stool_mx_1.glb"),
		blocking: false,
	},
	shelf: {
		id: "shelf_mx_1",
		url: A("/assets/models/props/scatter/shelf_mx_1.glb"),
		blocking: true,
	},
	glassBottle: {
		id: "glass_bottle_mx_1",
		url: A("/assets/models/props/scatter/glass_bottle_mx_1.glb"),
		blocking: false,
	},
	firstAidKit: {
		id: "first_aid_kit_hr_1",
		url: A("/assets/models/props/scatter/first_aid_kit_hr_1.glb"),
		blocking: false,
	},
	sawBlade: {
		id: "saw_blade_1",
		url: A("/assets/models/props/scatter/saw_blade_1.glb"),
		blocking: false,
	},
	// PE1 — Mansion_PSX scatter additions for the library archetype.
	// Standalone-readable items only (columns, windows, door frames,
	// short wall sections). The full Mansion pack (big walls, roofs,
	// moldings) is structural assembly and doesn't fit the per-prop
	// scatter pool — wiring those would need a separate archetype-
	// structural slice.
	mansionColumn: {
		id: "mansion_column",
		url: A("/assets/models/props/scatter/library/mansion_column.glb"),
		blocking: true,
	},
	mansionWindow: {
		id: "mansion_window",
		url: A("/assets/models/props/scatter/library/mansion_window.glb"),
		blocking: false,
	},
	mansionDoorFrame: {
		id: "mansion_door_frame",
		url: A("/assets/models/props/scatter/library/mansion_door_frame.glb"),
		blocking: true,
	},
	mansionSmallWall: {
		id: "mansion_small_wall",
		url: A("/assets/models/props/scatter/library/mansion_small_wall.glb"),
		blocking: true,
	},
	// PE2 — PSX-Farm Assets scatter additions for the courtyard
	// archetype. Subset chosen for standalone readability in the
	// existing per-prop scatter pool (apples / haybales / barrel /
	// basket / fences / carrots / birdhouse). Blocking flags follow
	// the silhouette: fences + barrels block, small items don't.
	farmApple: {
		id: "farm_apple",
		url: A("/assets/models/props/scatter/courtyard/farm_apple.glb"),
		blocking: false,
	},
	farmCarrot: {
		id: "farm_carrot",
		url: A("/assets/models/props/scatter/courtyard/farm_carrot.glb"),
		blocking: false,
	},
	farmHaybale1: {
		id: "farm_haybale_1",
		url: A("/assets/models/props/scatter/courtyard/farm_haybale_1.glb"),
		blocking: true,
	},
	farmHaybale2: {
		id: "farm_haybale_2",
		url: A("/assets/models/props/scatter/courtyard/farm_haybale_2.glb"),
		blocking: true,
	},
	farmBarrel: {
		id: "farm_barrel",
		url: A("/assets/models/props/scatter/courtyard/farm_barrel.glb"),
		blocking: true,
	},
	farmBasket: {
		id: "farm_basket",
		url: A("/assets/models/props/scatter/courtyard/farm_basket.glb"),
		blocking: false,
	},
	farmFenceShort: {
		id: "farm_fence_short",
		url: A("/assets/models/props/scatter/courtyard/farm_fence_short.glb"),
		blocking: true,
	},
	farmFenceMedium: {
		id: "farm_fence_medium",
		url: A("/assets/models/props/scatter/courtyard/farm_fence_medium.glb"),
		blocking: true,
	},
	farmBirdhouse: {
		id: "farm_birdhouse",
		url: A("/assets/models/props/scatter/courtyard/farm_birdhouse.glb"),
		blocking: false,
	},
} as const satisfies Record<string, PropDef>;

/**
 * Per-archetype scatter pools. E3 reads `POOLS[archetype]` to get the
 * list of valid props for that sector type and runs rejection-sampled
 * placement seeded by `(sectorId * map.seed)` per PRD §E3 acceptance.
 *
 * Each bucket is ≥10 entries — the COV4 acceptance criterion. Overlap
 * between buckets is intentional and matches a real warehouse-vs-
 * sewer overlap (a metal barrel fits both).
 */
export const POOLS: Record<PropArchetype, readonly PropDef[]> = {
	corridor: [
		PROP_CATALOGUE.bucket1,
		PROP_CATALOGUE.cardboardBox1,
		PROP_CATALOGUE.cardboardBox2,
		PROP_CATALOGUE.gasCylinder,
		PROP_CATALOGUE.gear1,
		PROP_CATALOGUE.jerrycan,
		PROP_CATALOGUE.metalBarrel1,
		PROP_CATALOGUE.paintCan,
		PROP_CATALOGUE.pipe1,
		PROP_CATALOGUE.scrapMetal,
		PROP_CATALOGUE.toolbox,
	],
	arena: [
		PROP_CATALOGUE.cementBag,
		PROP_CATALOGUE.concreteBlock,
		PROP_CATALOGUE.gear1,
		PROP_CATALOGUE.gear3,
		PROP_CATALOGUE.metalBarrel1,
		PROP_CATALOGUE.metalBarrel2,
		PROP_CATALOGUE.tire,
		PROP_CATALOGUE.woodCrate1,
		PROP_CATALOGUE.woodCrate2,
		PROP_CATALOGUE.woodPlank1,
		PROP_CATALOGUE.woodPlank2,
	],
	courtyard: [
		PROP_CATALOGUE.bench,
		PROP_CATALOGUE.ladder,
		PROP_CATALOGUE.mailbox,
		PROP_CATALOGUE.metalBarrel1,
		PROP_CATALOGUE.pipe1,
		PROP_CATALOGUE.tire,
		PROP_CATALOGUE.woodCrate1,
		PROP_CATALOGUE.woodPlank1,
		PROP_CATALOGUE.woodPlank2,
		PROP_CATALOGUE.bucket2,
		PROP_CATALOGUE.cardboardBox1,
		// PE2 — PSX-Farm Assets additions for outdoor courtyard identity.
		PROP_CATALOGUE.farmApple,
		PROP_CATALOGUE.farmCarrot,
		PROP_CATALOGUE.farmHaybale1,
		PROP_CATALOGUE.farmHaybale2,
		PROP_CATALOGUE.farmBarrel,
		PROP_CATALOGUE.farmBasket,
		PROP_CATALOGUE.farmFenceShort,
		PROP_CATALOGUE.farmFenceMedium,
		PROP_CATALOGUE.farmBirdhouse,
	],
	sewer: [
		PROP_CATALOGUE.bucket1,
		PROP_CATALOGUE.gasCylinder,
		PROP_CATALOGUE.jerrycan,
		PROP_CATALOGUE.metalBarrel2,
		PROP_CATALOGUE.pipe1,
		PROP_CATALOGUE.pipe2,
		PROP_CATALOGUE.sawBlade,
		PROP_CATALOGUE.scrapMetal,
		PROP_CATALOGUE.gear3,
		PROP_CATALOGUE.bucket2,
	],
	library: [
		PROP_CATALOGUE.bench,
		PROP_CATALOGUE.firstAidKit,
		PROP_CATALOGUE.glassBottle,
		PROP_CATALOGUE.mailbox,
		PROP_CATALOGUE.shelf,
		PROP_CATALOGUE.stool,
		PROP_CATALOGUE.bucket2,
		PROP_CATALOGUE.cardboardBox2,
		PROP_CATALOGUE.paintCan,
		PROP_CATALOGUE.toolbox,
		// PE1 — Mansion_PSX additions read as "old reading-room" décor.
		PROP_CATALOGUE.mansionColumn,
		PROP_CATALOGUE.mansionWindow,
		PROP_CATALOGUE.mansionDoorFrame,
		PROP_CATALOGUE.mansionSmallWall,
	],
};

/** All distinct props across every archetype bucket — used by tests + asset verifier. */
export const ALL_PROPS: readonly PropDef[] = Object.values(PROP_CATALOGUE);

/** All archetype keys for iteration. Derived from POOLS so adding a key in one place suffices. */
export const PROP_ARCHETYPES: readonly PropArchetype[] = Object.keys(POOLS) as PropArchetype[];
