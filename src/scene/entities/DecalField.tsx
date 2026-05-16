import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { DECAL_VARIANTS_ALL } from "../../decals";
import type { DecalInstance } from "../../scatter/decalScatter";

/**
 * COV6 step-2.1 — wall-quad billboard decal renderer.
 *
 * Step-2 mounted the decal GLBs raw and ran into a "decal is a full
 * Blender export with its own scale + origin" problem — they read as
 * view-blocking meshes instead of flat decals.
 *
 * Step-2.1 fix: extract the GLB's primary diffuse texture and apply
 * it to a flat `<planeGeometry>` sized 1.2×0.8 world units (a
 * believable graffiti/poster footprint). The plane is oriented by
 * the DecalInstance's yaw which aligns it parallel to the wall face.
 * No clone-per-instance needed because the geometry is fully owned
 * by THREE primitives — only the material+texture are shared with
 * the cached GLTF tree (read-only on textures is fine).
 */
export function DecalField({ decals }: { decals: readonly DecalInstance[] }) {
	return (
		<>
			{decals.map((inst) => (
				<DecalQuad key={inst.id} inst={inst} />
			))}
		</>
	);
}

function DecalQuad({ inst }: { inst: DecalInstance }) {
	const gltf = useGLTF(inst.url);
	const texture = useMemo(() => extractFirstTexture(gltf.scene), [gltf.scene]);
	if (!texture) return null;
	return (
		<mesh position={[inst.position.x, inst.y, inst.position.y]} rotation={[0, inst.yaw, 0]}>
			<planeGeometry args={[1.2, 0.8]} />
			<meshStandardMaterial
				map={texture}
				transparent
				alphaTest={0.5}
				side={THREE.DoubleSide}
				toneMapped={false}
			/>
		</mesh>
	);
}

function extractFirstTexture(root: THREE.Object3D): THREE.Texture | null {
	let found: THREE.Texture | null = null;
	root.traverse((obj) => {
		if (found) return;
		const mesh = obj as THREE.Mesh;
		const mat = mesh.material as
			| THREE.MeshStandardMaterial
			| THREE.MeshStandardMaterial[]
			| undefined;
		if (!mat) return;
		const mats = Array.isArray(mat) ? mat : [mat];
		for (const m of mats) {
			if (m.map) {
				found = m.map;
				return;
			}
		}
	});
	return found;
}

// A4 — tier 3 (deferred). Decals are flavor on walls/floors —
// not visible until the player gets close to a textured surface.
export function preloadDecals(): void {
	for (const url of DECAL_VARIANTS_ALL) useGLTF.preload(url);
}
