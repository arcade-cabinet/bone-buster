"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * J1 — flashlight. A SpotLight that lives at the camera position and
 * points along the camera-forward vector each frame. Cone ≈ 0.5 rad
 * half-angle (≈ 28° from center), range ~12 m, brightness 1.4 in the
 * weapon's ambient hue (parchment). The light target is also moved
 * each frame to a point 8 m ahead of the camera so the cone projects
 * where the player is looking.
 */
export function Flashlight() {
	const camera = useThree((s) => s.camera);
	const spotRef = useRef<THREE.SpotLight | null>(null);
	const targetRef = useRef<THREE.Object3D | null>(null);

	useFrame(() => {
		const spot = spotRef.current;
		const target = targetRef.current;
		if (!spot || !target) return;
		spot.position.copy(camera.position);
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
		target.position.set(
			camera.position.x + forward.x * 8,
			camera.position.y + forward.y * 8,
			camera.position.z + forward.z * 8,
		);
		spot.target = target;
	});

	return (
		<>
			<spotLight
				ref={spotRef}
				intensity={1.4}
				distance={12}
				angle={0.5}
				penumbra={0.3}
				decay={1.5}
				color="#fef3c7"
				castShadow
				shadow-mapSize={[1024, 1024]}
				shadow-camera-near={0.2}
				shadow-camera-far={14}
				shadow-bias={-0.0005}
			/>
			<object3D
				ref={(node) => {
					targetRef.current = node;
				}}
			/>
		</>
	);
}
