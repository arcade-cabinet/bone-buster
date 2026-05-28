/**
 * CR-H1scene — the dynamic-entity mesh cluster (the directive's `<EnemyField>`
 * slot), lifted out of BoneBusterScene's JSX. Renders one mesh per live enemy
 * (plus its hit-flash + UV reveal/hide slots), per pickup, and per barrel,
 * each registering its three.js group into a parent-owned lookup map so the
 * per-frame tick can address meshes by entity id.
 *
 * Entity lists are passed as `.current` arrays and the lookup maps as the same
 * ref objects the tick reads — identity is preserved, so the registration
 * callbacks write into exactly the maps the Scene's frame loop consults.
 */

import type { Enemy, Pickup } from "@engine/mapTypes";
import type { Barrel } from "@world/barrels";
import type { RefObject } from "react";
import type * as THREE from "three";
import {
	BarrelMesh,
	EnemyHitFlash,
	EnemyMesh,
	EnemyUvBaseHide,
	EnemyUvReveal,
	PickupMesh,
} from "../index";

export type EntityMeshesProps = Readonly<{
	enemies: readonly Enemy[];
	enemyMeshes: RefObject<Map<number, THREE.Group>>;
	/** PC3 — when true, uvHidden enemies run the per-frame UV reveal; when false they baseline-hide. */
	hasUvFlashlight: boolean;
	pickups: readonly Pickup[];
	pickupMeshes: RefObject<Map<number, THREE.Group>>;
	barrels: readonly Barrel[];
	barrelMeshes: RefObject<Map<number, THREE.Group>>;
	mapSeedNum: number;
}>;

export function EntityMeshes({
	enemies,
	enemyMeshes,
	hasUvFlashlight,
	pickups,
	pickupMeshes,
	barrels,
	barrelMeshes,
	mapSeedNum,
}: EntityMeshesProps) {
	return (
		<>
			{enemies.map((enemy) => (
				<group key={enemy.id}>
					<EnemyMesh
						enemy={enemy}
						register={(group) => {
							if (group) enemyMeshes.current.set(enemy.id, group);
							else enemyMeshes.current.delete(enemy.id);
						}}
					/>
					{/* POL19 — hit-flash slot. Sibling to EnemyMesh per
					    docs/SLOT-ARCHITECTURE.md. Reads enemy.staggerUntil,
					    looks up the registered mesh via enemyMeshes, clones
					    + modulates materials. Returns null. */}
					<EnemyHitFlash enemy={enemy} meshLookup={enemyMeshes} />
					{/* PC3 — UV reveal / baseline-hide slot. uvHidden enemies
					    are invisible by default; UV flashlight cone reveals
					    them per-frame. The two slots are mutually exclusive
					    based on hasUvFlashlight so the no-tool path pays
					    zero per-frame UV cost. */}
					{enemy.uvHidden &&
						(hasUvFlashlight ? (
							<EnemyUvReveal enemy={enemy} meshLookup={enemyMeshes} />
						) : (
							<EnemyUvBaseHide enemy={enemy} meshLookup={enemyMeshes} />
						))}
				</group>
			))}

			{pickups.map((pickup) => (
				<PickupMesh
					key={pickup.id}
					pickup={pickup}
					mapSeed={mapSeedNum}
					register={(group) => {
						if (group) pickupMeshes.current.set(pickup.id, group);
						else pickupMeshes.current.delete(pickup.id);
					}}
				/>
			))}

			{barrels.map((barrel) => (
				<BarrelMesh
					key={barrel.id}
					barrel={barrel}
					register={(group) => {
						if (group) barrelMeshes.current.set(barrel.id, group);
						else barrelMeshes.current.delete(barrel.id);
					}}
				/>
			))}
		</>
	);
}
