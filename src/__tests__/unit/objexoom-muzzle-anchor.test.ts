/**
 * PA-MOD7 / D11 — muzzle-anchor authoring contract.
 *
 * The WeaponViewmodel resolves `muzzleBboxFrac` against each GLB's
 * runtime Box3 to position the muzzle-flash point light at the barrel
 * tip. These tests pin the authoring rules so a typo (e.g. a frac > 1
 * or a frac of all 0.5 — the bbox center, NOT a barrel tip) trips a
 * red unit test instead of shipping a flash inside the grip.
 */

import { describe, expect, it } from "vitest";
import { WEAPON_MODELS } from "../../models";
import { WEAPONS } from "../../weapons";

describe("PA-MOD7 — muzzleBboxFrac authoring contract", () => {
	it("every wired weapon has a muzzleBboxFrac", () => {
		for (const id of Object.keys(WEAPONS) as Array<keyof typeof WEAPONS>) {
			const model = WEAPON_MODELS[id];
			expect(model.muzzleBboxFrac, `${id} missing muzzleBboxFrac`).toBeDefined();
			expect(model.muzzleBboxFrac).toHaveLength(3);
		}
	});

	it("every muzzleBboxFrac component is in [0, 1]", () => {
		for (const [id, model] of Object.entries(WEAPON_MODELS)) {
			for (let i = 0; i < 3; i += 1) {
				const v = model.muzzleBboxFrac[i];
				expect(v, `${id} muzzleBboxFrac[${i}]=${v} out of [0,1]`).toBeGreaterThanOrEqual(0);
				expect(v, `${id} muzzleBboxFrac[${i}]=${v} out of [0,1]`).toBeLessThanOrEqual(1);
			}
		}
	});

	it("every weapon's muzzle is at the tip on at least one axis (frac ≥ 0.9)", () => {
		// If every axis were near 0.5, the "muzzle" would be the bbox
		// center — that's the grip on a pistol, the body on a rifle.
		// Authoring rule: at least one axis is ≥ 0.9 (the long axis
		// where the barrel tip lives).
		for (const [id, model] of Object.entries(WEAPON_MODELS)) {
			const max = Math.max(...model.muzzleBboxFrac);
			expect(max, `${id} no axis ≥ 0.9 — muzzle is at bbox center, not tip`).toBeGreaterThanOrEqual(
				0.9,
			);
		}
	});

	it("the non-tip axes stay near center (frac in [0.3, 0.7])", () => {
		// The two non-tip axes (perpendicular to the barrel) should
		// stay near the bbox center, otherwise the flash sits above
		// or beside the visible barrel.
		for (const [id, model] of Object.entries(WEAPON_MODELS)) {
			const sorted = [...model.muzzleBboxFrac].sort((a, b) => b - a);
			const [, mid, lo] = sorted;
			expect(mid, `${id} second-tip axis frac=${mid} should be near center`).toBeGreaterThanOrEqual(
				0.3,
			);
			expect(mid, `${id} second-tip axis frac=${mid} should be near center`).toBeLessThanOrEqual(
				0.7,
			);
			expect(lo, `${id} third-tip axis frac=${lo} should be near center`).toBeGreaterThanOrEqual(
				0.3,
			);
			expect(lo, `${id} third-tip axis frac=${lo} should be near center`).toBeLessThanOrEqual(0.7);
		}
	});

	it("bbox-frac resolves to a non-degenerate world position", () => {
		// Pure-math equivalent of what WeaponViewmodel's useMemo does:
		// muzzleNative = lerp(bboxMin, bboxMax, muzzleBboxFrac).
		// We only need to verify the lerp produces a vector distinct
		// from the bbox center (the prior camera-attached behavior).
		const cases: Array<{
			id: string;
			min: [number, number, number];
			max: [number, number, number];
		}> = [
			// pistol: long axis Z = 1.47, barrel forward = +Z
			{ id: "pistol", min: [-0.17, -0.26, -0.08], max: [0.17, 0.39, 1.39] },
			// chaingun: long axis X = 1.19
			{ id: "chaingun", min: [-0.03, -0.22, -0.07], max: [1.16, 0.14, 0.07] },
			// shotgun: long axis Z = 1.39, barrel forward = +Z
			{ id: "shotgun", min: [-0.05, -0.13, -0.85], max: [0.05, 0.1, 0.54] },
		];
		for (const { id, min, max } of cases) {
			const model = WEAPON_MODELS[id as keyof typeof WEAPON_MODELS];
			const [fx, fy, fz] = model.muzzleBboxFrac;
			const muzzle: [number, number, number] = [
				min[0] + (max[0] - min[0]) * fx,
				min[1] + (max[1] - min[1]) * fy,
				min[2] + (max[2] - min[2]) * fz,
			];
			const center: [number, number, number] = [
				(min[0] + max[0]) * 0.5,
				(min[1] + max[1]) * 0.5,
				(min[2] + max[2]) * 0.5,
			];
			// Tip-displacement on the long axis should be > 30% of half-span.
			let maxDelta = 0;
			for (let i = 0; i < 3; i += 1) {
				const span = (max[i] - min[i]) * 0.5;
				const delta = Math.abs(muzzle[i] - center[i]);
				if (span > 0) maxDelta = Math.max(maxDelta, delta / span);
			}
			expect(
				maxDelta,
				`${id} muzzle is too close to bbox center (delta=${maxDelta.toFixed(2)} of half-span)`,
			).toBeGreaterThan(0.3);
		}
	});
});
