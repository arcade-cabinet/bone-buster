"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import type { ObjexoomSectorMap } from "../../engine";

/**
 * Renders an ObjexoomSectorMap (decoded reference level) as r3f
 * geometry. Each MapSector becomes a flat floor + ceiling shape plus
 * wall quads along every edge. Portal de-duping (skipping interior
 * edges shared with neighbors at the same height) is handled
 * engine-side in `computePortalEdges`.
 *
 * Sectors with `floorHeight < 0` render lava-tinted to match the
 * reference clone's hot-floor convention.
 */
export function SectorMapGeometry({ map }: { map: ObjexoomSectorMap }) {
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
					{/* Floor */}
					<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, sector.floorHeight, 0]}>
						<shapeGeometry args={[shape]} />
						<meshStandardMaterial
							color={lava ? OBJEXOOM_PALETTE.amber : "#1f2547"}
							emissive={lava ? OBJEXOOM_PALETTE.amber : "#0b1024"}
							emissiveIntensity={lava ? 1.4 : 0.18}
							roughness={lava ? 0.4 : 0.95}
							side={THREE.DoubleSide}
						/>
					</mesh>
					{/* Ceiling */}
					<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, sector.ceilingHeight, 0]}>
						<shapeGeometry args={[shape]} />
						<meshStandardMaterial color="#0b1024" roughness={1} side={THREE.DoubleSide} />
					</mesh>
					{/* Walls — one quad per edge. */}
					{sector.vertices.map((a, idx) => {
						const b = sector.vertices[(idx + 1) % sector.vertices.length];
						const len = Math.hypot(b.x - a.x, b.y - a.y);
						if (len < 1e-3) return null;
						const mx = (a.x + b.x) / 2;
						const mz = (a.y + b.y) / 2;
						const angle = Math.atan2(b.y - a.y, b.x - a.x);
						const height = sector.ceilingHeight - sector.floorHeight;
						const variant = idx % 3;
						return (
							<mesh
								key={`w-${sectorKey}-${a.x.toFixed(2)},${a.y.toFixed(2)}-${b.x.toFixed(2)},${b.y.toFixed(2)}`}
								position={[mx, sector.floorHeight + height / 2, mz]}
								rotation={[0, -angle, 0]}
							>
								<boxGeometry args={[len, height, 0.08]} />
								<meshStandardMaterial
									color={variant === 0 ? "#1f2547" : variant === 1 ? "#26224a" : "#1a1e3b"}
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
