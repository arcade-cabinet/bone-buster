/**
 * A11c — Howler.js facade. Routes every game audio event through a
 * single registry that owns the slot manifest from
 * docs/AUDIO-INVENTORY.md §Slot-naming-convention.
 *
 * Why a facade instead of bare Howler calls in every play function:
 * - Centralizes the slug → file mapping so sfx.ts callers only know
 *   the slug, not the on-disk path. A11d/A11e expansions add entries
 *   here without touching every call site.
 * - Owns the variant pool — `play("enemy/hit")` picks a random
 *   variant via the seeded PRNG so playback is reproducible in tests.
 * - Owns the per-bus volume routing — per-slug volume defaults sit
 *   in SLUG_VOLUME_DB (a mirror of SFX_VOLUMES from the Tone era).
 * - Handles the lazy-load split — tier-1-critical slugs (UI nav,
 *   first weapon fire) preload at boot; everything else loads on
 *   first play so cold-start time stays low.
 */

import { A } from "@assets/assetUrl";
import { mulberry32 } from "@engine/prng";
import { Howl, Howler } from "howler";

export type SlugCategory =
	| "weapon"
	| "player"
	| "pickup"
	| "enemy"
	| "ui"
	| "music"
	| "ambient"
	| "system";

/**
 * Volume table in dB, applied per-slug. Mirrors the pre-swap
 * SFX_VOLUMES + SFX_BANDS shape from the Tone era so the per-
 * category balance survives the swap. The mapping is the
 * authoritative source of truth — Howler.volume() expects 0..1
 * linear so we convert via dbToLinear() at load time.
 */
const SLUG_VOLUME_DB: Record<string, number> = {
	// weapon — weaponFire band
	"weapon/pistol/fire": -8,
	"weapon/chaingun/loop-body": -16,
	"weapon/shotgun/fire": -6,
	"weapon/flamethrower/loop-body": -10,
	"weapon/weapon-empty": -14,
	"weapon/swap": -12,
	// player — uiFeedback band
	"player/footstep/concrete": -16,
	"player/footstep/wood": -16,
	"player/footstep/gravel": -16,
	"player/footstep/water": -14,
	"player/footstep/metal": -14,
	"player/jump": -12,
	"player/land": -10,
	// pickup — uiFeedback band
	"pickup/health": -8,
	"pickup/ammo": -10,
	"pickup/key": -6,
	"pickup/flashlight": -10,
	"pickup/treasure": -6,
	"pickup/secret": -6,
	// enemy — killSting band
	"enemy/hit": -8,
	"enemy/death-generic": -8,
	// ui — uiFeedback band
	"ui/nav": -14,
	"ui/confirm": -10,
	"ui/back": -12,
	"ui/hover": -18,
	// music — musicVoice band; loops at -32 base
	"music/corridor/loop": -32,
	"music/arena/loop": -28,
	"music/boss/loop": -26,
	"music/library/loop": -34,
	// ambient — ambient band
	"ambient/corridor/bed": -32,
	"ambient/arena/bed": -30,
	"ambient/sewer/bed": -30,
	"ambient/library/bed": -34,
	// system — mix varies
	"system/mission-complete": -6,
	"system/going-back-klaxon": -8,
	"system/level-transition": -10,
	"system/barrel-explosion": -4,
	"system/boss-defeat": -4,
	"system/chest-open": -8,
};

/**
 * Slot manifest — slug → list of file paths (with .ogg or .wav
 * extension matching what scripts/promote-audio.mjs produced).
 * Multi-variant slots list all files; play() picks one via the
 * seeded PRNG. Single-variant slots list a single file.
 */
