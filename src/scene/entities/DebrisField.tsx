import { useGLTF } from "@react-three/drei";
import { InstancedGltfField } from "@scene/render/InstancedField";
import { DEBRIS_VARIANTS } from "@world/debris";
import type { DebrisInstance } from "@world/scatter/debrisScatter";
import { useMemo } from "react";

/**
 * COV5 step-2 — renders the per-map debris scatter.
 *
 * A1-corridor migration: previously mounted one cloned `<primitive>`
 * per instance (N draw calls, N React nodes, N SkeletonUtils.clones).
 * Now groups instances by `url` and renders each group through
 * InstancedGltfField — one InstancedMesh per url, all instances of
 * that url drawn in a single draw call via setMatrixAt.
 *
 * Group cap = 64 per url (matches DENSITY_BY_ARCHETYPE upper bounds
 * with headroom; corridor's [2,4] x sectors stays well under 64).
 */
const MAX_PER_URL = 64;

export function DebrisField({ debris }: { debris: readonly DebrisInstance[] }) {
	const groups = useMemo(() => {
		const byUrl = new Map<string, DebrisInstance[]>();
		for (const inst of debris) {
			let bucket = byUrl.get(inst.url);
			if (!bucket) {
				bucket = [];
				byUrl.set(inst.url, bucket);
			}
			bucket.push(inst);
		}
		return Array.from(byUrl.entries());
	}, [debris]);

	return (
		<>
			{groups.map(([url, instances]) => (
				<InstancedGltfField key={url} url={url} instances={instances} maxInstances={MAX_PER_URL} />
			))}
		</>
	);
}

// A4 — tier 3 (deferred). Debris is visual flavor in sector bodies
// — not strictly needed for the first frame.
export function preloadDebris(): void {
	for (const url of DEBRIS_VARIANTS) useGLTF.preload(url);
}
