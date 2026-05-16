import { useGLTF } from "@react-three/drei";
import type { FloorTileInstance } from "@world/scatter/floorTiles";
import { FLOOR_TILE_VARIANTS, floorTileUrlFor } from "@world/scatter/floorTiles";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";

/**
 * COV3 step-1 — renders the per-map modular asphalt floor tile
 * scatter. Each FloorTileInstance gets a cloned mesh at its world
 * position with a quarter-turn yaw rotation for variety.
 *
 * Mounted by ObjexoomScene next to LampField when the map's
 * `useModularFloor` flag is set. SectorMapGeometry omits its
 * procedural floor `shapeGeometry` when the flag is set, so these
 * tiles ARE the floor for that map.
 *
 * The clone-per-instance pattern matches the rest of the entities:
 * drei's `useGLTF` returns a shared scene graph that mutations would
 * leak across consumers; `SkeletonUtils.clone` gives each mount its
 * own traversable tree.
 */
export function FloorTileField({ tiles }: { tiles: readonly FloorTileInstance[] }) {
	return (
		<>
			{tiles.map((tile) => (
				<FloorTileMesh key={tile.id} tile={tile} />
			))}
		</>
	);
}

function FloorTileMesh({ tile }: { tile: FloorTileInstance }) {
	const url = floorTileUrlFor(tile);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	const yaw = (tile.rotationQuarters * Math.PI) / 2;
	return (
		<group position={[tile.position.x, tile.floorHeight, tile.position.y]} rotation={[0, yaw, 0]}>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 2 (map-mount). All 4 variants so the first sector
// doesn't stall.
export function preloadFloorTiles(): void {
	for (const url of FLOOR_TILE_VARIANTS) {
		useGLTF.preload(url);
	}
}
