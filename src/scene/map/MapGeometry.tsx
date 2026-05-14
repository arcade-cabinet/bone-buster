"use client";

import { useMemo } from "react";
import { TILE } from "../../constants";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import type { ObjexoomGridMap } from "../../engine";
import { WALL_HEIGHT } from "../constants";
import { LockedDoor } from "./LockedDoor";

/**
 * Renders an ObjexoomGridMap as floor + ceiling + wall boxes + lava
 * tiles. Walls are picked with a stable per-cell variant index so the
 * scene reads with subtle color variation rather than uniform fill.
 */
export function MapGeometry({ map, doorOpen }: { map: ObjexoomGridMap; doorOpen: boolean }) {
	const walls = useMemo(() => {
		const out: { x: number; z: number; variant: number }[] = [];
		for (let gy = 0; gy < map.height; gy += 1) {
			for (let gx = 0; gx < map.width; gx += 1) {
				if (map.cells[gy][gx] !== "wall") continue;
				const variant = (gx * 31 + gy * 17) % 3;
				out.push({ x: (gx + 0.5) * TILE, z: (gy + 0.5) * TILE, variant });
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
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[floorCenter, 0, floorCenter]} receiveShadow>
				<planeGeometry args={[floorSize, floorSize]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.ink}
					emissive="#1a1f3a"
					emissiveIntensity={0.18}
					roughness={0.95}
				/>
			</mesh>
			<mesh rotation={[Math.PI / 2, 0, 0]} position={[floorCenter, WALL_HEIGHT, floorCenter]}>
				<planeGeometry args={[floorSize, floorSize]} />
				<meshStandardMaterial color="#0b1024" roughness={1} />
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
				<mesh
					key={`w-${m.x}-${m.z}`}
					position={[m.x, WALL_HEIGHT / 2, m.z]}
					castShadow
					receiveShadow
				>
					<boxGeometry args={[TILE, WALL_HEIGHT, TILE]} />
					<meshStandardMaterial
						color={m.variant === 0 ? "#1f2547" : m.variant === 1 ? "#26224a" : "#1a1e3b"}
						emissive={m.variant === 0 ? OBJEXOOM_PALETTE.indigo : OBJEXOOM_PALETTE.violet}
						emissiveIntensity={0.08}
						roughness={0.85}
					/>
				</mesh>
			))}

			<LockedDoor position={doorPos} open={doorOpen} />
		</group>
	);
}