const SLOT_FILES: Record<string, readonly string[]> = {
	// weapons
	"weapon/pistol/fire": ["pistol/fire-0.ogg", "pistol/fire-1.ogg", "pistol/fire-2.ogg"].map(
		(p) => `weapon/${p}`,
	),
	"weapon/chaingun/loop-body": ["chaingun/loop-body-0.ogg", "chaingun/loop-body-1.ogg"].map(
		(p) => `weapon/${p}`,
	),
	"weapon/shotgun/fire": ["shotgun/fire-0.wav", "shotgun/fire-1.wav", "shotgun/fire-2.wav"].map(
		(p) => `weapon/${p}`,
	),
	"weapon/flamethrower/loop-body": [
		"flamethrower/loop-body-0.wav",
		"flamethrower/loop-body-1.wav",
	].map((p) => `weapon/${p}`),
	"weapon/weapon-empty": ["weapon/weapon-empty.ogg"],
	"weapon/swap": ["weapon/swap.ogg"],
	// player footsteps
	"player/footstep/concrete": [0, 1, 2, 3].map((i) => `player/footstep/concrete-${i}.ogg`),
	"player/footstep/wood": [0, 1, 2, 3].map((i) => `player/footstep/wood-${i}.ogg`),
	"player/footstep/gravel": [0, 1, 2, 3].map((i) => `player/footstep/gravel-${i}.ogg`),
	"player/footstep/water": [0, 1, 2, 3].map((i) => `player/footstep/water-${i}.ogg`),
	"player/footstep/metal": [0, 1, 2, 3].map((i) => `player/footstep/metal-${i}.ogg`),
	"player/jump": [0, 1].map((i) => `player/jump-${i}.ogg`),
	"player/land": [0, 1].map((i) => `player/land-${i}.ogg`),
	// pickups
	"pickup/health": ["pickup/health.ogg"],
	"pickup/ammo": ["pickup/ammo.ogg"],
	"pickup/key": ["pickup/key.ogg"],
	"pickup/flashlight": ["pickup/flashlight.ogg"],
	"pickup/treasure": ["pickup/treasure.ogg"],
	"pickup/secret": ["pickup/secret.wav"],
	// enemy
	"enemy/hit": [0, 1, 2, 3].map((i) => `enemy/hit-${i}.ogg`),
	"enemy/death-generic": [0, 1, 2].map((i) => `enemy/death-generic-${i}.ogg`),
	// ui
	"ui/nav": ["ui/nav.wav"],
	"ui/confirm": ["ui/confirm.wav"],
	"ui/back": ["ui/back.wav"],
	"ui/hover": ["ui/hover.wav"],
	// music
	"music/corridor/loop": ["music/corridor/loop.ogg"],
	"music/arena/loop": ["music/arena/loop.ogg"],
	"music/boss/loop": ["music/boss/loop.ogg"],
	"music/library/loop": ["music/library/loop.ogg"],
	// ambient
	"ambient/corridor/bed": ["ambient/corridor/bed.ogg"],
	"ambient/arena/bed": ["ambient/arena/bed.ogg"],
	"ambient/sewer/bed": ["ambient/sewer/bed.ogg"],
	"ambient/library/bed": ["ambient/library/bed.ogg"],
	// system
	"system/mission-complete": ["system/mission-complete.wav"],
	"system/going-back-klaxon": ["system/going-back-klaxon.wav"],
	"system/level-transition": ["system/level-transition.wav"],
	"system/barrel-explosion": [0, 1].map((i) => `system/barrel-explosion-${i}.wav`),
	"system/boss-defeat": ["system/boss-defeat.wav"],
	"system/chest-open": ["system/chest-open.ogg"],
};

/**
 * Slugs that loop by default (music + ambient + chaingun loop-body).
 * Looping Howls are kept around in HOWL_POOL so the same instance
 * stops/starts cleanly. Non-loop slugs construct fresh Howls per
 * play() so concurrent shots layer naturally.
 */
const LOOPING_SLUGS = new Set([
	"weapon/chaingun/loop-body",
	"weapon/flamethrower/loop-body",
	"music/corridor/loop",
	"music/arena/loop",
	"music/boss/loop",
	"music/library/loop",
	"ambient/corridor/bed",
	"ambient/arena/bed",
	"ambient/sewer/bed",
	"ambient/library/bed",
]);

