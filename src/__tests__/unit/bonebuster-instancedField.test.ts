/**
 * CORRIDOR / A1 + A2 — InstancedField + EphemeralPool factory contracts.
 *
 * The render path can't be exercised in unit-mode (no WebGL), so
 * these tests pin the pure-fn surface:
 *   - composeInstanceMatrix produces the expected (position, yaw,
 *     scale) world transform.
 *   - composeExpiredMatrix produces a det=0 matrix so the GPU
 *     skips the slot.
 *   - allocSlot reclaims expired slots, extends the pool when no
 *     expired slots, returns -1 when full.
 */

import type { EphemeralPoolSlot } from "@scene/render/EphemeralPool";
import { allocSlot, composeExpiredMatrix } from "@scene/render/EphemeralPool";
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

describe("A2 — composeExpiredMatrix", () => {
	it("produces a zero-scale matrix (det = 0 → GPU skips)", () => {
		const m = composeExpiredMatrix();
		// determinant of a scale-0 matrix is 0; three.js's determinant()
		// returns the geometric determinant.
		expect(m.determinant()).toBeCloseTo(0);
	});
});

describe("A2 — allocSlot lifecycle", () => {
	function slot(id: number, expired: boolean): EphemeralPoolSlot {
		return { id, position: { x: 0, y: 0 }, yaw: 0, expired };
	}

	it("returns the first expired slot's index when any expired exist", () => {
		const slots = [slot(0, false), slot(1, true), slot(2, false)];
		expect(allocSlot(slots, 8)).toBe(1);
	});

	it("returns the length (extension) when no expired and pool not full", () => {
		const slots = [slot(0, false), slot(1, false)];
		expect(allocSlot(slots, 8)).toBe(2);
	});

	it("returns -1 when pool is full and no expired slots", () => {
		const slots = [slot(0, false), slot(1, false), slot(2, false)];
		expect(allocSlot(slots, 3)).toBe(-1);
	});

	it("returns 0 for an empty pool with capacity", () => {
		expect(allocSlot([], 8)).toBe(0);
	});
});
