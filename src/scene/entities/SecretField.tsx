import { playDoor, playDoorTick } from "@audio/sfx";
import { addObjexoomListener } from "@engine/events";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import type { Secret } from "../../secrets";

/**
 * E6 — renders all secret switch decals + the wall blocks they lift.
 * Reads the same runtime state that the fire-resolution path mutates;
 * the switch's `triggered` flag drives the wall's lift animation.
 *
 * Hooks into the `secretTriggered` typed event (from src/events.ts)
 * for SFX cues — the actual state flip happens in fireResolution.ts
 * directly on the secret ref so visuals and audio stay in sync.
 */
export function SecretField({ secretsRef }: { secretsRef: { current: Secret[] } }) {
	// Force a re-render when a secret is triggered so the JSX picks up
	// the updated `triggered` flag (the lift animation is a ref-based
	// useFrame so it doesn't need this, but the mesh color flip does).
	const [, setTick] = useState(0);

	useEffect(() => {
		return addObjexoomListener("secretTriggered", () => {
			playDoor();
			playDoorTick();
			setTick((t) => t + 1);
		});
	}, []);

	return (
		<>
			{secretsRef.current.map((secret) => (
				<SecretSwitch key={`switch-${secret.id}`} secret={secret} />
			))}
			{secretsRef.current.map((secret) => (
				<SecretWall key={`wall-${secret.id}`} secret={secret} />
			))}
		</>
	);
}

function SecretSwitch({ secret }: { secret: Secret }) {
	const spec = secret.spec;
	const color = secret.triggered ? OBJEXOOM_PALETTE.actionPickupGlow : OBJEXOOM_PALETTE.violet;
	const emissive = secret.triggered ? OBJEXOOM_PALETTE.actionPickupGlow : OBJEXOOM_PALETTE.indigo;
	return (
		<mesh position={[spec.switchPosition.x, 1.2, spec.switchPosition.y]}>
			<boxGeometry args={[spec.switchRadius * 1.4, spec.switchRadius * 1.4, 0.12]} />
			<meshStandardMaterial
				color={color}
				emissive={emissive}
				emissiveIntensity={secret.triggered ? 1.2 : 0.6}
				roughness={0.4}
				metalness={0.1}
			/>
		</mesh>
	);
}

function SecretWall({ secret }: { secret: Secret }) {
	const spec = secret.spec;
	const meshRef = useRef<THREE.Mesh | null>(null);

	useFrame((_, dt) => {
		const m = meshRef.current;
		if (!m) return;
		const target = secret.triggered ? 1 : 0;
		const speed = 1 / 0.9; // 900 ms — matches RealDoor's pacing
		const delta =
			Math.sign(target - secret.liftProgress) *
			Math.min(Math.abs(target - secret.liftProgress), speed * dt);
		secret.liftProgress += delta;
		m.position.set(
			spec.wallPosition.x,
			spec.wallRestY + secret.liftProgress * spec.wallLiftY,
			spec.wallPosition.y,
		);
	});

	return (
		<mesh
			ref={(node) => {
				meshRef.current = node;
			}}
			position={[spec.wallPosition.x, spec.wallRestY, spec.wallPosition.y]}
		>
			<boxGeometry args={[spec.wallSize.x, 2.4, spec.wallSize.z]} />
			<meshStandardMaterial
				color={OBJEXOOM_PALETTE.wallVariantCool}
				emissive={OBJEXOOM_PALETTE.indigo}
				emissiveIntensity={0.18}
				roughness={0.55}
				metalness={0.2}
			/>
		</mesh>
	);
}
