import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";

const COLOR_WRAITH = new THREE.Color(OBJEXOOM_PALETTE.enemyWraithSoul).getHex();
const COLOR_IMP = new THREE.Color(OBJEXOOM_PALETTE.enemyImpMagma).getHex();
const COLOR_AMBER = new THREE.Color(OBJEXOOM_PALETTE.actionPickupGlow).getHex();

type Mote = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	color: number;
	createdAt: number;
};

const MOTE_TTL_MS = 350;
// I2 — bumped from 96 to fit ref-parity counts (15 + 30 = 45 mid-fight),
// 200 covers 4-5 concurrent damage bursts without dropping older motes.
const MAX_MOTES = 200;

/**
 * D4/D5 — particle bursts. Listens for `objexoom:burst` events:
 *
 *   pickup    → 8  amber motes
 *   damage    → 15 violet motes (enemy hit)
 *   playerHit → 30 red    motes
 *   explode   → 12 amber  motes (imp explode-on-death)
 *
 * Each mote follows a simple ballistic arc and fades over
 * `MOTE_TTL_MS`. Mesh pool is capped at `MAX_MOTES`; oldest motes are
 * dropped when the cap is hit so allocation stays bounded.
 */
export function ParticleBurstField() {
	const motesRef = useRef<Mote[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);

	useEffect(() => {
		const onBurst = (e: Event) => {
			const ev = e as CustomEvent<{
				x: number;
				y: number;
				kind: "pickup" | "damage" | "explode" | "playerHit";
			}>;
			const detail = ev.detail;
			const count =
				detail.kind === "pickup"
					? 8
					: detail.kind === "explode"
						? 12
						: detail.kind === "playerHit"
							? 30
							: 15;
			const colorHex =
				detail.kind === "damage"
					? COLOR_WRAITH // violet — enemy hit
					: detail.kind === "playerHit"
						? COLOR_IMP // red — player hit
						: COLOR_AMBER; // amber — pickup / explode
			const now = performance.now();
			for (let i = 0; i < count; i += 1) {
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.random() * Math.PI - Math.PI / 2;
				const speed = 1.5 + Math.random() * 1.5;
				motesRef.current.push({
					id: nextId.current++,
					pos: { x: detail.x, y: 0.9, z: detail.y },
					vel: {
						x: Math.cos(theta) * Math.cos(phi) * speed,
						y: Math.sin(phi) * speed + 1.6,
						z: Math.sin(theta) * Math.cos(phi) * speed,
					},
					color: colorHex,
					createdAt: now,
				});
			}
			while (motesRef.current.length > MAX_MOTES) motesRef.current.shift();
		};
		window.addEventListener("objexoom:burst", onBurst);
		return () => window.removeEventListener("objexoom:burst", onBurst);
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		const live: Mote[] = [];
		const seen = new Set<number>();
		for (const mote of motesRef.current) {
			const age = now - mote.createdAt;
			if (age > MOTE_TTL_MS) continue;
			mote.pos.x += mote.vel.x * dt;
			mote.pos.y += mote.vel.y * dt;
			mote.pos.z += mote.vel.z * dt;
			mote.vel.y -= 6 * dt; // gravity
			let mesh = meshes.current.get(mote.id);
			if (!mesh) {
				const m = new THREE.Mesh(
					new THREE.SphereGeometry(0.08, 6, 6),
					new THREE.MeshStandardMaterial({
						color: mote.color,
						emissive: mote.color,
						emissiveIntensity: 1.6,
						transparent: true,
					}),
				);
				groupRef.current.add(m);
				meshes.current.set(mote.id, m);
				mesh = m;
			}
			mesh.position.set(mote.pos.x, mote.pos.y, mote.pos.z);
			const fade = 1 - age / MOTE_TTL_MS;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(mote.id);
			live.push(mote);
		}
		motesRef.current = live;
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				meshes.current.delete(id);
			}
		}
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}
