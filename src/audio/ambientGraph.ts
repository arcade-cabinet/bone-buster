/**
 * A11d — per-archetype ambient bed manager.
 *
 * Owns the (archetype, phase) → ambient-slug + volume routing and
 * the cross-fade transitions when the player moves between
 * archetypes or flips into the going_back phase.
 *
 * Why a separate module from sfx.ts: the ambient surface is the only
 * subsystem with non-trivial cross-fade state (everything else in
 * sfx is fire-and-forget). Isolating it here keeps sfx.ts a thin
 * facade and makes the cross-fade contract testable in isolation.
 */

import { crossfade, fadeTo, stop } from "@audio/howlerBus";

export type AmbientArchetype = "corridor" | "arena" | "courtyard" | "sewer" | "library";
export type AmbientPhase = "out" | "going_back";

const ARCHETYPE_TO_SLUG: Record<AmbientArchetype, string> = {
	corridor: "ambient/corridor/bed",
	arena: "ambient/arena/bed",
	// Courtyard borrows the arena bed (outdoor wind); a bespoke
	// courtyard bed is a future refinement once we have a matching
	// itch.io pack.
	courtyard: "ambient/arena/bed",
	sewer: "ambient/sewer/bed",
	library: "ambient/library/bed",
};

// E11 — going-back boost. The bed pumps +6dB when the player crosses
// into the going_back phase so the klaxon doesn't drown out the
// ambient tension. Cross-faded over 400ms so the swell feels
// inevitable rather than abrupt.
const BASE_DB: Record<AmbientArchetype, number> = {
	corridor: -32,
	arena: -30,
	courtyard: -30,
	sewer: -28,
	library: -34,
};

const GOING_BACK_BOOST_DB = 6;

// E11 — per-archetype pitch label, preserved from the Tone era as a
// human-readable archetype-identifier some tests pin. Post-swap
// nothing actually plays at these pitches (samples are pre-rendered),
// but the labels survive for backwards-compat with AUD1 contract.
const PITCH_LABEL: Record<AmbientArchetype, string> = {
	corridor: "E1",
	arena: "G1",
	courtyard: "C2",
	sewer: "A0",
	library: "D2",
};

const CROSSFADE_MS = 600;
const PHASE_FADE_MS = 400;

// State —  ambient bed lifecycle. Initialized to `null` until
// startAmbient is called for the first time, then tracks whichever
// loop is live.
let activeSlug: string | null = null;
let activeArchetype: AmbientArchetype = "corridor";
let activePhase: AmbientPhase = "out";

function resolveDb(): number {
	const base = BASE_DB[activeArchetype];
	return activePhase === "going_back" ? base + GOING_BACK_BOOST_DB : base;
}

/**
 * Start the ambient bed for the current archetype. Subsequent
 * calls with no archetype change are no-ops (the bed is already
 * playing); archetype transitions cross-fade.
 */
export function startAmbient(): void {
	const targetSlug = ARCHETYPE_TO_SLUG[activeArchetype];
	const targetDb = resolveDb();
	if (activeSlug === targetSlug) {
		return;
	}
	crossfade(activeSlug, targetSlug, targetDb, CROSSFADE_MS);
	activeSlug = targetSlug;
}

/**
 * Stop the ambient bed entirely. Fades out then actually stops the
 * underlying Howl so the audio resource isn't left at near-silent
 * gain forever. If `startAmbient` re-activates the same slug before
 * the fade-out completes, the scheduled `stop()` is skipped.
 */
export function stopAmbient(): void {
	const slugToStop = activeSlug;
	if (slugToStop) {
		fadeTo(slugToStop, -60, PHASE_FADE_MS);
		setTimeout(() => {
			if (activeSlug !== slugToStop) stop(slugToStop);
		}, PHASE_FADE_MS + 50);
	}
	activeSlug = null;
}

/**
 * Set the active archetype. If the bed is running, cross-fades to
 * the new archetype's bed; otherwise just records for the next
 * startAmbient call.
 */
export function setAmbientArchetype(archetype: AmbientArchetype): void {
	if (activeArchetype === archetype) return;
	activeArchetype = archetype;
	if (activeSlug) {
		startAmbient();
	}
}

/**
 * Set the active phase. Cross-fades the bed's volume to the new
 * (base + boost) over PHASE_FADE_MS.
 */
export function setAmbientPhase(phase: AmbientPhase): void {
	if (activePhase === phase) return;
	activePhase = phase;
	if (activeSlug) {
		fadeTo(activeSlug, resolveDb(), PHASE_FADE_MS);
	}
}

export function getAmbientStateForTesting(): {
	archetype: AmbientArchetype;
	phase: AmbientPhase;
	activeSlug: string | null;
	resolvedVolumeDb: number;
	resolvedPitch: string;
} {
	return {
		archetype: activeArchetype,
		phase: activePhase,
		activeSlug,
		resolvedVolumeDb: resolveDb(),
		resolvedPitch: PITCH_LABEL[activeArchetype],
	};
}

export function resetAmbientStateForTesting(): void {
	activeSlug = null;
	activeArchetype = "corridor";
	activePhase = "out";
}
