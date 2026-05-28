import type { Enemy } from "@engine/mapTypes";
import { useFrame, useThree } from "@react-three/fiber";
import { isInUvCone } from "@world/ghostHunting";
import { useEffect } from "react";
import type * as THREE from "three";

/**
 * PC3 — UV-reveal slot. Per-frame visibility toggle for one
 * uvHidden enemy.
 *
 * Mounted as a sibling to `<EnemyMesh>` under a shared per-enemy
 * `<group>` only when:
 *   - the player owns the UV flashlight (hasUvFlashlight === true)
 *   - the enemy is tagged `uvHidden`
 *   - the enemy is non-boss (gated upstream — bosses never hide)
 *
 * Reads the mesh from the shared `meshLookup` map (same pattern as
 * EnemyHitFlash). Sets `mesh.visible = false` by default; flips
 * true whenever the UV cone contains the enemy's XZ position.
 *
 * When the player does NOT own the UV flashlight, this slot is
 * NOT mounted by the parent — so the visibility stays at whatever
 * the default-untouched value is (which is `true` per three.js
 * defaults). To ensure uvHidden enemies stay hidden in that case,
 * the parent applies a baseline `mesh.visible = false` via a
 * separate `<EnemyUvBaseHide>` slot — but only when the player
 * has NOT acquired the UV flashlight yet. The two slots are
 * mutually exclusive: pre-UV-pickup, baseline-hide is mounted;
 * post-UV-pickup, reveal is mounted.
 *
 * Why split: keeps the per-frame cost off the no-tool path
 * entirely. A player who never picks up the UV flashlight pays
 * zero per-frame UV cost — only one mount-time `visible = false`
 * assignment.
 */
export function EnemyUvReveal({
	enemy,
	meshLookup,
}: {
	enemy: Enemy;
	meshLookup: { current: Map<number, THREE.Group> };
}) {
	const camera = useThree((s) => s.camera);

	useFrame(() => {
		const mesh = meshLookup.current.get(enemy.id);
		if (!mesh) return;
		if (enemy.dead) {
			// Once dead, the enemy stays revealed for the death animation
			// + body-parts dispatch. The kill-shot path is the player's
			// signal that the reveal worked.
			mesh.visible = true;
			return;
		}
		// camera-forward in XZ — derive from quaternion.
		// Three.js cameras face -Z in local space; world-forward is the
		// negated Z column of the orientation matrix.
		const matrix = camera.matrixWorld;
		const forwardX = -matrix.elements[8];
		const forwardZ = -matrix.elements[10];
		// Normalize the XZ forward — the camera's pitch component
		// (Y) is intentionally dropped so the UV cone is horizontal.
		const len = Math.hypot(forwardX, forwardZ) || 1;
		const fx = forwardX / len;
		const fz = forwardZ / len;
		const revealed = isInUvCone(
			camera.position.x,
			camera.position.z,
			fx,
			fz,
			enemy.position.x,
			enemy.position.y,
		);
		mesh.visible = revealed;
	});

	return null;
}

/**
 * PC3 — baseline-hide slot. Mounted for uvHidden non-boss enemies
 * when the player does NOT own the UV flashlight. Sets
 * `mesh.visible = false` exactly once at mount and keeps it that
 * way for the lifetime of the slot.
 *
 * Decoupled from EnemyUvReveal so the cost split between the
 * "has UV" path (per-frame check) and the "no UV" path (one-shot
 * hide) is explicit. The parent component swaps which one is
 * mounted based on hasUvFlashlight.
 */
export function EnemyUvBaseHide({
	enemy,
	meshLookup,
}: {
	enemy: Enemy;
	meshLookup: { current: Map<number, THREE.Group> };
}) {
	useEffect(() => {
		const mesh = meshLookup.current.get(enemy.id);
		if (!mesh) {
			// Mesh not registered yet — wait a frame via rAF then retry.
			// The EnemyMesh mount happens in the same render pass but
			// the register callback fires in useEffect, so by the time
			// this useEffect runs the mesh SHOULD be there. Defensive
			// rAF fallback in case of mount-order race.
			const raf = window.requestAnimationFrame(() => {
				const late = meshLookup.current.get(enemy.id);
				if (late) late.visible = false;
			});
			return () => window.cancelAnimationFrame(raf);
		}
		mesh.visible = false;
	}, [enemy.id, meshLookup]);

	useEffect(() => {
		// When this slot unmounts (the player just picked up the UV
		// flashlight, so the parent switched to EnemyUvReveal), restore
		// visibility so the reveal slot can take over without leaving
		// the mesh stuck-hidden.
		const lookup = meshLookup;
		const id = enemy.id;
		return () => {
			const mesh = lookup.current.get(id);
			if (mesh) mesh.visible = true;
		};
	}, [enemy.id, meshLookup]);

	return null;
}
