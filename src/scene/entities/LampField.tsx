import { useGLTF } from "@react-three/drei";
import { groupByUrl, InstancedMultiGltfField } from "@scene/render/InstancedField";
import type { LampInstance } from "@world/lampScatter";
import { LAMP_VARIANTS_OFF, LAMP_VARIANTS_ON, lampUrlFor } from "@world/lampScatter";
import { useMemo } from "react";
import { SkeletonUtils } from "three-stdlib";

/**
 * COV1 + E4 / PT3 — renders the per-map lamp scatter.
 *
 * PT3 splits the field into two halves:
 *   - Unlit lamps (the bulk; everything past the MAX_LIT_LAMPS=8 cap)
 *     instance through `InstancedMultiGltfField` grouped by GLB url.
 *     No per-lamp scene-graph children needed.
 *   - Lit lamps (≤ MAX_LIT_LAMPS) stay per-mesh because each needs a
 *     scoped `<pointLight>` child positioned just above the bulb.
 *     `InstancedMesh` can't carry per-instance children of arbitrary
 *     types (lights, sound emitters, etc), so the lit subset uses
 *     the original cloned `<primitive>` pattern.
 *
 * The lit/unlit split is per-lamp, not per-url — two lamps of the
 * same variant can land in different halves. We pre-partition once
 * via `useMemo` so the per-render filter is amortized.
 *
 * E13 step-9: lit-half pointLight color is archetype-keyed via the
 * `lightColor` prop (e.g. corridor → flashlightWarm).
 */
export function LampField({
	lamps,
	lightColor,
}: {
	lamps: readonly LampInstance[];
	lightColor: string;
}) {
	const { lit, unlitGroups } = useMemo(() => {
		const litOnly: LampInstance[] = [];
		const unlitOnly: LampInstance[] = [];
		for (const lamp of lamps) {
			(lamp.on ? litOnly : unlitOnly).push(lamp);
		}
		return {
			lit: litOnly,
			unlitGroups: groupByUrl(unlitOnly, (l) => lampUrlFor(l)),
		};
	}, [lamps]);

	return (
		<>
			{/* PT3 unlit half — one InstancedMultiGltfField per variant url. */}
			{unlitGroups.map(([url, items]) => (
				<InstancedMultiGltfField
					key={url}
					url={url}
					instances={items.map((lamp) => ({
						id: lamp.id,
						position: lamp.position,
						yaw: 0,
					}))}
					maxInstances={32}
				/>
			))}
			{/* PT3 lit half — per-lamp <group> so the pointLight child lands at world space. */}
			{lit.map((lamp) => (
				<LitLampMesh key={lamp.id} lamp={lamp} lightColor={lightColor} />
			))}
		</>
	);
}

function LitLampMesh({ lamp, lightColor }: { lamp: LampInstance; lightColor: string }) {
	const url = lampUrlFor(lamp);
	const gltf = useGLTF(url);
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	return (
		<group position={[lamp.position.x, 0, lamp.position.y]}>
			<primitive object={cloned} />
			<pointLight
				position={[0, 1.4, 0]}
				color={lightColor}
				intensity={1.6}
				distance={6}
				decay={1.8}
				// QW2 — castShadow dropped. Static lamps; the directional
				// sun + flashlight cover the gameplay-relevant shadow
				// signal.
			/>
		</group>
	);
}

// A4 — tier 2 (map-mount). Lamps are part of the first-frame
// lighting set. Off + On variants both preloaded so E4 runtime
// flips don't hit a cold fetch.
export function preloadLamps(): void {
	for (const url of [...LAMP_VARIANTS_OFF, ...LAMP_VARIANTS_ON]) {
		useGLTF.preload(url);
	}
}
