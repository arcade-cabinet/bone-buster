import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";
import type { LampInstance } from "../../lampScatter";
import { LAMP_VARIANTS_OFF, LAMP_VARIANTS_ON, lampUrlFor } from "../../lampScatter";

/**
 * COV1 + E4 — renders the per-map lamp scatter. Each LampInstance gets
 * a cloned mesh at its world position; lit instances (`on: true`) also
 * get a scoped shadow-mapped pointLight floating just above the lamp
 * mesh. Lamps past the MAX_LIT_LAMPS cap render with the OFF variant
 * and contribute zero per-frame light cost.
 *
 * E13 step-9: the pointLight color is now passed in (archetype-keyed
 * via `palette.lampLightColor`) so each archetype's lamps bathe the
 * scene in their own tint. Corridor still resolves to
 * `OBJEXOOM_PALETTE.flashlightWarm` so lamp-shadow byte-stability on
 * refLevel 0 is preserved.
 */
export function LampField({
	lamps,
	lightColor,
}: {
	lamps: readonly LampInstance[];
	lightColor: string;
}) {
	return (
		<>
			{lamps.map((lamp) => (
				<LampMesh key={lamp.id} lamp={lamp} lightColor={lightColor} />
			))}
		</>
	);
}

function LampMesh({ lamp, lightColor }: { lamp: LampInstance; lightColor: string }) {
	const url = lampUrlFor(lamp);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[lamp.position.x, 0, lamp.position.y]}>
			<primitive object={cloned} />
			{lamp.on ? (
				<pointLight
					position={[0, 1.4, 0]}
					color={lightColor}
					intensity={1.6}
					distance={6}
					decay={1.8}
					// QW2 — castShadow dropped. Each lit lamp was a 6-face
					// cubemap shadow pass at 512² per frame; for the
					// MAX_LIT_LAMPS=8 budget that's up to 48 shadow passes/
					// frame. The directional sun + flashlight cover the
					// gameplay-relevant shadow signal; static lamp positions
					// can't cast meaningful dynamic shadow anyway (no
					// moving casters within their distance=6 radius in
					// the typical sector). PERF audit #3.
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
