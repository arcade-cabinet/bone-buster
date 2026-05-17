/**
 * COV4 — PSX Mega Pack II Props scatter pool contract.
 *
 * Pins the asset-enabler shape that E3 will consume:
 *  - ≥10 unique props reachable in the pool overall.
 *  - Each archetype bucket has ≥10 entries.
 *  - All bucket entries reference catalogue entries (no orphans).
 *  - URLs are BASE_URL-aware (route through A() helper).
 *  - Blocking flag is a boolean per entry.
 */

import { ALL_PROPS, POOLS, PROP_ARCHETYPES, PROP_CATALOGUE } from "@world/scatter/propPool";
import { describe, expect, it } from "vitest";

describe("COV4 — prop catalogue", () => {
	it("ships exactly 60 unique props (≥10 satisfies acceptance; pinned to catch accidental deletions)", () => {
		// COV4 shipped 30; PE1 added 4 mansion (library); PE2 added 9
		// farm (courtyard); PE3 added 8 electrical (sewer); PE4a added
		// 9 abandoned-hallway items (corridor). Future archetype-scenery
		// slices grow this number — every growth updates the expected
		// count to keep the regression contract strict.
		expect(ALL_PROPS.length).toBe(60);
		expect(ALL_PROPS.length).toBeGreaterThanOrEqual(10);
	});

	it("every prop URL routes through assetUrl.A() (BASE_URL-aware)", () => {
		// Props live under /assets/models/props/scatter/ with optional
		// per-archetype subfolders (PE1 added /scatter/library/...).
		for (const prop of ALL_PROPS) {
			expect(prop.url).toMatch(/\/assets\/models\/props\/scatter\/([a-z0-9_]+\/)?[a-z0-9_]+\.glb$/);
		}
	});

	it("every prop has a stable id and a boolean blocking flag", () => {
		for (const prop of ALL_PROPS) {
			expect(prop.id).toMatch(/^[a-z0-9_]+$/);
			expect(typeof prop.blocking).toBe("boolean");
		}
	});

	it("ids are unique across the catalogue", () => {
		const ids = new Set(ALL_PROPS.map((p) => p.id));
		expect(ids.size).toBe(ALL_PROPS.length);
	});
});

describe("COV4 — per-archetype buckets", () => {
	it("PRD-aligned archetype set: corridor, arena, courtyard, sewer, library", () => {
		expect([...PROP_ARCHETYPES].sort()).toEqual([
			"arena",
			"corridor",
			"courtyard",
			"library",
			"sewer",
		]);
	});

	it("each archetype bucket has ≥10 entries", () => {
		for (const archetype of PROP_ARCHETYPES) {
			const bucket = POOLS[archetype];
			expect(bucket.length, `${archetype} bucket too small`).toBeGreaterThanOrEqual(10);
		}
	});

	it("every bucket entry is a reference into PROP_CATALOGUE (no orphans)", () => {
		const cataloguedIds = new Set<string>(Object.values(PROP_CATALOGUE).map((p) => p.id));
		for (const archetype of PROP_ARCHETYPES) {
			for (const prop of POOLS[archetype]) {
				expect(cataloguedIds.has(prop.id), `${prop.id} in ${archetype} not in catalogue`).toBe(
					true,
				);
			}
		}
	});

	it("each bucket has unique props within itself (no duplicate variants per archetype)", () => {
		for (const archetype of PROP_ARCHETYPES) {
			const ids = POOLS[archetype].map((p) => p.id);
			expect(new Set(ids).size, `${archetype} has duplicates`).toBe(ids.length);
		}
	});

	it("at least one prop is blocking in the catalogue (collision opt-in works)", () => {
		expect(ALL_PROPS.some((p) => p.blocking)).toBe(true);
	});

	it("at least one prop is non-blocking in the catalogue (default-flat works)", () => {
		expect(ALL_PROPS.some((p) => !p.blocking)).toBe(true);
	});
});
