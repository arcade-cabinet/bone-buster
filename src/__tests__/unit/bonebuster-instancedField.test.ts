/**
 * CORRIDOR / A1 — InstancedField factory contract.
 *
 * The render path can't be exercised in unit-mode (no WebGL), so
 * these tests pin the pure-fn surface:
 *   - composeInstanceMatrix produces the expected (position, yaw,
 *     scale) world transform.
 *
 * A2 (EphemeralPool) was shipped speculatively in the corridor
 * step-1 commit but had zero production callers + the slot model
 * doesn't fit the per-frame physics + per-mesh independent-opacity
 * shape of the actual ephemeral fields (ShellEject / BodyPart /
 * Bullet / ParticleBurst). It was deleted per the simplifier review
 * + the memory note `ephemeral-pool-not-instancing.md`. When a real
 * ephemeral migration needs pooling, the right design is an
 * InstancedBufferAttribute shader path — not this slot abstraction.
 */

import { composeInstanceMatrix } from "@scene/render/InstancedField";
import { describe, expect, it } from "vitest";

describe("A1 — composeInstanceMatrix", () => {
	it("encodes position as (x, 0, y) — y-axis is up, scatter is flat", () => {
		const m = composeInstanceMatrix({ id: 0, position: { x: 3, y: 5 }, yaw: 0 });
		const elements = m.elements;
		// Translation column (col 4): [x, y, z, 1] in column-major layout.
		expect(elements[12]).toBeCloseTo(3); // x
		expect(elements[13]).toBeCloseTo(0); // y up
		expect(elements[14]).toBeCloseTo(5); // z from input.y
	});

	it("encodes scale=1 by default", () => {
		const m = composeInstanceMatrix({ id: 0, position: { x: 0, y: 0 }, yaw: 0 });
		const elements = m.elements;
		// Diagonal of 3x3 rotation/scale block — with yaw=0, scale shows
		// on each axis. Since we used identity-rotation, each diagonal
		// entry is exactly the per-axis scale.
		expect(elements[0]).toBeCloseTo(1);
		expect(elements[5]).toBeCloseTo(1);
		expect(elements[10]).toBeCloseTo(1);
	});

	it("respects scale override", () => {
		const m = composeInstanceMatrix({ id: 0, position: { x: 0, y: 0 }, yaw: 0, scale: 2.5 });
		const elements = m.elements;
		expect(elements[0]).toBeCloseTo(2.5);
		expect(elements[5]).toBeCloseTo(2.5);
		expect(elements[10]).toBeCloseTo(2.5);
	});

	it("yaw=PI/2 rotates +X into +Z (right-handed, y-up)", () => {
		const m = composeInstanceMatrix({ id: 0, position: { x: 0, y: 0 }, yaw: Math.PI / 2 });
		const elements = m.elements;
		// 90° around y: x → z, z → -x. So element[0] (x-axis basis x-component)
		// goes from 1 to ~0; element[2] (x-axis basis z-component) goes from
		// 0 to 1.
		expect(elements[0]).toBeCloseTo(0, 5);
		expect(elements[2]).toBeCloseTo(-1, 5); // three.js sign convention
	});
});
