import { useGLTF } from "@react-three/drei";
import { InstancedGltfField } from "@scene/render/InstancedField";
import { KITCHEN_PROPS } from "@world/kitchen";
import type { KitchenInstance } from "@world/scatter/kitchenScatter";
import { useMemo } from "react";

/**
 * COV13 step-2 — kitchen-prop scatter renderer (library archetype only).
 *
 * A1-library migration: groups instances by `url` and renders each
 * group through InstancedGltfField — one InstancedMesh per url,
 * one draw call per group. Same shape as the corridor slice's
 * DebrisField migration.
 *
 * Per-map kitchen density is low (~6 instances max across the
 * 20% sector opt-in × max 3 per sector × ~10 sectors); 16
 * per-url cap is comfortable.
 */
const MAX_PER_URL = 16;

export function KitchenField({ props }: { props: readonly KitchenInstance[] }) {
	const groups = useMemo(() => {
		const byUrl = new Map<string, KitchenInstance[]>();
		for (const inst of props) {
			let bucket = byUrl.get(inst.url);
			if (!bucket) {
				bucket = [];
				byUrl.set(inst.url, bucket);
			}
			bucket.push(inst);
		}
		return Array.from(byUrl.entries());
	}, [props]);

	return (
		<>
			{groups.map(([url, instances]) => (
				<InstancedGltfField key={url} url={url} instances={instances} maxInstances={MAX_PER_URL} />
			))}
		</>
	);
}

// A4 — tier 3 (deferred). Kitchen scatter is library-archetype
// only (20% of library sectors); first-frame is fine without it.
export function preloadKitchenProps(): void {
	for (const url of KITCHEN_PROPS) useGLTF.preload(url);
}
