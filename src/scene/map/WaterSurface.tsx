import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import type { MapSector } from "../../engine";

/**
 * E7 step-1 — animated water surface for `isWater: true` sectors.
 *
 * Renders a flat polygon shape just above the sector floor with a
 * semi-transparent blue material whose UV offsets scroll over time
 * (the "UV-scrolled normal-map plane" from PRD §E7's acceptance —
 * step-1 ships the scroll + tinted surface; step-2 swaps in a real
 * normal map sampled from the PSX-Ocean-Surface pack).
 *
 * Why a fresh component vs. inlining into SectorMapGeometry: the
 * mesh needs `useFrame` to animate its material.map.offset every
 * frame; pulling that into the parent would cost a per-frame
 * re-render of every sector. Per-water-sector component scoping
 * isolates the cost.
 */
export function WaterSurface({ sector }: { sector: MapSector }) {
	const shape = useMemo(() => {
		return new THREE.Shape(sector.vertices.map((v) => new THREE.Vector2(v.x, v.y)));
	}, [sector.vertices]);
	const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
	const tex = useMemo(() => {
		// Procedural noise texture so we don't need an external GLB.
		// 64×64 RGBA with sinusoidal banding gives the eye a "water"
		// impression once the offset starts scrolling. The PSX-Ocean-
		// Surface pack's PNG can drop in here in step-2.
		const size = 64;
		const data = new Uint8Array(size * size * 4);
		for (let y = 0; y < size; y += 1) {
			for (let x = 0; x < size; x += 1) {
				const u = x / size;
				const v = y / size;
				const wave = Math.sin(u * Math.PI * 6) * Math.cos(v * Math.PI * 8) * 0.5 + 0.5;
				const i = (y * size + x) * 4;
				data[i] = Math.floor(120 + wave * 60); // R
				data[i + 1] = Math.floor(160 + wave * 40); // G
				data[i + 2] = Math.floor(220); // B (blue-dominant)
				data[i + 3] = 255;
			}
		}
		const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
		t.wrapS = THREE.RepeatWrapping;
		t.wrapT = THREE.RepeatWrapping;
		t.needsUpdate = true;
		return t;
	}, []);

	useFrame(({ clock }) => {
		const mat = materialRef.current;
		if (!mat || !mat.map) return;
		// Slow scroll across both axes — wraps via RepeatWrapping.
		mat.map.offset.x = (clock.elapsedTime * 0.04) % 1;
		mat.map.offset.y = (clock.elapsedTime * 0.025) % 1;
	});

	// Lift slightly above the floor so it doesn't z-fight with the
	// floor shape or modular tiles.
	const yOffset = sector.floorHeight + 0.02;

	return (
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
			<shapeGeometry args={[shape]} />
			<meshStandardMaterial
				ref={materialRef}
				map={tex}
				color={OBJEXOOM_PALETTE.indigo}
				emissive={OBJEXOOM_PALETTE.indigo}
				emissiveIntensity={0.15}
				roughness={0.25}
				transparent
				opacity={0.78}
				side={THREE.DoubleSide}
			/>
		</mesh>
	);
}
