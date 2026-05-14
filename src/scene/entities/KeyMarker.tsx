import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { ROLE } from "../../design-tokens";

/**
 * Floating amber torus marking the level's key pickup. Bobs + spins so
 * it reads against dark walls. `visible=false` hides it after the
 * player picks up the key (engine still tracks the position for the
 * door logic).
 */
export function KeyMarker({
	visible,
	position,
}: {
	visible: boolean;
	position: { x: number; y: number };
}) {
	const ref = useRef<THREE.Mesh | null>(null);
	useFrame((s) => {
		if (!ref.current) return;
		ref.current.rotation.y = s.clock.elapsedTime * 1.6;
		ref.current.position.y = 0.7 + Math.sin(s.clock.elapsedTime * 2.2) * 0.12;
	});
	return (
		<mesh ref={ref} position={[position.x, 0.7, position.y]} visible={visible}>
			<torusGeometry args={[0.28, 0.09, 8, 18]} />
			<meshStandardMaterial
				color={ROLE.actionKey}
				emissive={ROLE.actionKey}
				emissiveIntensity={0.95}
			/>
		</mesh>
	);
}
