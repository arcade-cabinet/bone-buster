/**
 * SEED4 — event-PRNG seed persistence (see docs/specs/96-prng-and-landing.md).
 *
 * The event seed is DEVICE state, not game state: it lives in Capacitor
 * Preferences under `eventPrngSeed`, NOT in the seed phrase. Lifecycle:
 *   - First launch: minted from crypto.getRandomValues (the one allowed
 *     non-determinism — it seeds a PRNG, it is not sim logic) and stored.
 *   - Each New Game: the buried seed is ADVANCED — the next seed is drawn
 *     from the current event stream and written back — so combat/loot
 *     variance + the suggested seed phrase differ per session, yet every
 *     session is deterministic and replayable from the event seed it
 *     committed with.
 *
 * Drives: combat damage/crit rolls, loot variance, and the seed-phrase
 * randomizer (picking a phrase is "just another event draw").
 */

import { advanceEventSeed, createEventPrng, createFreshEventSeed } from "@engine/rng";
import { readPref, writePref } from "@platform/persistence/preferences";

const EVENT_SEED_KEY = "eventPrngSeed";

/**
 * Read the buried event seed, minting + persisting a fresh one on first
 * launch. Returns the seed string the caller turns into a stream via
 * `createEventPrng`.
 */
export async function loadEventSeed(): Promise<string> {
	const existing = await readPref(EVENT_SEED_KEY);
	if (existing !== null && existing.length > 0) return existing;
	const fresh = createFreshEventSeed();
	await writePref(EVENT_SEED_KEY, fresh);
	return fresh;
}

/**
 * Advance the buried event seed: derive the next seed from the current
 * one's stream, persist it, and return it. Called on New Game so each run
 * gets a fresh-but-deterministic event stream. Returns the NEW seed.
 */
export async function advanceAndPersistEventSeed(currentSeed: string): Promise<string> {
	const next = advanceEventSeed(createEventPrng(currentSeed));
	await writePref(EVENT_SEED_KEY, next);
	return next;
}
