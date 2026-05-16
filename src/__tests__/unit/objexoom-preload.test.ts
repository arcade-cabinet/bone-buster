/**
 * A4 — tiered preload orchestrator pin.
 *
 * Verifies that each tier entry-point delegates to the correct
 * set of per-entity preload functions. Without this, a future
 * refactor that drops `preloadKitchenProps()` from
 * `preloadTier3Deferred` would still pass an API-surface-only
 * test — but the kitchen scatter assets would silently never
 * preload, manifesting as a fetch stall on the first library map.
 *
 * Strategy: `vi.mock` each entity module to replace its
 * `preloadX` export with a `vi.fn()` spy, then call each tier
 * function and assert exactly which spies were invoked.
 *
 * Source: PERF audit Architectural D +
 * CodeRabbit PR #57 review (tier membership pin).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../scene/entities/BarrelMesh", () => ({ preloadBarrels: vi.fn() }));
vi.mock("../../scene/entities/DebrisField", () => ({ preloadDebris: vi.fn() }));
vi.mock("../../scene/entities/DecalField", () => ({ preloadDecals: vi.fn() }));
vi.mock("../../scene/entities/EnemyMesh", () => ({ preloadEnemyRoster: vi.fn() }));
vi.mock("../../scene/entities/FloorTileField", () => ({ preloadFloorTiles: vi.fn() }));
vi.mock("../../scene/entities/KitchenField", () => ({ preloadKitchenProps: vi.fn() }));
vi.mock("../../scene/entities/LampField", () => ({ preloadLamps: vi.fn() }));
vi.mock("../../scene/entities/LargePropField", () => ({ preloadLargeProps: vi.fn() }));
vi.mock("../../scene/entities/NatureField", () => ({ preloadNature: vi.fn() }));
vi.mock("../../scene/entities/NpcField", () => ({ preloadNpcs: vi.fn() }));
vi.mock("../../scene/entities/PickupMesh", () => ({ preloadLootPickups: vi.fn() }));
vi.mock("../../scene/entities/PropField", () => ({ preloadProps: vi.fn() }));
vi.mock("../../scene/entities/RealDoor", () => ({ preloadDoors: vi.fn() }));
vi.mock("../../scene/entities/TrapField", () => ({ preloadTraps: vi.fn() }));
vi.mock("../../scene/entities/VehicleWreck", () => ({ preloadVehicleWrecks: vi.fn() }));
vi.mock("../../scene/map/MapGeometry", () => ({ preloadWalls: vi.fn() }));
vi.mock("../../scene/map/SectorMapGeometry", () => ({ preloadSectorWalls: vi.fn() }));
vi.mock("../../scene/viewmodel/WeaponViewmodel", () => ({
	preloadWeapons: vi.fn(),
	preloadMeleeSkins: vi.fn(),
}));

// Imported AFTER the mock setup so the orchestrator's own
// imports resolve to the spy versions.
import { preloadTier1Critical, preloadTier2MapMount, preloadTier3Deferred } from "../../preload";
import { preloadBarrels } from "../../scene/entities/BarrelMesh";
import { preloadDebris } from "../../scene/entities/DebrisField";
import { preloadDecals } from "../../scene/entities/DecalField";
import { preloadEnemyRoster } from "../../scene/entities/EnemyMesh";
import { preloadFloorTiles } from "../../scene/entities/FloorTileField";
import { preloadKitchenProps } from "../../scene/entities/KitchenField";
import { preloadLamps } from "../../scene/entities/LampField";
import { preloadLargeProps } from "../../scene/entities/LargePropField";
import { preloadNature } from "../../scene/entities/NatureField";
import { preloadNpcs } from "../../scene/entities/NpcField";
import { preloadLootPickups } from "../../scene/entities/PickupMesh";
import { preloadProps } from "../../scene/entities/PropField";
import { preloadDoors } from "../../scene/entities/RealDoor";
import { preloadTraps } from "../../scene/entities/TrapField";
import { preloadVehicleWrecks } from "../../scene/entities/VehicleWreck";
import { preloadWalls } from "../../scene/map/MapGeometry";
import { preloadSectorWalls } from "../../scene/map/SectorMapGeometry";
import { preloadMeleeSkins, preloadWeapons } from "../../scene/viewmodel/WeaponViewmodel";

/** All spies in one place so tier-membership assertions can
 * verify both inclusion AND exclusion (a tier-2 delegate must
 * NOT fire when tier-1 runs alone). */