/**
 * Cache of loop-Howls so the same instance survives stop/resume
 * cycles. Non-loop slugs aren't cached; their Howls get GC'd after
 * playback completes.
 */
const HOWL_POOL: Map<string, Howl> = new Map();

function dbToLinear(db: number): number {
	return 10 ** (db / 20);
}

/**
 * Variant pick via the seeded PRNG. Deterministic per (slug, seed)
 * pair so tests can pin which variant fires on a given seed. The
 * RNG is module-scoped + seeded by the engine on every fresh run
 * via setHowlerSeed.
 */
let variantRng = mulberry32(1);

export function setHowlerSeed(seed: number): void {
	variantRng = mulberry32(seed >>> 0);
}

function pickVariantIndex(count: number): number {
	if (count <= 1) return 0;
	return Math.floor(variantRng() * count) % count;
}

/**
 * Build a Howl for the given slug. Howler accepts an array of src
 * URLs and uses them as a format-fallback chain; we pass exactly one
 * because the slot table already has the chosen variant.
 */
function makeHowl(slug: string, variantPath: string): Howl {
	const isLoop = LOOPING_SLUGS.has(slug);
	const db = SLUG_VOLUME_DB[slug] ?? -12;
	return new Howl({
		src: [A(`/assets/audio/${variantPath}`)],
		loop: isLoop,
		volume: dbToLinear(db),
		preload: true,
	});
}

/**
 * Play a slug. Variant pool is sampled via the seeded PRNG. Loop
 * slugs reuse a cached Howl; one-shots construct a fresh one (the
 * Howl is fire-and-forget — its lifecycle ends when playback does).
 */
export function play(slug: string): number | null {
	const files = SLOT_FILES[slug];
	if (!files || files.length === 0) {
		return null;
	}
	const variantIdx = pickVariantIndex(files.length);
	const variantPath = files[variantIdx];
	if (!variantPath) return null;
	if (LOOPING_SLUGS.has(slug)) {
		let h = HOWL_POOL.get(slug);
		if (!h) {
			h = makeHowl(slug, variantPath);
			HOWL_POOL.set(slug, h);
		}
		if (h.playing()) return null;
		return h.play();
	}
	const h = makeHowl(slug, variantPath);
	return h.play();
}

/**
 * Stop a looping slug. No-op for non-loop slugs.
 */
export function stop(slug: string): void {
	const h = HOWL_POOL.get(slug);
	if (h) h.stop();
}

/**
 * Adjust the volume of a looping slug at runtime (e.g. portal-swell
 * distance falloff). Volume is in dB relative to the slug's
 * SLUG_VOLUME_DB baseline.
 */
export function setVolumeDb(slug: string, db: number): void {
	const h = HOWL_POOL.get(slug);
	if (h) h.volume(dbToLinear(db));
}

/**
 * Master volume gate. Sfx soundEnabled toggle in settings.ts routes
 * through here. Howler's global mute is sticky across all Howls
 * (loop + fire-and-forget) so a single call covers the whole bus.
 */
export function setMuted(muted: boolean): void {
	Howler.mute(muted);
}

/**
 * Test-only inspector — returns the active loop slugs. Used by
 * ambient/music tests to assert the right loops are playing in
 * each phase.
 */
export function getActiveLoopSlugsForTesting(): readonly string[] {
	const out: string[] = [];
	for (const [slug, h] of HOWL_POOL) {
		if (h.playing()) out.push(slug);
	}
	return out;
}

/**
 * Test-only reset — clears the howl pool. Called by test setup so
 * each test starts with a clean bus.
 */
export function resetForTesting(): void {
	for (const h of HOWL_POOL.values()) h.unload();
	HOWL_POOL.clear();
	variantRng = mulberry32(1);
}
