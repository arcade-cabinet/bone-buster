/**
 * A4 — tiered asset preload orchestrator.
 *
 * Pre-A4 every scene entity file ran a module-scope IIFE on first
 * import that pumped its GLB list into `useGLTF.preload(url)`. The
 * scene barrel (`src/scene/index.ts`) re-exports all entity files,
 * and BoneBusterShell statically imports BoneBusterScene → which
 * imports the barrel. Net effect: the moment the app booted —
 * while the user was still on the landing screen with the play
 * button — every GLB the game might ever load was queued for
 * download. On slow networks this was ~90 MB of net pressure for
 * assets the user might never see (kitchen props on a non-library
 * run, NPCs on a non-library run, vehicle wrecks on a non-
 * courtyard run, etc).
 *
 * A4 splits the preload set into three explicit tiers:
 *
 * Tier 1 (critical) — fired at app boot from `BoneBusterShell`.
 *   Only the GLBs needed BEFORE the user has clicked "Start
 *   Game": the pistol viewmodel.
 *
 * Tier 2 (map-mount) — fired from `BoneBusterScene` on first mount.
 *   Assets needed to render the first frame: walls, doors, floor
 *   tiles, lamps, barrels, enemy roster, loot pickups, large
 *   props, ambient props, melee skin variants (rare per-map swap
 *   but cheap to fold in here so a mid-run pickup doesn't stall).
 *
 * Tier 3 (deferred) — fired in a `setTimeout(0)` after the scene
 *   has mounted so it runs after the first frame paints. Assets
 *   for visually-secondary or per-archetype subsets that the user
 *   doesn't see at t=0: decals, debris, kitchen, nature, NPCs,
 *   traps, vehicle wrecks.
 *
 * Each entity file exports a `preloadX()` function instead of
 * running a module-scope IIFE. The orchestrator below calls those
 * functions in tier order. `useGLTF.preload` dedupes internally
 * so re-calling is a no-op.
 *
 * Source: PERF audit Architectural D.
 */

import { preloadBarrels } from "../scene/entities/BarrelMesh";
import { preloadDebris } from "../scene/entities/DebrisField";
import { preloadDecals } from "../scene/entities/DecalField";
import { preloadEnemyRoster } from "../scene/entities/EnemyMesh";
import { preloadFloorTiles } from "../scene/entities/FloorTileField";
import { preloadKitchenProps } from "../scene/entities/KitchenField";
import { preloadLamps } from "../scene/entities/LampField";
import { preloadLargeProps } from "../scene/entities/LargePropField";
import { preloadNature } from "../scene/entities/NatureField";
import { preloadNpcs } from "../scene/entities/NpcField";
import { preloadLootPickups, preloadToolPickups } from "../scene/entities/PickupMesh";
import { preloadProps } from "../scene/entities/PropField";
import { preloadDoors } from "../scene/entities/RealDoor";
import { preloadTraps } from "../scene/entities/TrapField";
import { preloadVehicleWrecks } from "../scene/entities/VehicleWreck";
import { preloadWalls } from "../scene/map/MapGeometry";
import { preloadSectorWalls } from "../scene/map/SectorMapGeometry";
import {
	preloadMeleeSkins,
	preloadPistolSkins,
	preloadWeapons,
} from "../scene/viewmodel/WeaponViewmodel";

/**
 * Tier 1 — called at app boot from `BoneBusterShell` mount. The
 * pistol is the start weapon for every run, so its GLB must be
 * hot before the Canvas mounts. Melee skins are NOT tier 1 —
 * they're a per-map variant only visible if the player picks up
 * the BLADE.
 */
export function preloadTier1Critical(): void {
	preloadWeapons();
	// PD1 — pistol is the start weapon for every run, and the per-seed
	// pistol skin pick happens at viewmodel mount before any other tier
	// preloads. Loading the skin pool tier-1 prevents a first-frame
	// stall when the seed lands on a non-default skin.
	preloadPistolSkins();
}

/**
 * Tier 2 — called from `BoneBusterScene` useEffect on first mount.
 * Everything needed to render the first frame.
 */
export function preloadTier2MapMount(): void {
	preloadWalls();
	preloadSectorWalls();
	preloadFloorTiles();
	preloadBarrels();
	preloadEnemyRoster();
	preloadLamps();
	preloadDoors();
	preloadLootPickups();
	preloadToolPickups();
	preloadLargeProps();
	preloadProps();
	preloadMeleeSkins();
}

/**
 * Tier 3 — deferred via `setTimeout(0)` so it fires after the
 * first frame paints. Visually-secondary or per-archetype subsets.
 */
export function preloadTier3Deferred(): void {
	preloadDecals();
	preloadDebris();
	preloadKitchenProps();
	preloadNature();
	preloadNpcs();
	preloadTraps();
	preloadVehicleWrecks();
}
