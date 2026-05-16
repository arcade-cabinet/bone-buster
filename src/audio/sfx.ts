/**
 * A11c — sfx.ts after the Howler swap. Every play function delegates
 * to `howlerBus.play(slug)` against the A11b promoted asset slot
 * registry. The public surface (function signatures, exported
 * tables) is preserved 1:1 so consumers in app/views/Shell.tsx and
 * app/views/Scene.tsx don't change.
 *
 * The pre-swap Tone.js procedural synthesis is fully gone — see
 * git log for the previous shape. Why the switch:
 *   - Howler is the right tool for sampled audio (decoded once,
 *     played from buffer pool); Tone is the right tool for
 *     scheduled procedural synthesis.
 *   - We now have 64 OGG/WAV samples promoted from itch.io packs
 *     (PRD §A11b); replaying those is what Howler is built for.
 *   - Eliminating Tone removes 130KB+ of unused synthesis runtime
 *     from the bundle.
 */

import {
	play as howlerPlay,
	resetForTesting as howlerResetForTesting,
	setMuted as howlerSetMuted,
	setHowlerSeed,
	setVolumeDb,
} from "@audio/howlerBus";

/**
 * AUD1 — SFX mix coherence table. Volumes in dB.
 *
 * Preserved from the pre-swap codebase as the source-of-truth for
 * the per-category balance. howlerBus.SLUG_VOLUME_DB mirrors these
 * values per-slug; this table is kept for backwards-compat with the
 * tests + the docs that reference SFX_VOLUMES.
 */
export const SFX_VOLUMES = {
	pistol: -8,
	chaingun: -16,
	shotgun: -6,
	melee: -14,
	hurt: -10,
	death: -8,
	pickup: -8,
	door: -12,
	portal: -16,
	ambientDrone: -32,
	aggro: -14,
	boom: -4,
	boomNoise: -10,
	hitSting: -8,
	doorTick: -14,
} as const;

export const SFX_BANDS = {
	ambient: { min: -34, max: -26 },
	uiFeedback: { min: -16, max: -8 },
	weaponFire: { min: -16, max: -4 },
	killSting: { min: -14, max: -4 },
	musicVoice: { min: -39, max: -25 },
} as const;

export const SFX_CATEGORIES = {
	pistol: "weaponFire",
	chaingun: "weaponFire",
	shotgun: "weaponFire",
	melee: "weaponFire",
	hurt: "uiFeedback",
	death: "killSting",
	pickup: "uiFeedback",
	door: "uiFeedback",
	portal: "uiFeedback",
	ambientDrone: "ambient",
	aggro: "killSting",
	boom: "killSting",
	boomNoise: "killSting",
	hitSting: "killSting",
	doorTick: "uiFeedback",
} as const satisfies Record<keyof typeof SFX_VOLUMES, keyof typeof SFX_BANDS>;

export type MusicMood = "exploration" | "combat" | "going_back";

// Bus-init state. Howler doesn't need an async ensureContext call —
// the AudioContext is created lazily on the first .play() and resumed
// via Howler's built-in user-gesture unlock path. The ensure*
// functions stay as no-ops so the existing call sites in app/views/
// don't change.
let initialized = false;

export async function ensureSfx() {
	await ensureSfxCritical();
	await ensureMusic();
}

export async function ensureSfxCritical(): Promise<void> {
	initialized = true;
	// Howler unlocks the AudioContext on first user gesture
	// automatically; nothing to do here besides flip the flag so
	// downstream guards know we're "ready".
}

export async function ensureMusic(): Promise<void> {
	// Music loops are constructed lazily by howlerBus on first
	// play() call. No eager-load needed — the music WAVs are < 2.5MB
	// each so cold-decode is fast.
}

function muted(): boolean {
	return !initialized;
}

// === WEAPONS ===========================================================

export function playPistol() {
	if (muted()) return;
	howlerPlay("weapon/pistol/fire");
}

export function playChaingun() {
	if (muted()) return;
	howlerPlay("weapon/chaingun/loop-body");
}

export function playShotgun() {
	if (muted()) return;
	howlerPlay("weapon/shotgun/fire");
}

export function playMelee() {
	if (muted()) return;
	howlerPlay("weapon/swap");
}

export function playFlamethrower() {
	if (muted()) return;
	howlerPlay("weapon/flamethrower/loop-body");
}

// === PLAYER + PICKUPS ==================================================

export function playHurt() {
	if (muted()) return;
	howlerPlay("enemy/hit");
}

export function playSkeletonDeath() {
	if (muted()) return;
	howlerPlay("enemy/death-generic");
}

export function playPlayerDeath() {
	if (muted()) return;
	howlerPlay("enemy/death-generic");
}

export function playBossDeath() {
	if (muted()) return;
	howlerPlay("system/boss-defeat");
}

export function playPickup() {
	if (muted()) return;
	howlerPlay("pickup/health");
}

export function playKlaxon() {
	if (muted()) return;
	howlerPlay("system/going-back-klaxon");
}

export function playFlashlightClick() {
	if (muted()) return;
	howlerPlay("pickup/flashlight");
}

export function playSecretFound() {
	if (muted()) return;
	howlerPlay("pickup/secret");
}

export function playDoor() {
	if (muted()) return;
	howlerPlay("system/chest-open");
}

