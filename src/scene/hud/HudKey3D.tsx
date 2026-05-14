import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { OBJEXOOM_PALETTE, ROLE } from "../../design-tokens";

/**
 * E10 step-1 — screen-space 3D key indicator for the HUD.
 *
 * Renders a small procedurally-built spinning key in a fixed-size
 * Canvas above the HUD's "KEY ACQUIRED" / "FIND THE KEY" text. The
 * key uses Three.js primitives (cylinder shaft + torus head + box
 * teeth) so we don't depend on an unwired GLB.
 *
 * Damage-flash: when `flashing` is true, the material emissive ramps
 * from gold (collected-state) to red and back over ~250ms, driven by
 * `flashUntil` (a wall-clock deadline). The HUD parent supplies the
 * deadline via the prop on every player-hit event.
 *
 * Why a fresh r3f Canvas in HTML space vs. SVG: PRD §E10 specifies a
 * "3D" HUD element. R3F supports multi-Canvas mounts so the cost is a
 * second WebGL context; we keep it cheap by mounting only when
 * `hasKey` is true (no Canvas when there's no key).
 */
export function HudKey3D({ hasKey, flashUntil }: { hasKey: boolean; flashUntil: number }) {
	if (!hasKey) return null;
	return (
		<div
			data-testid="objexoom-hud-key-3d"
			style={{
				position: "absolute",
				top: 8,
				right: 12,
				width: 56,
				height: 56,
				pointerEvents: "none",
			}}
		>
			<Canvas
				camera={{ position: [0, 0, 3], fov: 45 }}
				gl={{ alpha: true, antialias: true }}
				style={{ background: "transparent" }}
			>
				<ambientLight intensity={0.6} />
				<directionalLight position={[2, 3, 2]} intensity={0.8} />
				<KeyMesh flashUntil={flashUntil} />
			</Canvas>
		</div>
	);
}

function KeyMesh({ flashUntil }: { flashUntil: number }) {
	const groupRef = useRef<THREE.Group>(null);
	const shaftMatRef = useRef<THREE.MeshStandardMaterial>(null);
	const headMatRef = useRef<THREE.MeshStandardMaterial>(null);
	useFrame(({ clock }) => {
		if (groupRef.current) {
			groupRef.current.rotation.y = clock.elapsedTime * 1.4;
			// Slight pitch wobble for a "floating" feel.
			groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 1.2) * 0.12;
		}
		const now = performance.now();
		const remaining = flashUntil - now;
		// 250ms flash window; intensity ramps linearly from 1 → 0.
		const flash = remaining > 0 ? Math.min(1, remaining / 250) : 0;
		const baseColor = new THREE.Color(OBJEXOOM_PALETTE.amber);
		const flashColor = new THREE.Color(ROLE.actionDamage);
		const lerped = baseColor.lerp(flashColor, flash);
		if (shaftMatRef.current) shaftMatRef.current.emissive.copy(lerped);
		if (headMatRef.current) headMatRef.current.emissive.copy(lerped);
	});
	return (
		<group ref={groupRef}>
			{/* Head (the ring at the top of the key). */}
			<mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[0.38, 0.1, 12, 24]} />
				<meshStandardMaterial
					ref={headMatRef}
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.5}
					roughness={0.3}
					metalness={0.9}
				/>
			</mesh>
			{/* Shaft */}
			<mesh position={[0, -0.05, 0]}>
				<cylinderGeometry args={[0.08, 0.08, 1.0, 12]} />
				<meshStandardMaterial
					ref={shaftMatRef}
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.5}
					roughness={0.3}
					metalness={0.9}
				/>
			</mesh>
			{/* Teeth — two small box bits at the bottom. */}
			<mesh position={[0.16, -0.5, 0]}>
				<boxGeometry args={[0.18, 0.1, 0.12]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.5}
					roughness={0.3}
					metalness={0.9}
				/>
			</mesh>
			<mesh position={[0.16, -0.65, 0]}>
				<boxGeometry args={[0.13, 0.08, 0.1]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.5}
					roughness={0.3}
					metalness={0.9}
				/>
			</mesh>
		</group>
	);
}
