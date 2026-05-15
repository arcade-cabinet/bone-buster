/**
 * STO1a — settings persistence on top of Capacitor Preferences.
 *
 * Stores the full ObjexoomSettings as a JSON blob under the
 * `objexoom.settings` key. Read at app boot, written on every
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

import {
	DEFAULT_SETTINGS,
	DIFFICULTY_LABEL,
	type Difficulty,
	LEVEL_LABEL,
	type LevelChoice,
	type ObjexoomSettings,
} from "../settings";
import { readJsonPref, writeJsonPref } from "./preferences";

const SETTINGS_KEY = "objexoom.settings";

const DIFFICULTY_KEYS = Object.keys(DIFFICULTY_LABEL) as readonly Difficulty[];
const LEVEL_KEYS = Object.keys(LEVEL_LABEL) as readonly string[];

function isDifficulty(v: unknown): v is Difficulty {
	return typeof v === "string" && (DIFFICULTY_KEYS as readonly string[]).includes(v);
}

function isLevelChoice(v: unknown): v is LevelChoice {
	if (v === "procedural") return true;
	if (typeof v === "number" && [1, 2, 3, 4, 5].includes(v)) return true;
	// LEVEL_KEYS holds the stringified discriminator set in case a blob
	// round-tripped through JSON where numeric keys can come back as
	// strings — coerce defensively.
	return typeof v === "string" && LEVEL_KEYS.includes(v);
}

function coerceLevel(v: unknown): LevelChoice {
	if (v === "procedural") return "procedural";
	if (typeof v === "number" && [1, 2, 3, 4, 5].includes(v)) return v as LevelChoice;
	if (typeof v === "string") {
		const n = Number(v);
		if ([1, 2, 3, 4, 5].includes(n)) return n as LevelChoice;
	}
	return DEFAULT_SETTINGS.level;
}

function isFiniteNumber(v: unknown): v is number {
	return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validate a foreign blob against the live ObjexoomSettings shape. Any
 * field that fails validation falls back to its DEFAULT_SETTINGS value
 * — partial blobs are accepted, never reject the whole thing. This
 * matters for forward compat: when a new setting is added the old
 * blobs are missing it but the rest of the settings should still
 * hydrate.
 */
export function validateSettings(raw: unknown): ObjexoomSettings {
	if (raw === null || typeof raw !== "object") return DEFAULT_SETTINGS;
	const r = raw as Record<string, unknown>;
	const difficulty = isDifficulty(r.difficulty) ? r.difficulty : DEFAULT_SETTINGS.difficulty;
	const level = isLevelChoice(r.level) ? coerceLevel(r.level) : DEFAULT_SETTINGS.level;
	const soundEnabled =
		typeof r.soundEnabled === "boolean" ? r.soundEnabled : DEFAULT_SETTINGS.soundEnabled;
	const mouseSensitivity = isFiniteNumber(r.mouseSensitivity)
		? Math.min(2.5, Math.max(0.5, r.mouseSensitivity))
		: DEFAULT_SETTINGS.mouseSensitivity;
	const touchLookSensitivity = isFiniteNumber(r.touchLookSensitivity)
		? Math.min(4, Math.max(0.5, r.touchLookSensitivity))
		: DEFAULT_SETTINGS.touchLookSensitivity;
	return { difficulty, level, soundEnabled, mouseSensitivity, touchLookSensitivity };
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
export async function loadSettings(): Promise<ObjexoomSettings | null> {
	const raw = await readJsonPref<unknown>(SETTINGS_KEY);
	if (raw === null) return null;
	return validateSettings(raw);
}

/**
 * Write the current settings back. Best-effort — the underlying
 * Preferences facade swallows quota/lock failures so the app never
 * blocks on a failed save.
 */
export async function saveSettings(settings: ObjexoomSettings): Promise<void> {
	await writeJsonPref(SETTINGS_KEY, settings);
}
