import type { ObjexoomGridMap } from "@engine/engine";
import { useGLTF, useTexture } from "@react-three/drei";
import { getArchetypeLightPalette } from "@scene/lighting/archetypePalette";
import { TILE } from "@shared/constants";
import { pickArchetype } from "@world/archetype";
import { FLOOR_TEXTURES } from "@world/floorTextures";
import type { PropArchetype } from "@world/scatter/propPool";
import { ALL_WALL_URLS, pickWallUrl } from "@world/structures";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import { WALL_HEIGHT } from "../constants";
import { LockedDoor } from "./LockedDoor";

/**
 * Renders an ObjexoomGridMap as floor + ceiling + wall slabs + lava
 * tiles. COV3 step-5: wall cells are rendered as cloned modular GLBs
 * keyed to the map's archetype (via `pickArchetype(map)`), replacing
 * the procedural `<boxGeometry>` cubes. Each wall cell still
 * physically occupies one TILE × WALL_HEIGHT × TILE slot — collision
 * is unaffected — the GLB is scaled to fill the slot for visual fit.
 *
 * The per-cell variant pick uses the same deterministic formula as
 * the previous color-variant index (`gx * 31 + gy * 17`) so two
 * adjacent cells generally land on different variants.
 */
const NATIVE_WALL_WIDTH = 2;
const NATIVE_WALL_HEIGHT = 2;
const NATIVE_WALL_DEPTH = 0.4;

/**
 * POL3-v2 — per-archetype textured floor. Mounted under a Suspense
 * boundary so the texture-load doesn't block the rest of the map.
 * Falls back to the flat-color floor on corridor (no texture entry).
 */
function TexturedFloor({
	archetype,
	palette,
	floorSize,
	floorCenter,
}: {
	archetype: PropArchetype;
	palette: { floorColor: string; floorEmissive: string };
	floorSize: number;
	floorCenter: number;
}) {
	const set = FLOOR_TEXTURES[archetype];
	if (!set) {
		// Corridor (or any archetype without a texture entry) — flat color path.
		return (
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[floorCenter, 0, floorCenter]} receiveShadow>
				<planeGeometry args={[floorSize, floorSize]} />
				<meshStandardMaterial
					color={palette.floorColor}
					emissive={palette.floorEmissive}
					emissiveIntensity={0.18}
					roughness={0.95}
				/>
			</mesh>
		);
	}
	return (
		<TexturedFloorInner
			set={set}
			palette={palette}
			floorSize={floorSize}
			floorCenter={floorCenter}
		/>
	);
}

function TexturedFloorInner({
	set,
	palette,
	floorSize,
	floorCenter,
}: {
	set: { color: string; normal: string; repeat: number };
	palette: { floorColor: string; floorEmissive: string };
	floorSize: number;
	floorCenter: number;
}) {
	const [colorMap, normalMap] = useTexture([set.color, set.normal]);
	// Configure repeat/wrap for tile-style scaling. drei's useTexture
	// returns shared textures; setting wrap/repeat here mutates the
	// underlying THREE.Texture which is fine (each archetype has its
	// own URL → its own Texture instance).
	colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
	colorMap.repeat.set(set.repeat, set.repeat);
	colorMap.colorSpace = THREE.SRGBColorSpace;
	normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
	normalMap.repeat.set(set.repeat, set.repeat);
	return (
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[floorCenter, 0, floorCenter]} receiveShadow>
			<planeGeometry args={[floorSize, floorSize]} />
			<meshStandardMaterial
				map={colorMap}
				normalMap={normalMap}
				color={palette.floorColor}
				emissive={palette.floorEmissive}
				emissiveIntensity={0.08}
				roughness={0.85}
				metalness={0.05}
			/>
		</mesh>
	);
}

export function MapGeometry({ map, doorOpen }: { map: ObjexoomGridMap; doorOpen: boolean }) {
	const archetype = useMemo<PropArchetype>(() => pickArchetype(map), [map]);
	const palette = useMemo(() => getArchetypeLightPalette(archetype), [archetype]);
	const walls = useMemo(() => {
		const out: { x: number; z: number; hash: number }[] = [];
		for (let gy = 0; gy < map.height; gy += 1) {
			for (let gx = 0; gx < map.width; gx += 1) {
				if (map.cells[gy][gx] !== "wall") continue;
				out.push({ x: (gx + 0.5) * TILE, z: (gy + 0.5) * TILE, hash: gx * 31 + gy * 17 });
			}
		}
		return out;
	}, [map]);

	const lavaTiles = useMemo(() => {
		const out: { x: number; z: number }[] = [];
		for (let gy = 0; gy < map.height; gy += 1) {
			for (let gx = 0; gx < map.width; gx += 1) {
				if (map.cells[gy][gx] !== "lava") continue;
				out.push({ x: (gx + 0.5) * TILE, z: (gy + 0.5) * TILE });
			}
		}
		return out;
	}, [map]);

	const floorSize = TILE * Math.max(map.width, map.height);
	const floorCenter = (TILE * map.width) / 2;

	const doorPos = useMemo(
		() => ({
			x: (map.doorCell.gx + 0.5) * TILE,
			z: (map.doorCell.gy + 0.5) * TILE,
		}),
		[map],
	);

	return (
		<group>
			<Suspense
				fallback={
					<mesh
						rotation={[-Math.PI / 2, 0, 0]}
						position={[floorCenter, 0, floorCenter]}
						receiveShadow
					>
						<planeGeometry args={[floorSize, floorSize]} />
						<meshStandardMaterial
							color={palette.floorColor}
							emissive={palette.floorEmissive}
							emissiveIntensity={0.18}
							roughness={0.95}
						/>
					</mesh>
				}
			>
				<TexturedFloor
					archetype={archetype}
					palette={palette}
					floorSize={floorSize}
					floorCenter={floorCenter}
				/>
			</Suspense>
			<mesh rotation={[Math.PI / 2, 0, 0]} position={[floorCenter, WALL_HEIGHT, floorCenter]}>
				<planeGeometry args={[floorSize, floorSize]} />
				<meshStandardMaterial color={palette.ceilingColor} roughness={1} />
			</mesh>

			{lavaTiles.map((p) => (
				<mesh key={`l-${p.x}-${p.z}`} position={[p.x, 0.02, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
					<planeGeometry args={[TILE, TILE]} />
					<meshStandardMaterial
						color={OBJEXOOM_PALETTE.amber}
						emissive={OBJEXOOM_PALETTE.amber}
						emissiveIntensity={1.6}
					/>
				</mesh>
			))}

			{walls.map((m) => (
				<GridWall key={`w-${m.x}-${m.z}`} archetype={archetype} x={m.x} z={m.z} hash={m.hash} />
			))}

			<LockedDoor position={doorPos} open={doorOpen} />
		</group>
	);
}

function GridWall({
	archetype,
	x,
	z,
	hash,
}: {
	archetype: PropArchetype;
	x: number;
	z: number;
	hash: number;
}) {
	const url = pickWallUrl(archetype, hash);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	const scaleX = TILE / NATIVE_WALL_WIDTH;
	const scaleY = WALL_HEIGHT / NATIVE_WALL_HEIGHT;
	const scaleZ = TILE / NATIVE_WALL_DEPTH;
	return (
		<group position={[x, 0, z]} scale={[scaleX, scaleY, scaleZ]}>
			<primitive object={cloned} />
		</group>
	);
}

// A4 — tier 2 (map-mount). Walls are needed for the first frame.
export function preloadWalls(): void {
	for (const url of ALL_WALL_URLS) {
		useGLTF.preload(url);
	}
}
