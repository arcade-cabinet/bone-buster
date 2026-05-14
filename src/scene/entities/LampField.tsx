import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import type { LampInstance } from "../../lampScatter";
import { LAMP_VARIANTS_OFF, LAMP_VARIANTS_ON, lampUrlFor } from "../../lampScatter";

/**
 * COV1 + E4 — renders the per-map lamp scatter. Each LampInstance gets
 * a cloned mesh at its world position; lit instances (`on: true`) also
 * get a scoped shadow-mapped pointLight floating just above the lamp
 * mesh. Lamps past the MAX_LIT_LAMPS cap render with the OFF variant
 * and contribute zero per-frame light cost.
 *
 * The clone-per-instance pattern matches BarrelMesh/EnemyMesh: drei's
 * useGLTF returns a shared scene graph that mutations would leak
 * across consumers; SkeletonUtils.clone gives each mount its own
 * traversable tree.
 *
 * E4 design notes:
 *  - distance=6 + decay=1.8 — the lamp pool itself is small geometry,
 *    so the light's falloff matches the visible bloom region without
 *    fighting the global ambient.
 *  - castShadow with a 512² shadow map (mobile-friendly default;
 *    matches Flashlight's stated 1024² for the more important key
 *    light).
 *  - The "don't double-light the lamp" rule: lit lamps render the ON
 *    GLB variant which has self-emissive material; the pointLight
 *    sits 1.4 units above the lamp base so it bathes the floor and
 *    walls but doesn't add to the emissive surface itself. The flashlight
 *    (a SpotLight) only adds throughput for diffuse hits, so the
 *    emissive surface stays at its natural luminance regardless of
 *    flashlight aim.
 */
export function LampField({ lamps }: { lamps: readonly LampInstance[] }) {
	return (
		<>
			{lamps.map((lamp) => (
				<LampMesh key={lamp.id} lamp={lamp} />
			))}
		</>
	);
}

function LampMesh({ lamp }: { lamp: LampInstance }) {
	const url = lampUrlFor(lamp);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[lamp.position.x, 0, lamp.position.y]}>
			<primitive object={cloned} />
			{lamp.on ? (
				<pointLight
					position={[0, 1.4, 0]}
					color={OBJEXOOM_PALETTE.flashlightWarm}
					intensity={1.6}
					distance={6}
					decay={1.8}
					castShadow
					shadow-mapSize-width={512}
					shadow-mapSize-height={512}
					shadow-bias={-0.0005}
				/>
			) : null}
		</group>
	);
}

// Preload both off + on variants so the first lamp doesn't stall the
// render loop. The on/off symmetry means flipping the `on` flag at
// runtime (E4) won't hit a cold fetch either. The URLs already flow
// through assetUrl.A() inside lampScatter.ts.
for (const url of [...LAMP_VARIANTS_OFF, ...LAMP_VARIANTS_ON]) {
	useGLTF.preload(url);
}
