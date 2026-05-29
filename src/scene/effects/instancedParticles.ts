/**
 * CR-H1perf — shared InstancedMesh helper for the particle effect fields
 * (ParticleBurstField / ShellEjectField / BodyPartField).
 *
 * Before this, each field rendered one `THREE.Mesh` + one
 * `MeshStandardMaterial` PER PARTICLE — up to ~350 individual draw calls
 * during heavy combat on the GPU-draw-call-bound mobile target. This
 * collapses each field to ONE `InstancedMesh` (1 draw call) with:
 *   - per-instance transform via setMatrixAt (position + uniform scale)
 *   - per-instance color via setColorAt (instanceColor)
 *   - per-instance OPACITY via a custom `instanceAlpha` InstancedBufferAttribute
 *     injected into the standard material with onBeforeCompile, so motes/
 *     shells/shards can still fade independently (the one thing vanilla
 *     InstancedMesh can't do).
 *
 * The material is shared module-scope per field; geometry is the field's
 * existing shared geometry. Nothing is per-instance-allocated.
 */

import * as THREE from "three";

const SCRATCH_MATRIX = /*@__PURE__*/ new THREE.Matrix4();
const SCRATCH_POS = /*@__PURE__*/ new THREE.Vector3();
const SCRATCH_QUAT = /*@__PURE__*/ new THREE.Quaternion();
const SCRATCH_SCALE = /*@__PURE__*/ new THREE.Vector3();
const SCRATCH_EULER = /*@__PURE__*/ new THREE.Euler();

/**
 * Build a MeshStandardMaterial that reads a per-instance `instanceAlpha`
 * attribute and multiplies it into the fragment alpha. `transparent` so the
 * fade renders; `depthWrite` off so overlapping translucent particles don't
 * occlude each other with hard edges.
 */
export function makeInstancedAlphaMaterial(
	opts: Readonly<{
		emissiveIntensity?: number;
		metalness?: number;
		roughness?: number;
	}> = {},
): THREE.MeshStandardMaterial {
	const mat = new THREE.MeshStandardMaterial({
		transparent: true,
		depthWrite: false,
		emissiveIntensity: opts.emissiveIntensity ?? 1,
		metalness: opts.metalness ?? 0,
		roughness: opts.roughness ?? 0.7,
		// vertexColors lets instanceColor drive both color + emissive tint.
		vertexColors: true,
	});
	mat.onBeforeCompile = (shader) => {
		shader.vertexShader =
			`attribute float instanceAlpha;\nvarying float vInstanceAlpha;\n${shader.vertexShader}`.replace(
				"#include <begin_vertex>",
				"#include <begin_vertex>\n\tvInstanceAlpha = instanceAlpha;",
			);
		shader.fragmentShader = `varying float vInstanceAlpha;\n${shader.fragmentShader}`.replace(
			"#include <dithering_fragment>",
			"#include <dithering_fragment>\n\tgl_FragColor.a *= vInstanceAlpha;",
		);
	};
	return mat;
}

/**
 * Wraps an InstancedMesh + its per-instance alpha attribute, exposing a
 * tiny write API the fields call once per live particle each frame, then
 * `commit(count)` to flag the GPU uploads + set the draw count.
 */
export class InstancedParticlePool {
	readonly mesh: THREE.InstancedMesh;
	readonly #alpha: THREE.InstancedBufferAttribute;
	readonly #color = new THREE.Color();

	constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
		this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
		this.mesh.frustumCulled = false; // particles are camera-local + short-lived
		this.mesh.count = 0;
		// instanceColor is lazily created by setColorAt; pre-create so the
		// attribute exists from frame 0.
		this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
		const alphaArr = new Float32Array(capacity);
		this.#alpha = new THREE.InstancedBufferAttribute(alphaArr, 1);
		this.#alpha.setUsage(THREE.DynamicDrawUsage);
		this.mesh.geometry.setAttribute("instanceAlpha", this.#alpha);
		this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	}

	/** Write one instance's transform + color + alpha at slot `i`. */
	write(
		i: number,
		x: number,
		y: number,
		z: number,
		scale: number,
		colorHex: number,
		alpha: number,
		rotX = 0,
		rotY = 0,
		rotZ = 0,
	): void {
		SCRATCH_POS.set(x, y, z);
		SCRATCH_EULER.set(rotX, rotY, rotZ);
		SCRATCH_QUAT.setFromEuler(SCRATCH_EULER);
		SCRATCH_SCALE.setScalar(scale);
		SCRATCH_MATRIX.compose(SCRATCH_POS, SCRATCH_QUAT, SCRATCH_SCALE);
		this.mesh.setMatrixAt(i, SCRATCH_MATRIX);
		this.#color.setHex(colorHex);
		this.mesh.setColorAt(i, this.#color);
		this.#alpha.setX(i, alpha);
	}

	/** Flag the GPU uploads + set how many instances draw this frame. */
	commit(count: number): void {
		this.mesh.count = count;
		this.mesh.instanceMatrix.needsUpdate = true;
		if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
		this.#alpha.needsUpdate = true;
	}

	/** Dispose the InstancedMesh (geometry + material are caller-owned shared). */
	dispose(): void {
		this.mesh.dispose();
	}
}
