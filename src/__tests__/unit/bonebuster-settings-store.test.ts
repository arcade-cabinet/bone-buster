/**
 * STO1a — settings-blob validation contract.
 *
 * Pins the shape-coercion rules so a future change to BoneBusterSettings
 * (new field, renamed difficulty, etc) trips the test before silently
 * shipping a blob-format break.
 */

import { validateSettings } from "@platform/persistence/settingsStore";
import { DEFAULT_SETTINGS } from "@store/settings";
import { describe, expect, it } from "vitest";

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
			soundEnabled: false,
			mouseSensitivity: 1.7,
			touchLookSensitivity: 2.2,
			touchControls: "on" as const,
		};
		expect(validateSettings(valid)).toEqual(valid);
	});

	it("STRUCT1 — ignores a stale `level` field from a pre-migration blob", () => {
		// Old blobs carried a LevelChoice `level`; the schema dropped it. The
		// validator just doesn't surface it — the rest hydrates cleanly.
		const out = validateSettings({ ...DEFAULT_SETTINGS, level: 3 });
		expect(out).toEqual(DEFAULT_SETTINGS);
		expect("level" in out).toBe(false);
	});

	it("BC5 — accepts 'auto' / 'on' / 'off' for touchControls", () => {
		expect(validateSettings({ ...DEFAULT_SETTINGS, touchControls: "auto" }).touchControls).toBe(
			"auto",
		);
		expect(validateSettings({ ...DEFAULT_SETTINGS, touchControls: "on" }).touchControls).toBe("on");
		expect(validateSettings({ ...DEFAULT_SETTINGS, touchControls: "off" }).touchControls).toBe(
			"off",
		);
	});

	it("BC5 — falls back to default when touchControls is unknown", () => {
		expect(validateSettings({ ...DEFAULT_SETTINGS, touchControls: "haptic" }).touchControls).toBe(
			DEFAULT_SETTINGS.touchControls,
		);
		expect(validateSettings({ ...DEFAULT_SETTINGS, touchControls: 42 }).touchControls).toBe(
			DEFAULT_SETTINGS.touchControls,
		);
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
		expect(out.soundEnabled).toBe(DEFAULT_SETTINGS.soundEnabled);
	});

	it("rejects unknown difficulty values", () => {
		expect(validateSettings({ difficulty: "godmode" }).difficulty).toBe(
			DEFAULT_SETTINGS.difficulty,
		);
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
