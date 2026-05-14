import * as Tone from "tone";

/**
 * AUDIO1 — typed audio bus (see docs/SLOT-ARCHITECTURE.md §4).
 *
 * The pre-bus pattern had every play*() function in sfx.ts own its
 * own `last*FireTime` global + inline `jitter(prev)` call. Each new
 * cue added a new global; POL21 + POL28 surfaced collisions because
 * pickupSynth + boomSynth + ambientDrone were sharing voices across
 * cues without sharing timers. The bus consolidates all of that into
 * one place.
 *
 * Contract:
 *   - Channels are enumerated by `ChannelId` (the union type).
 *   - `bus.fire(channelId, schedule)` returns a Tone.js time `t` that
 *     is guaranteed > the channel's previous fire time (1ms minimum).
 *   - The caller's `schedule(t)` does the actual synth triggering at
 *     `t` (and may schedule follow-ups via `setTimeout` + `bus.fire`
 *     of the same channel for multi-note bursts).
 *
 * Why not just a Map<string, number>: the typed ChannelId union catches
 * typo'd channel names at compile time. New channels must be added to
 * the union, which forces the enumeration to stay synchronized.
 */

export type ChannelId =
	// Weapon SFX
	| "pistol"
	| "chaingun"
	| "shotgun"
	| "melee"
	| "flamethrower"
	// Player feedback
	| "hurt"
	| "hitSting"
	| "playerDeath"
	// Enemy feedback
	| "skeletonDeath"
	| "bossDeath"
	// World events
	| "pickup"
	| "klaxon"
	| "flashlightClick"
	| "secretFound"
	| "door"
	| "portal"
	| "doorTick"
	// Shared instruments (multiple cues hit the same synth — need
	// dedicated channels so cross-cue collisions are jittered).
	| "boom"
	| "boomNoise"
	| "ambientDrone";

/**
 * Per-channel last-fire bookkeeping. Initialized lazily on first
 * access so a channel that's never fired doesn't pay for its slot.
 */
const lastFireTimes = new Map<ChannelId, number>();

/**
 * Jitter the requested fire time to be strictly greater than the
 * channel's previous fire time. Tone.js raises "Start time must be
 * strictly greater than previous start time" if two consecutive
 * triggerAttackRelease calls share an audio-frame `t`; 1ms is below
 * human perception and resolves the collision deterministically.
 */
function jitterChannel(channelId: ChannelId): number {
	const now = Tone.now();
	const prev = lastFireTimes.get(channelId);
	// First fire on a never-touched channel: use `now` as-is — no
	// previous fire to collide with. Subsequent fires must be strictly
	// greater (+1ms minimum) so Tone.js doesn't reject the schedule.
	const next = prev === undefined ? now : Math.max(now, prev + 0.001);
	lastFireTimes.set(channelId, next);
	return next;
}

/**
 * Fire a cue on the named channel. The schedule callback receives
 * the jittered Tone.js time and is responsible for calling the
 * underlying synth's triggerAttackRelease at that time.
 *
 * For multi-note bursts (e.g. boss-death G1 → D2 → G2 → D3), call
 * `bus.fire('bossDeath', t => deathSynth.triggerAttackRelease('G1', t))`
 * for the first note, then `setTimeout(() => bus.fire('bossDeath', t => ...), 120)`
 * for the follow-ups. Each scheduled note re-jitters through the same
 * channel, so any external collision (e.g. another boss kill 60ms in)
 * lands cleanly.
 */
export function fire(channelId: ChannelId, schedule: (t: number) => void): void {
	const t = jitterChannel(channelId);
	schedule(t);
}

/**
 * Test-only — reset all channel timers. Lets browser-tests
 * exercise repeated fires without carrying state across runs.
 */
export function resetForTest(): void {
	lastFireTimes.clear();
}
