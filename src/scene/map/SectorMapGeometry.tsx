import { computePortalEdges, edgeKey, type ObjexoomSectorMap } from "@engine/engine";
import { useGLTF } from "@react-three/drei";
import { getArchetypeLightPalette } from "@scene/lighting/archetypePalette";
import { pickArchetype } from "@world/archetype";
import type { PropArchetype } from "@world/scatter/propPool";
import { ALL_WALL_URLS, pickWallUrl } from "@world/structures";
import { useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import { WaterSurface } from "./WaterSurface";

/**
 * Renders an ObjexoomSectorMap (decoded reference level) as r3f
 * geometry. Each MapSector becomes a flat floor + ceiling shape plus
 * wall quads along every edge. Portal de-duping (skipping interior
 * edges shared with neighbors at the same height) is handled
 * engine-side in `computePortalEdges`.
 *
 * Sectors with `floorHeight < 0` render lava-tinted to match the
 * reference clone's hot-floor convention.
 *
 * COV3 step-1: when `map.useModularFloor` is true, the procedural
 * floor `<shapeGeometry>` is OMITTED — the per-sector floor is
 * rendered by `FloorTileField` instead (mounted by ObjexoomScene).
 * Lava floors keep the procedural shape even when the flag is set
 * (the molten emissive surface is visually load-bearing and there's
 * no lava-tile asset in the modular pack).
 *
 * COV3 step-2: when `map.useModularWalls` is true, the procedural
 * `<boxGeometry>` wall quads are replaced with PSX Mega Pack II
 * Modular Structures GLBs picked deterministically per edge. Portal
 * edges are skipped via `computePortalEdges` so navigation paths
 * remain open. Collision still keys off the sector polygon vertices
 * (handled in `resolveCollisionSectors`); the GLBs are visual only.
 */
export function SectorMapGeometry({ map }: { map: ObjexoomSectorMap }) {
	const useModularFloor = map.useModularFloor === true;
	const useModularWalls = map.useModularWalls === true;
	const archetype = useMemo<PropArchetype>(() => pickArchetype(map), [map]);
	const palette = useMemo(() => getArchetypeLightPalette(archetype), [archetype]);
	const portals = useMemo(
		() => (useModularWalls ? computePortalEdges(map) : null),
		[map, useModularWalls],
	);
	const shapes = useMemo(() => {
		return map.sectors.map((sector) => {
			const shape = new THREE.Shape(sector.vertices.map((v) => new THREE.Vector2(v.x, v.y)));
			const lava = sector.floorHeight < 0;
			const sectorKey = sector.vertices.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join("|");
			return { sector, shape, lava, sectorKey };
		});
	}, [map]);

	return (
		<group>
			{shapes.map(({ sector, shape, lava, sectorKey }) => (
				<group key={`sec-${sectorKey}`}>
					{/* Floor — omitted when COV3 modular floor tiles are active
					    (FloorTileField in ObjexoomScene renders the surface).
					    Lava sectors keep the procedural emissive shape since
					    there's no lava-tile asset in the modular pack. */}
					{!useModularFloor || lava ? (
						<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, sector.floorHeight, 0]}>
							<shapeGeometry args={[shape]} />
							<meshStandardMaterial
								color={lava ? OBJEXOOM_PALETTE.amber : OBJEXOOM_PALETTE.wallVariantCool}
								emissive={lava ? OBJEXOOM_PALETTE.amber : OBJEXOOM_PALETTE.wallBase}
								emissiveIntensity={lava ? 1.4 : 0.18}
								roughness={lava ? 0.4 : 0.95}
								side={THREE.DoubleSide}
							/>
						</mesh>
					) : null}
					{/* E7 — animated water surface layered just above the floor
					    when this sector is flagged `isWater: true`. */}
					{sector.isWater ? <WaterSurface sector={sector} color={palette.waterColor} /> : null}
					{/* Ceiling */}
					<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, sector.ceilingHeight, 0]}>
						<shapeGeometry args={[shape]} />
						<meshStandardMaterial
							color={palette.ceilingColor}
							roughness={1}
							side={THREE.DoubleSide}
						/>
					</mesh>
					{/* Walls — one per edge. */}
					{sector.vertices.map((a, idx) => {
						const b = sector.vertices[(idx + 1) % sector.vertices.length];
						const len = Math.hypot(b.x - a.x, b.y - a.y);
						if (len < 1e-3) return null;
						const mx = (a.x + b.x) / 2;
						const mz = (a.y + b.y) / 2;
						const angle = Math.atan2(b.y - a.y, b.x - a.x);
						const height = sector.ceilingHeight - sector.floorHeight;
						const wallKey = `${sectorKey}-${a.x.toFixed(2)},${a.y.toFixed(2)}-${b.x.toFixed(2)},${b.y.toFixed(2)}`;
						if (useModularWalls && portals !== null) {
							// COV3 step-2: skip portal edges so doors / connections
							// remain walkable; mount a GLB clone otherwise.
							if (portals.has(edgeKey(a, b))) return null;
							return (
								<ModularWall
									key={`mw-${wallKey}`}
									archetype={archetype}
									hash={sector.id * 100 + idx}
									midX={mx}
									midZ={mz}
									length={len}
									height={height}
									baseY={sector.floorHeight}
									angle={angle}
								/>
							);
						}
						const variant = idx % 3;
						return (
							<mesh
								key={`w-${wallKey}`}
								position={[mx, sector.floorHeight + height / 2, mz]}
								rotation={[0, -angle, 0]}
							>
								<boxGeometry args={[len, height, 0.08]} />
								<meshStandardMaterial
									color={
										variant === 0
											? OBJEXOOM_PALETTE.wallVariantCool
											: variant === 1
												? OBJEXOOM_PALETTE.wallVariantWarm
												: OBJEXOOM_PALETTE.wallVariantNeutral
									}
									emissive={variant === 0 ? OBJEXOOM_PALETTE.indigo : OBJEXOOM_PALETTE.violet}
									emissiveIntensity={0.08}
									roughness={0.85}
								/>
							</mesh>
						);
					})}
				</group>
			))}
		</group>
	);
}

/**
 * COV3 step-2 — a single GLB wall clone placed along one sector edge.
 *
 * The GLBs are roughly 2 world units wide and 2 units tall in their
 * native form. We stretch X to match edge length and Y to match the
 * sector's floor-to-ceiling height so corridors of different lengths
 * still get a flush wall. Collision is unaffected — the sector
 * polygon edge remains the physical boundary; the GLB is visual only.
 */
const NATIVE_WALL_WIDTH = 2;
const NATIVE_WALL_HEIGHT = 2;

function ModularWall({
	archetype,
	hash,
	midX,
	midZ,
	length,
	height,
	baseY,
	angle,
}: {
	archetype: PropArchetype;
	hash: number;
	midX: number;
	midZ: number;
	length: number;
	height: number;
	baseY: number;
	angle: number;
}) {
	const url = pickWallUrl(archetype, hash);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	const scaleX = length / NATIVE_WALL_WIDTH;
	const scaleY = height / NATIVE_WALL_HEIGHT;
	return (
		<group position={[midX, baseY, midZ]} rotation={[0, -angle, 0]} scale={[scaleX, scaleY, 1]}>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 2 (map-mount). Same wall set as MapGeometry. Both
// are exported so the orchestrator can call them without
// importing MapGeometry's transitively from SectorMap (no-op
// duplicate calls are cheap; useGLTF.preload dedupes internally).
export function preloadSectorWalls(): void {
	for (const url of ALL_WALL_URLS) {
		useGLTF.preload(url);
	}
}
