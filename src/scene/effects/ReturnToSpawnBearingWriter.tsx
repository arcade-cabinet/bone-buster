import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { computeBearingRad, setReturnBearing } from "../hooks/returnBearing";

/**
 * PT4B-fold — return-to-spawn bearing writer.
 *
 * Computes the screen-space angle from the camera to the spawn each
 * frame and writes it to the module-scope `returnBearing` ref. The
 * GoingBackOverlay slot reads the ref every 250ms.
 *
 * Mounted in ObjexoomScene as a sibling to other scene effects. Only
 * meaningful during the going-back phase, but cheap enough to leave
 * mounted always — the write is a single trig call per frame.
 *
 * Clears the ref to null on unmount so a stale bearing from a prior
 * level doesn't leak into the next mount.
 */
export function ReturnToSpawnBearingWriter({ spawnX, spawnY }: { spawnX: number; spawnY: number }) {
	const camera = useThree((s) => s.camera);

	useFrame(() => {
		const angle = computeBearingRad(
			camera.rotation.y,
			camera.position.x,
			camera.position.z,
			spawnX,
			spawnY,
		);
		setReturnBearing(angle);
	});

	useEffect(() => {
		return () => {
			setReturnBearing(null);
		};
	}, []);

	return null;
}
