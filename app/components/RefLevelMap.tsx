/**
 * Renders a turtle-decoded reference level as r3f geometry.
 *
 * Each `MapPolygon` becomes a flat extruded floor/ceiling pair plus vertical
 * wall quads on every edge that isn't shared with an adjacent polygon at the
 * same height. Floor texture choice (lava vs. stone vs. wood) is driven by
 * the polygon's floorHeight — matching the reference's heuristic where
 * `floor_height < 0` cells render as lava.
 *
 * NOTE: this component is fully self-contained. The main shell still uses
 * the procedural grid generator; loading reference levels is gated by a
 * future `?objexoom=ref1..5` URL flag (forthcoming commit).
 */

import { type DecodedLevel, levelBounds, type Polygon } from "@ai/turtle";
import { BONE_BUSTER_PALETTE } from "@shared/constants";
import { useMemo } from "react";
import * as THREE from "three";

type Props = Readonly<{
	level: DecodedLevel;
}>;

const WORLD_SCALE = 0.25; // reference units → r3f units

function polygonToVec2Array(poly: Polygon, ox: number, oy: number) {
	return poly.vertices.map(
		(v) => new THREE.Vector2((v.x - ox) * WORLD_SCALE, (v.y - oy) * WORLD_SCALE),
	);
}

function polygonShape(poly: Polygon, ox: number, oy: number): THREE.Shape {
	return new THREE.Shape(polygonToVec2Array(poly, ox, oy));
}

function isLavaFloor(poly: Polygon) {
	return poly.floorHeight < 0;
}

export function RefLevelMap({ level }: Props) {
	const bb = useMemo(() => levelBounds(level), [level]);
	const ox = (bb.minX + bb.maxX) / 2;
	const oy = (bb.minY + bb.maxY) / 2;

	return (
		<group>
			{level.polygons.map((poly) => {
				const shape = polygonShape(poly, ox, oy);
				const floorY = poly.floorHeight * WORLD_SCALE;
				const ceilY = poly.ceilingHeight * WORLD_SCALE;
				const lava = isLavaFloor(poly);
				const polyKey = poly.vertices.map((v) => `${v.x},${v.y}`).join("|");
				return (
					<group key={`p-${polyKey}`}>
						{/* Floor */}
						<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]}>
							<shapeGeometry args={[shape]} />
							<meshStandardMaterial
								color={lava ? BONE_BUSTER_PALETTE.amber : "#1f2547"}
								emissive={lava ? BONE_BUSTER_PALETTE.amber : "#0b1024"}
								emissiveIntensity={lava ? 1.4 : 0.1}
								roughness={lava ? 0.4 : 0.9}
								side={THREE.DoubleSide}
							/>
						</mesh>
						{/* Ceiling */}
						<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceilY, 0]}>
							<shapeGeometry args={[shape]} />
							<meshStandardMaterial color="#0b1024" roughness={1} side={THREE.DoubleSide} />
						</mesh>
						{/* Walls — one quad per edge */}
						{poly.vertices.map((a, idx) => {
							const b = poly.vertices[(idx + 1) % poly.vertices.length];
							// b is provably defined: modulo wrap stays within
							// [0, vertices.length) and the array has that element.
							if (b === undefined) return null;
							const ax = (a.x - ox) * WORLD_SCALE;
							const ay = (a.y - oy) * WORLD_SCALE;
							const bx = (b.x - ox) * WORLD_SCALE;
							const by = (b.y - oy) * WORLD_SCALE;
							const len = Math.hypot(bx - ax, by - ay);
							if (len < 1e-3) return null;
							const mx = (ax + bx) / 2;
							const mz = (ay + by) / 2;
							const angle = Math.atan2(by - ay, bx - ax);
							const height = ceilY - floorY;
							return (
								<mesh
									key={`w-${polyKey}-${a.x},${a.y}-${b.x},${b.y}`}
									position={[mx, floorY + height / 2, mz]}
									rotation={[0, -angle, 0]}
								>
									<boxGeometry args={[len, height, 0.08]} />
									<meshStandardMaterial
										color={idx % 3 === 0 ? "#1f2547" : idx % 3 === 1 ? "#26224a" : "#1a1e3b"}
										emissive={BONE_BUSTER_PALETTE.indigo}
										emissiveIntensity={0.08}
										roughness={0.85}
									/>
								</mesh>
							);
						})}
					</group>
				);
			})}
		</group>
	);
}

export { WORLD_SCALE as REF_WORLD_SCALE };