export function playPortal() {
	if (muted()) return;
	howlerPlay("system/level-transition");
}

// === PORTAL SWELL =====================================================
//
// POL26 — distance-attenuated portal hum. The portal renderer
// reports `(distance, radius)` per frame; volume falls off
// quadratically until distance ≥ radius.

const PORTAL_SWELL_MIN_DB = -36;
const PORTAL_SWELL_MAX_DB = -16;

export function setPortalSwellVolume(distance: number, radius: number): void {
	if (muted() || radius <= 0) return;
	const t = Math.min(1, Math.max(0, 1 - distance / radius));
	const db = PORTAL_SWELL_MIN_DB + (PORTAL_SWELL_MAX_DB - PORTAL_SWELL_MIN_DB) * t * t;
	setVolumeDb("ambient/corridor/bed", db);
}

export function resetPortalSwell(): void {
	if (muted()) return;
	setVolumeDb("ambient/corridor/bed", PORTAL_SWELL_MIN_DB);
}

// === AMBIENT ==========================================================
//
// A11d — ambient bed lifecycle moved to src/audio/ambientGraph.ts.
// The graph owns cross-fade transitions between archetypes + the
// +6dB going-back swell. sfx.ts wraps with the muted() guard so the
// pre-init state continues to no-op.

import {
	resetAmbientStateForTesting as resetAmbientStateImpl,
	startAmbient as startAmbientImpl,
	stopAmbient as stopAmbientImpl,
} from "@audio/ambientGraph";

export {
	type AmbientArchetype,
	type AmbientPhase,
	getAmbientStateForTesting,
	resetAmbientStateForTesting,
	setAmbientArchetype,
	setAmbientPhase,
} from "@audio/ambientGraph";

export function startAmbient() {
	if (muted()) return;
	startAmbientImpl();
}

export function stopAmbient() {
	stopAmbientImpl();
}

// === ENEMY + COMBAT STINGS ============================================

export function playBoom() {
	if (muted()) return;
	howlerPlay("system/barrel-explosion");
}

export function playHitSting() {
	if (muted()) return;
	howlerPlay("enemy/hit");
}

export function playDoorTick() {
	if (muted()) return;
	howlerPlay("ui/hover");
}

export function playAggroAlert(_pan: number) {
	if (muted()) return;
	// Howler does support stereo panning per-sound via Howler's
	// `stereo()` method, but the variant pool would need per-Howl
	// access. Defer pan to a future enhancement; play centered.
	howlerPlay("enemy/hit");
}

export function panForPosition(
	source: { x: number; y: number },
	listener: { x: number; y: number; yaw: number },
): number {
	// Preserved for callers; returns a normalized stereo pan
	// estimate based on horizontal offset relative to the listener's
	// yaw-rotated forward vector. The game uses `(x, y)` for the
	// floor plane (Three.js Y is up; game-space Y is what would be
	// Z in other engines). Not currently consumed by howlerBus
	// playback (see playAggroAlert) but kept stable for AUD1 tests
	// + future pan integration.
	const dx = source.x - listener.x;
	const dy = source.y - listener.y;
	const cos = Math.cos(listener.yaw);
	const sin = Math.sin(listener.yaw);
	const lateral = dx * cos - dy * sin;
	const forward = dx * sin + dy * cos;
	const angle = Math.atan2(lateral, -forward);
	return Math.max(-1, Math.min(1, Math.sin(angle)));
}

// === MUSIC ============================================================
//
// A11e — music lifecycle moved to src/audio/musicGraph.ts. Re-exports
// preserve the same public API so existing app/views/ consumers
// don't change.

import {
	getMusicLoadProgress as getMusicLoadProgressImpl,
	resetMusicStateForTesting as resetMusicStateImpl,
	setMusicIntensityForDifficulty as setMusicIntensityImpl,
	setMusicMood as setMusicMoodImpl,
	startMusic as startMusicImpl,
	stopMusic as stopMusicImpl,
} from "@audio/musicGraph";

export { getMusicStateForTesting, MUSIC_INTENSITY_DB } from "@audio/musicGraph";

export function startMusic() {
	if (muted()) return;
	startMusicImpl();
}

export function stopMusic() {
	stopMusicImpl();
}

export function setMusicMood(mood: MusicMood) {
	// The legacy sfx.ts MusicMood type was "exploration" | "combat" |
	// "going_back". The new musicGraph adds "boss" as a 4th option;
	// existing callers only ever pass the original three, but the
	// new type is a superset so the call is type-compatible.
	setMusicMoodImpl(mood);
}

export function setMusicIntensityForDifficulty(difficulty: string): void {
	setMusicIntensityImpl(difficulty);
}

export function getMusicLoadProgress(): { loaded: number; total: number } {
	return getMusicLoadProgressImpl();
}

// === TEST HELPERS =====================================================

/**
 * Seed the variant-pick RNG. Called by the engine on every fresh
 * run so test seeds reproducibly pick the same variants.
 */
export function setSfxSeed(seed: number): void {
	setHowlerSeed(seed);
}

/**
 * Master mute. Routes through Howler's global mute.
 */
export function setSoundEnabled(enabled: boolean): void {
	howlerSetMuted(!enabled);
}

export function resetSfxForTesting(): void {
	howlerResetForTesting();
	resetAmbientStateImpl();
	resetMusicStateImpl();
	initialized = false;
}