const ALL_SPIES = {
	preloadWeapons,
	preloadMeleeSkins,
	preloadWalls,
	preloadSectorWalls,
	preloadFloorTiles,
	preloadBarrels,
	preloadEnemyRoster,
	preloadLamps,
	preloadDoors,
	preloadLootPickups,
	preloadLargeProps,
	preloadProps,
	preloadDecals,
	preloadDebris,
	preloadKitchenProps,
	preloadNature,
	preloadNpcs,
	preloadTraps,
	preloadVehicleWrecks,
} as const;

function resetAllSpies(): void {
	for (const fn of Object.values(ALL_SPIES)) {
		(fn as ReturnType<typeof vi.fn>).mockClear();
	}
}

function assertCalled(expected: ReadonlyArray<keyof typeof ALL_SPIES>): void {
	const expectedSet = new Set(expected);
	for (const [name, fn] of Object.entries(ALL_SPIES)) {
		const spy = fn as ReturnType<typeof vi.fn>;
		if (expectedSet.has(name as keyof typeof ALL_SPIES)) {
			expect(spy, `${name} should have been called`).toHaveBeenCalledTimes(1);
		} else {
			expect(spy, `${name} should NOT have been called`).not.toHaveBeenCalled();
		}
	}
}

describe("A4 — tiered preload orchestrator", () => {
	it("tier 1 calls only preloadWeapons (pistol viewmodel)", () => {
		resetAllSpies();
		preloadTier1Critical();
		assertCalled(["preloadWeapons"]);
	});

	it("tier 2 calls every map-mount delegate", () => {
		resetAllSpies();
		preloadTier2MapMount();
		assertCalled([
			"preloadWalls",
			"preloadSectorWalls",
			"preloadFloorTiles",
			"preloadBarrels",
			"preloadEnemyRoster",
			"preloadLamps",
			"preloadDoors",
			"preloadLootPickups",
			"preloadLargeProps",
			"preloadProps",
			"preloadMeleeSkins",
		]);
	});

	it("tier 3 calls every deferred delegate", () => {
		resetAllSpies();
		preloadTier3Deferred();
		assertCalled([
			"preloadDecals",
			"preloadDebris",
			"preloadKitchenProps",
			"preloadNature",
			"preloadNpcs",
			"preloadTraps",
			"preloadVehicleWrecks",
		]);
	});

	it("tier 1 does NOT trigger any tier-2 or tier-3 delegate (membership exclusion)", () => {
		resetAllSpies();
		preloadTier1Critical();
		// Pull the tier-1 entry out and verify everything else stays
		// untouched.
		const t1Only = preloadWeapons as ReturnType<typeof vi.fn>;
		expect(t1Only).toHaveBeenCalledOnce();
		for (const [name, fn] of Object.entries(ALL_SPIES)) {
			if (name === "preloadWeapons") continue;
			expect(fn as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
		}
	});

	it("re-invocation is idempotent (orchestrator-level)", () => {
		resetAllSpies();
		preloadTier1Critical();
		preloadTier1Critical();
		expect(preloadWeapons).toHaveBeenCalledTimes(2);
	});

	it("exports preloadTier1Critical / preloadTier2MapMount / preloadTier3Deferred as functions", () => {
		expect(typeof preloadTier1Critical).toBe("function");
		expect(typeof preloadTier2MapMount).toBe("function");
		expect(typeof preloadTier3Deferred).toBe("function");
	});
});
