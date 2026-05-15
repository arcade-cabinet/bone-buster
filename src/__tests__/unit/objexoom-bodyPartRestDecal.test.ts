import { describe, expect, it } from "vitest";

/**
 * POL40 — body-part rest decals. The settledAt transition contract
 * is verifiable as a pure function: at the motion→settle boundary
 * (age >= MOTION_MS), capture the shard's current XZ and never
 * recapture it. These tests replicate the inline guard in
 * BodyPartField.tsx so the contract is pinned without mounting r3f.
 */

const MOTION_MS = 800;

type Shard = {
	pos: { x: number; y: number; z: number };
	createdAt: number;
	settledAt: { x: number; z: number } | null;
};

function applyTick(shard: Shard, now: number): Shard {
	const age = now - shard.createdAt;
	if (age >= MOTION_MS && shard.settledAt === null) {
		return { ...shard, settledAt: { x: shard.pos.x, z: shard.pos.z } };
	}
	return shard;
}

describe("POL40 body-part rest decal transition", () => {
	it("does not capture settledAt during the motion window", () => {
		const shard: Shard = {
			pos: { x: 5, y: 0.1, z: 7 },
			createdAt: 1000,
			settledAt: null,
		};
		expect(applyTick(shard, 1000).settledAt).toBeNull(); // t=0
		expect(applyTick(shard, 1400).settledAt).toBeNull(); // t=400ms
		expect(applyTick(shard, 1799).settledAt).toBeNull(); // t=799ms (just before)
	});

	it("captures settledAt exactly at the motion→settle boundary (age === MOTION_MS)", () => {
		const shard: Shard = {
			pos: { x: 5, y: 0.1, z: 7 },
			createdAt: 1000,
			settledAt: null,
		};
		const ticked = applyTick(shard, 1800); // age = 800
		expect(ticked.settledAt).toEqual({ x: 5, z: 7 });
	});

	it("captures settledAt during the settle phase if it hasn't been captured yet", () => {
		const shard: Shard = {
			pos: { x: 5, y: 0.1, z: 7 },
			createdAt: 1000,
			settledAt: null,
		};
		const ticked = applyTick(shard, 3000); // age = 2000 (well into settle)
		expect(ticked.settledAt).toEqual({ x: 5, z: 7 });
	});

	it("does NOT re-capture settledAt once captured (one-shot per shard)", () => {
		const shard: Shard = {
			pos: { x: 5, y: 0.1, z: 7 },
			createdAt: 1000,
			settledAt: { x: 3, z: 4 }, // already captured at different position
		};
		const ticked = applyTick(shard, 3000);
		// settledAt must remain the original capture, NOT update to current pos
		expect(ticked.settledAt).toEqual({ x: 3, z: 4 });
	});

	it("uses the shard's current XZ at capture moment (not the initial spawn position)", () => {
		const shard: Shard = {
			pos: { x: 8.5, y: 0.1, z: 12.3 }, // shard drifted from origin during motion
			createdAt: 1000,
			settledAt: null,
		};
		const ticked = applyTick(shard, 1800);
		expect(ticked.settledAt).toEqual({ x: 8.5, z: 12.3 });
	});
});
