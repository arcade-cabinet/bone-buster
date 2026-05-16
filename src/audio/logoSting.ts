/**
 * R6 — logo sting played once on landing mount.
 *
 * Pre-A11c this was a Tone.js minor-key arpeggio (A2-C3-E3 plus a
 * rim-shot lock-in). Post-A11c it's a sampled OGG/WAV via the
 * Howler bus — the `system/mission-complete` slot reads as a clean
 * triumphal stinger, which dovetails with the "they had it coming"
 * tagline.
 *
 * Module-level `played` flag dedupes across re-mounts so the sting
 * doesn't fire twice on a soft-navigate back to the landing.
 */

import { play } from "@audio/howlerBus";

let played = false;

/**
 * Fire the logo sting. Honors a module-level flag so subsequent
 * calls in the same session are no-ops (the sting is identity, not
 * gameplay feedback — playing it twice is just noisy).
 */
export function playLogoSting(): void {
	if (played) return;
	played = true;
	play("system/mission-complete");
}

/**
 * Test-only — reset the played flag so a fresh test can fire the
 * sting again.
 */
export function resetLogoStingForTesting(): void {
	played = false;
}
