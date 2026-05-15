/**
 * STO1a — settings-blob validation contract.
 *
 * Pins the shape-coercion rules so a future change to ObjexoomSettings
 * (new field, renamed difficulty, etc) trips the test before silently
 * shipping a blob-format break.
 */

import { describe, expect, it } from "vitest";
import { validateSettings } from "@/persistence/settingsStore";
import { DEFAULT_SETTINGS } from "@/settings";

describe("STO1a — validateSettings", () => {
	it("returns DEFAULT_SETTINGS for null", () => {
		expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
	});

	it("returns DEFAULT_SETTINGS for non-object scalar", () => {
		expect(validateSettings(42)).toEqual(DEFAULT_SETTINGS);
		expect(validateSettings("string")).toEqual(DEFAULT_SETTINGS);
		expect(validateSettings(true)).toEqual(DEFAULT_SETTINGS);
	});

	it("round-trips a fully valid blob", () => {
		const valid = {
			difficulty: "nightmare",
			level: 3,
			soundEnabled: false,
			mouseSensitivity: 1.7,
			touchLookSensitivity: 2.2,
		};
		expect(validateSettings(valid)).toEqual(valid);
	});

	it("coerces stringified level numerals from JSON round-trip", () => {
		// JSON.stringify(3) === "3"; if the level somehow comes back as
		// a string (e.g. from a corrupted manual edit), coerce it back
		// to the numeric LevelChoice rather than rejecting.
		expect(validateSettings({ ...DEFAULT_SETTINGS, level: "3" }).level).toBe(3);
	});

	it("accepts 'procedural' level", () => {
		expect(validateSettings({ ...DEFAULT_SETTINGS, level: "procedural" }).level).toBe("procedural");
	});

	it("clamps mouseSensitivity into [0.5, 2.5]", () => {
		expect(validateSettings({ ...DEFAULT_SETTINGS, mouseSensitivity: 999 }).mouseSensitivity).toBe(
			2.5,
		);
		expect(validateSettings({ ...DEFAULT_SETTINGS, mouseSensitivity: -3 }).mouseSensitivity).toBe(
			0.5,
		);
	});

	it("clamps touchLookSensitivity into [0.5, 4]", () => {
		expect(
			validateSettings({ ...DEFAULT_SETTINGS, touchLookSensitivity: 999 }).touchLookSensitivity,
		).toBe(4);
		expect(
			validateSettings({ ...DEFAULT_SETTINGS, touchLookSensitivity: -3 }).touchLookSensitivity,
		).toBe(0.5);
	});

	it("falls back per-field for partial blobs", () => {
		const partial = { difficulty: "ultraViolence" };
		const out = validateSettings(partial);
		expect(out.difficulty).toBe("ultraViolence");
		expect(out.level).toBe(DEFAULT_SETTINGS.level);
		expect(out.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
	});

	it("rejects unknown difficulty values", () => {
		expect(validateSettings({ difficulty: "godmode" }).difficulty).toBe(
			DEFAULT_SETTINGS.difficulty,
		);
	});

	it("rejects out-of-range level values", () => {
		expect(validateSettings({ level: 99 }).level).toBe(DEFAULT_SETTINGS.level);
		expect(validateSettings({ level: 0 }).level).toBe(DEFAULT_SETTINGS.level);
	});

	it("rejects non-boolean soundEnabled", () => {
		// JSON allows "true"/"false" strings but the live schema is a
		// strict boolean — coerce to default rather than parse the
		// stringly typed value.
		expect(validateSettings({ soundEnabled: "true" }).soundEnabled).toBe(
			DEFAULT_SETTINGS.soundEnabled,
		);
	});
});
