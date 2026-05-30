/**
 * STO1a — settings persistence on top of Capacitor Preferences.
 *
 * Stores the full BoneBusterSettings as a JSON blob under the
 * `bonebuster.settings` key (legacy `objexoom.settings` read-only
 * fallback per R8b migration shim). Read at app boot, written on every
 * setSettings call. Validated against the live Difficulty + LevelChoice
 * unions so a forged or stale blob can't silently flip the player into
 * an unsupported state.
 *
 * Why a single blob instead of per-key writes: settings are read once
 * at boot and rewritten as a unit; splitting into 5 individual keys
 * would mean 5 native plugin round-trips per save with no benefit.
 *
 * Why this lives in src/persistence/ instead of src/settings.ts: the
 * settings module is pure type+constants (no async, no I/O); the
 * persistence layer is the boundary where Capacitor lives. Keeping
 * them separate means src/settings.ts stays trivially unit-testable
 * without mocking the native plugin.
 */

import { readJsonPref, writeJsonPref } from "@platform/persistence/preferences";
import {
	type BoneBusterSettings,
	DEFAULT_SETTINGS,
	DIFFICULTY_LABEL,
	type Difficulty,
	TOUCH_CONTROL_LABEL,
	type TouchControlMode,
} from "@store/settings";

// R8b — storage key migration. The new canonical key is
// `bonebuster.settings`; the old `objexoom.settings` key is read on
// load when the new one is absent and the value is one-shot
// migrated to the new slot. Existing player saves survive the
// rebrand without re-entering OPTIONS.
const SETTINGS_KEY = "bonebuster.settings";
const LEGACY_SETTINGS_KEY = "objexoom.settings";

const DIFFICULTY_KEYS = Object.keys(DIFFICULTY_LABEL) as readonly Difficulty[];
const TOUCH_CONTROL_KEYS = Object.keys(TOUCH_CONTROL_LABEL) as readonly TouchControlMode[];

function isDifficulty(v: unknown): v is Difficulty {
	return typeof v === "string" && (DIFFICULTY_KEYS as readonly string[]).includes(v);
}

function isTouchControlMode(v: unknown): v is TouchControlMode {
	return typeof v === "string" && (TOUCH_CONTROL_KEYS as readonly string[]).includes(v);
}

function isFiniteNumber(v: unknown): v is number {
	return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validate a foreign blob against the live BoneBusterSettings shape. Any
 * field that fails validation falls back to its DEFAULT_SETTINGS value
 * — partial blobs are accepted, never reject the whole thing. This
 * matters for forward compat: when a new setting is added the old
 * blobs are missing it but the rest of the settings should still
 * hydrate.
 */
export function validateSettings(raw: unknown): BoneBusterSettings {
	if (raw === null || typeof raw !== "object") return DEFAULT_SETTINGS;
	const r = raw as Record<string, unknown>;
	const difficulty = isDifficulty(r.difficulty) ? r.difficulty : DEFAULT_SETTINGS.difficulty;
	const soundEnabled =
		typeof r.soundEnabled === "boolean" ? r.soundEnabled : DEFAULT_SETTINGS.soundEnabled;
	const mouseSensitivity = isFiniteNumber(r.mouseSensitivity)
		? Math.min(2.5, Math.max(0.5, r.mouseSensitivity))
		: DEFAULT_SETTINGS.mouseSensitivity;
	const touchLookSensitivity = isFiniteNumber(r.touchLookSensitivity)
		? Math.min(4, Math.max(0.5, r.touchLookSensitivity))
		: DEFAULT_SETTINGS.touchLookSensitivity;
	const touchControls = isTouchControlMode(r.touchControls)
		? r.touchControls
		: DEFAULT_SETTINGS.touchControls;
	return {
		difficulty,
		soundEnabled,
		mouseSensitivity,
		touchLookSensitivity,
		touchControls,
	};
}

/**
 * Read the persisted settings, validating against the live schema.
 * Returns `null` when NO persisted blob exists (i.e. fresh install)
 * so the caller can avoid an unnecessary setState that would race
 * with any code-side `setSettings` happening during the async window
 * between mount and load resolution. When a blob exists, validates
 * it against the schema (per-field fallback to DEFAULT_SETTINGS for
 * unknown values) and returns the narrowed result.
 *
 * Never throws — corrupted JSON / partial blobs / missing fields all
 * fall back to DEFAULT_SETTINGS via the validator.
 */
export async function loadSettings(): Promise<BoneBusterSettings | null> {
	const raw = await readJsonPref<unknown>(SETTINGS_KEY);
	if (raw !== null) return validateSettings(raw);
	// R8b — fall back to the legacy `objexoom.settings` key for
	// existing installs. On hit, migrate by writing the validated
	// blob to the canonical key so future loads skip the lookup.
	const legacy = await readJsonPref<unknown>(LEGACY_SETTINGS_KEY);
	if (legacy === null) return null;
	const migrated = validateSettings(legacy);
	await writeJsonPref(SETTINGS_KEY, migrated);
	return migrated;
}

/**
 * Write the current settings back. Best-effort — the underlying
 * Preferences facade swallows quota/lock failures so the app never
 * blocks on a failed save.
 */
export async function saveSettings(settings: BoneBusterSettings): Promise<void> {
	await writeJsonPref(SETTINGS_KEY, settings);
}
