/**
 * A11e — music graph. Owns the (mood, difficulty) → music-slug +
 * volume routing and the cross-fade transitions between moods.
 *
 * Pre-A11c music was a Tone.js procedural cascade with 6 voice
 * synths and a per-step note table. Post-A11c the gameplay loops
 * through 4 sampled music beds (corridor / arena / boss / library)
 * that switch based on the player's current mood — exploration,
 * combat, going-back, or boss-encounter.
 *
 * Why a separate module from sfx.ts: same reason as ambientGraph —
 * the only non-trivial state in the post-swap sfx surface lives in
 * cross-fade transitions; isolating it keeps the public sfx facade
 * thin and makes the mood-state contract testable.
 */

import { crossfade, fadeTo } from "@audio/howlerBus";

export type MusicMood = "exploration" | "combat" | "going_back" | "boss";

const MOOD_TO_SLUG: Record<MusicMood, string> = {
	exploration: "music/corridor/loop",
	combat: "music/arena/loop",
	going_back: "music/arena/loop",
	boss: "music/boss/loop",
};

// Base volumes (dB) per mood. All inside SFX_BANDS.musicVoice
// (-39..-25). Exploration is the quietest (background sit-back);
// boss is the loudest (combat-foreground).
const MOOD_BASE_DB: Record<MusicMood, number> = {
	exploration: -32,
	combat: -28,
	going_back: -28,
	boss: -26,
};

// POL33 — difficulty → music intensity dB delta. NIGHTMARE runs the
// music ~3dB hotter than the default hurtMePlenty baseline; TOO
// YOUNG TO DIE runs ~3dB quieter. The delta is added to MOOD_BASE_DB
// at fade time so a difficulty change re-pitches the bus immediately.
export const MUSIC_INTENSITY_DB: Record<string, number> = {
	tooYoung: -3,
	notTooRough: -1.5,
	hurtMePlenty: 0,
	ultraViolence: 1.5,
	nightmare: 3,
};

const MOOD_CROSSFADE_MS = 800;
const DIFFICULTY_FADE_MS = 300;

// State.
let activeSlug: string | null = null;
let activeMood: MusicMood = "exploration";
let activeDifficulty = "hurtMePlenty";
const musicTracksTotal = 4;

function resolveDb(): number {
	return MOOD_BASE_DB[activeMood] + (MUSIC_INTENSITY_DB[activeDifficulty] ?? 0);
}

export function startMusic(): void {
	const targetSlug = MOOD_TO_SLUG[activeMood];
	if (activeSlug === targetSlug) return;
	crossfade(activeSlug, targetSlug, resolveDb(), MOOD_CROSSFADE_MS);
	activeSlug = targetSlug;
}

export function stopMusic(): void {
	if (activeSlug) {
		fadeTo(activeSlug, -60, MOOD_CROSSFADE_MS);
	}
	activeSlug = null;
}

export function setMusicMood(mood: MusicMood): void {
	if (activeMood === mood) return;
	activeMood = mood;
	if (activeSlug) startMusic();
}

export function setMusicIntensityForDifficulty(difficulty: string): void {
	activeDifficulty = difficulty;
	if (activeSlug) {
		fadeTo(activeSlug, resolveDb(), DIFFICULTY_FADE_MS);
	}
}

export function getMusicLoadProgress(): { loaded: number; total: number } {
	// Howler decodes lazily on first play; until a mood is started
	// nothing is loaded. After startMusic, the active mood is the
	// only thing in-memory; the other 3 beds load on demand.
	return { loaded: activeSlug ? 1 : 0, total: musicTracksTotal };
}

export function getMusicStateForTesting(): {
	mood: MusicMood;
	difficulty: string;
	activeSlug: string | null;
	resolvedVolumeDb: number;
} {
	return {
		mood: activeMood,
		difficulty: activeDifficulty,
		activeSlug,
		resolvedVolumeDb: resolveDb(),
	};
}

export function resetMusicStateForTesting(): void {
	activeSlug = null;
	activeMood = "exploration";
	activeDifficulty = "hurtMePlenty";
}
