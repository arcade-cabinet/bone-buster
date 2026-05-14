import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";

const COLOR_WRAITH = new THREE.Color(OBJEXOOM_PALETTE.enemyWraithSoul).getHex();
const COLOR_IMP = new THREE.Color(OBJEXOOM_PALETTE.enemyImpMagma).getHex();
const COLOR_BONE = new THREE.Color(OBJEXOOM_PALETTE.enemyBone).getHex();

type BodyShard = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	spin: { x: number; y: number; z: number };
	color: number;
	createdAt: number;
	bounced: boolean;
};

const BODYPART_TTL_MS = 3000;
const MAX_BODY_SHARDS = 120;

/**
 * I1 — body-part physics. Listens for `objexoom:bodyParts`
 * (dispatched at every enemy death) and spawns 4-6 chunky shard meshes
 * at the death location. Each shard:
 *
 *  - random spin (rad/s on each axis)
 *  - initial velocity with radial spread + upward kick
 *  - gravity pulls them down
 *  - single ground bounce then settles
 *  - fades over BODYPART_TTL_MS, then despawns
 *
 * Shard color tracks the killed enemy's kind:
 *
 *   skeleton → bone white
 *   imp      → blood red
 *   wraith   → violet
 *
 * Mesh pool is capped at `MAX_BODY_SHARDS`.
 */
export function BodyPartField() {
	const shardsRef = useRef<BodyShard[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);

	useEffect(() => {
		const onSpawn = (e: Event) => {
			const ev = e as CustomEvent<{
				x: number;
				y: number;
				kind: "skeleton" | "imp" | "wraith";
			}>;
			const detail = ev.detail;
			const count = 4 + ((Math.random() * 3) | 0); // 4-6
			const baseColor =
				detail.kind === "wraith" ? COLOR_WRAITH : detail.kind === "imp" ? COLOR_IMP : COLOR_BONE;
			const now = performance.now();
			for (let i = 0; i < count; i += 1) {
				const theta = Math.random() * Math.PI * 2;
				const speed = 1.2 + Math.random() * 1.8;
				shardsRef.current.push({
					id: nextId.current++,
					pos: { x: detail.x, y: 1.0, z: detail.y },
					vel: {
						x: Math.cos(theta) * speed,
						y: 1.5 + Math.random() * 1.5,
						z: Math.sin(theta) * speed,
					},
					spin: {
						x: (Math.random() - 0.5) * 8,
						y: (Math.random() - 0.5) * 8,
						z: (Math.random() - 0.5) * 8,
					},
					color: baseColor,
					createdAt: now,
					bounced: false,
				});
			}
			while (shardsRef.current.length > MAX_BODY_SHARDS) {
				shardsRef.current.shift();
			}
		};
		window.addEventListener("objexoom:bodyParts", onSpawn);
		return () => window.removeEventListener("objexoom:bodyParts", onSpawn);
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		const live: BodyShard[] = [];
		const seen = new Set<number>();
		for (const shard of shardsRef.current) {
			const age = now - shard.createdAt;
			if (age > BODYPART_TTL_MS) continue;
			shard.pos.x += shard.vel.x * dt;
			shard.pos.y += shard.vel.y * dt;
			shard.pos.z += shard.vel.z * dt;
			shard.vel.y -= 10 * dt;
			if (shard.pos.y < 0.1) {
				shard.pos.y = 0.1;
				if (!shard.bounced && shard.vel.y < -0.5) {
					shard.vel.y *= -0.35;
					shard.vel.x *= 0.6;
					shard.vel.z *= 0.6;
					shard.bounced = true;
				} else {
					shard.vel.x *= 0.85;
					shard.vel.z *= 0.85;
					shard.vel.y = 0;
				}
			}
			let mesh = meshes.current.get(shard.id);
			if (!mesh) {
				const m = new THREE.Mesh(
					new THREE.BoxGeometry(0.18, 0.18, 0.18),
					new THREE.MeshStandardMaterial({
						color: shard.color,
						emissive: shard.color,
						emissiveIntensity: 0.25,
						transparent: true,
						roughness: 0.7,
					}),
				);
				groupRef.current.add(m);
				meshes.current.set(shard.id, m);
				mesh = m;
			}
			mesh.position.set(shard.pos.x, shard.pos.y, shard.pos.z);
			mesh.rotation.x += shard.spin.x * dt;
			mesh.rotation.y += shard.spin.y * dt;
			mesh.rotation.z += shard.spin.z * dt;
			const fade = 1 - age / BODYPART_TTL_MS;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(shard.id);
			live.push(shard);
		}
		shardsRef.current = live;
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
