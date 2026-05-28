import { preloadTier1Critical } from "@assets/preload";
import {
	ensureMusic,
	ensureSfxCritical,
	playKlaxon,
	playPickup,
	playPlayerDeath,
	playSecretFound,
	setMusicIntensityForDifficulty,
	setMusicMood,
	startAmbient,
	startMusic,
	stopAmbient,
	stopMusic,
} from "@audio/sfx";
import type { BoneBusterMap, PickupKind } from "@engine/engine";
import { addBoneBusterListener, dispatch } from "@engine/events";
import { createEventPrng, createFreshEventSeed, cyrb128 } from "@engine/rng";
import { CANONICAL_SEED_PHRASE, randomSeedPhrase } from "@engine/seedPhrase";
import { loadSettings, saveSettings } from "@platform/persistence/settingsStore";
import { Canvas } from "@react-three/fiber";
import { PLAYER_MAX_HP } from "@shared/constants";
import { computeFadePeak, FADE_COLOR_BY_KIND } from "@shared/fadeTriggers";
import { WEAPON_ORDER, WEAPONS, type WeaponId } from "@shared/weapons";
import { openRunHistory, type RunHistory } from "@store/runHistory";
import {
	advanceLevel,
	makeInitialRunStats,
	nextStatusAfterTransition,
	type RunStats,
	runStatsReducer,
} from "@store/runStats";
import {
	type BoneBusterSettings,
	DEFAULT_SETTINGS,
	DIFFICULTY_TUNING,
	type Difficulty,
	type TouchControlMode,
} from "@store/settings";
import { ROLE, SCALE } from "@styles/tokens/index";
import { BoneBusterHUD } from "@views/HUD";
import { BoneBusterLanding } from "@views/Landing";
import { BoneBusterScene } from "@views/Scene";
import { debugHooksEnabled, readArchetypeFromUrl, readSeedPhraseFromUrl } from "@views/urlFlags";
import { applyArchetypeOverride } from "@world/archetype";
import { buildMap } from "@world/buildMap";
import { pickLevelName, WELCOME_WING_NAME } from "@world/levelNames";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameRef } from "../../src/scene/hooks/useGameRef";

export type GameStatus = "landing" | "playing" | "paused" | "dead" | "transitioning" | "won";

// H8 — `phase` tracks where the player is within a single level.
//   "out"          — heading toward the goal, normal level flow.
//   "going_back"   — goal collected; all enemies aggro; player must
//                    fight back to the original spawn to clear the level.
export type LevelPhase = "out" | "going_back";

// J3 — full-screen fade overlay. Each trigger renders a colored quad
// with an opacity envelope (peak 200 ms, fade 400 ms). Distinct triggers:
//   damage   — red, intensity scaled by damage amount (replaces D-flash)
//   key      — green, on key pickup
//   flash    — gray, on flashlight pickup
//   win      — white, on level-clear
export type FadeKind = "damage" | "key" | "flash" | "win";
export type FadeTrigger = Readonly<{
	id: number;
	kind: FadeKind;
	color: string;
	peak: number; // 0..1 opacity peak
}>;

export type GameState = {
	status: GameStatus;
	hp: number;
	maxHp: number;
	kills: number;
	/**
	 * POL1 — running score across the current level. Earned from
	 * COV12 treasure-loot pickups (+50 each) and reset on level
	 * advance / death. Surfaced on the HUD next to KILLS.
	 */
	score: number;
	totalEnemies: number;
	hasKey: boolean;
	// J1 — player owns a flashlight after picking up class 7. Without it
	// the level reads as dark and only the muzzle flash + ambient hue
	// give the player anything to navigate by.
	hasFlashlight: boolean;
	// PB5 step-2 — EMF reader ownership flag. When true, the HUD shows
	// the EMF chip with a 1-5 stepwise readout of nearest-enemy
	// proximity. Off by default; flips true on pickup.
	hasEmfReader: boolean;
	// PC2 — Spirit box ownership flag. When true, the SpiritBoxBubble
	// HUD overlay listens for the `spiritBoxResponse` event and renders
	// the deterministic phoneme for ~1s. Off by default; flips true on
	// pickup.
	hasSpiritBox: boolean;
	// PC3 — UV flashlight ownership flag. When true, BoneBusterScene
	// mounts the UvFlashlight component (purple SpotLight) and EnemyMesh
	// runs the per-frame UV-cone reveal for uvHidden enemies. Off by
	// default; flips true on pickup.
	hasUvFlashlight: boolean;
	// PC4 — Crucifix inventory counter. Increments on pickup, decrements
	// when the player drops one via key `9`. Each placed crucifix
	// suppresses enemy aggression in a fixed radius for
	// CRUCIFIX_LIFETIME_MS. Resets to 0 on level transition.
	crucifixes: number;
	weapon: WeaponId;
	ammo: Record<WeaponId, number>;
	ownedWeapons: Record<WeaponId, boolean>;
	damageFlashAt: number;
	run: RunStats;
	phase: LevelPhase;
	/**
	 * POL37 — going-back countdown deadline. Set on `out → going_back`
	 * transition to `performance.now() + GOING_BACK_BUDGET_MS`; cleared
	 * (null) on `reachSpawn` and on every fresh level/run.
	 *
	 * When the deadline elapses without reaching spawn, the level dies
	 * via the existing hp→0 path so engine.ts's death handling carries
	 * the rest (no new state branch). HUD surfaces a monospace red
	 * countdown under GoingBackOverlay's "RETURN TO SPAWN" card.
	 */
	goingBackDeadlineMs: number | null;
};

export const TRANSITION_HOLD_MS = 800;
export const RUN_LENGTH = 5;
/**
 * POL37 — total budget the player has to retrace from the goal back
 * to spawn after the boss + key are taken. 30s is long enough to
 * traverse any procedural map at a brisk walk; too short feels like
 * a punish, too long defeats the "urgent retreat" reading.
 */
export const GOING_BACK_BUDGET_MS = 30_000;

export type WeaponState = {
	weapon: WeaponId;
	ammo: Record<WeaponId, number>;
};

export type GameRef = {
	onHit(damage: number): void;
	onKill(): void;
	onPickupKey(): void;
	onWin(): void;
	onReachSpawn(): void;
	onSpendAmmo(weapon: WeaponId, amount: number): void;
	onCollectPickup(kind: PickupKind): void;
	/**
	 * PC4 — Consume one crucifix from inventory. Returns `true` if
	 * the inventory had ≥1 (the Scene proceeds with the placement)
	 * and `false` if the inventory was empty (the Scene no-ops the
	 * keypress so a player slapping `9` with zero inventory doesn't
	 * accidentally place a phantom crucifix at the origin).
	 */
	onConsumeCrucifix(): boolean;
};

// BC5 — touch-mode auto-detection. Previously a single `(pointer:
// coarse)` query, which mis-classified the Pixel Fold's inner display
// (it advertises a fine pointer because of the embedded keyboard
// support) and every Chrome desktop emulation preset (which inherits
// fine pointer regardless of the emulated device).
//
// The broadened gate is: ANY coarse pointer attached AND the viewport
// is mid-size or smaller. The `any-pointer` query catches dual-input
// devices (Surface, Pixel Fold) where `pointer` reports the precise
// device but `any-pointer` reveals the secondary coarse input. The
// `max-width: 1024px` clamp keeps a docked-keyboard 4K tablet from
// flipping into touch-stick mode unnecessarily.
//
// The original `(pointer: coarse)` is kept as the first arm so phones
// (single coarse input, no fine pointer) still match.
const TOUCH_AUTO_QUERY = "(pointer: coarse), (max-width: 1024px) and (any-pointer: coarse)";

const isCoarsePointer = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia(TOUCH_AUTO_QUERY).matches;

// BC5 — resolve the player's touch-control preference against the
// runtime device. `auto` runs the broadened media-query gate; `on`/
// `off` are absolute pins. Returning a boolean lets the rest of the
// HUD stay touchMode-only and ignorant of the preference layer.
export function resolveTouchMode(
	mode: TouchControlMode,
	autoDetect: () => boolean = isCoarsePointer,
): boolean {
	if (mode === "on") return true;
	if (mode === "off") return false;
	return autoDetect();
}

const baseAmmo = (): Record<WeaponId, number> => ({
	melee: WEAPONS.melee.startingAmmo,
	pistol: WEAPONS.pistol.startingAmmo,
	chaingun: WEAPONS.chaingun.startingAmmo,
	shotgun: WEAPONS.shotgun.startingAmmo,
	flamethrower: WEAPONS.flamethrower.startingAmmo,
});

// E1 — every fresh run starts with the blade + pistol; chaingun,
// shotgun, and (E8) flamethrower are world pickups. Centralized so
// adding a weapon to the default loadout is a one-line change.
const baseOwnedWeapons = (): Record<WeaponId, boolean> => ({
	melee: true,
	pistol: true,
	chaingun: false,
	shotgun: false,
	flamethrower: false,
});

// URL-flag parsing lives in @views/urlFlags (CR-F6 — extracted so the
// app's only external-input boundary is unit-testable). This composes the
// base seed with the archetype override.
function readSeedFromUrl(): string {
	// SEED2 — the map identity is now a seed PHRASE. Use the URL phrase if
	// present, else a deterministic default (SEED3 will mint from the event
	// PRNG / New Game modal). The archetype override appends a suffix that
	// re-hashes onto the requested archetype.
	const base = readSeedPhraseFromUrl() ?? CANONICAL_SEED_PHRASE;
	return applyArchetypeOverride(base, readArchetypeFromUrl());
}

declare global {
	interface Window {
		__bonebuster?: {
			getState: () => unknown;
			start: () => void;
			teleport: (x: number, y: number, yawRad?: number) => void;
			fire: () => void;
			killAllEnemies: () => void;
			killBoss: () => void;
			selectWeapon: (weapon: WeaponId) => void;
			collectKey: () => void;
			collectAllPickups: () => void;
			triggerWin: () => void;
			forceMissionComplete: () => void;
			// POL31 — debug-only difficulty setter so playtest scripts can
			// capture the DifficultyChip in each of the 5 palettes without
			// driving the landing-page Settings panel (touch-hostile in
			// Playwright). Settings is the source of truth; this hook
			// mutates it the same way the landing settings UI would.
			setDifficulty: (difficulty: Difficulty) => void;
			getSettings: () => BoneBusterSettings;
		};
	}
}

export function BoneBusterShell() {
	const [seedPhrase, setSeedPhrase] = useState(readSeedFromUrl);
	// INF3 — when `?bonebusterArchetype` is present, switch the level to
	// procedural so the seed rewrite (and thus the archetype pick)
	// actually drives map generation. Without this override the default
	// `level: 1` would load the baked refLevel 0 (corridor) and the
	// archetype flag would silently no-op.
	const [settings, setSettings] = useState<BoneBusterSettings>(() =>
		readArchetypeFromUrl() ? { ...DEFAULT_SETTINGS, level: "procedural" } : DEFAULT_SETTINGS,
	);
	// STO1a — track whether the async load-from-Preferences pass has
	// resolved. Used to gate the save-on-change effect so the bootstrap
	// load doesn't trigger a redundant write of DEFAULT_SETTINGS back
	// over the same blob.
	const settingsHydratedRef = useRef(false);
	// A4 — fire tier-1 preload on shell mount. The pistol viewmodel
	// must be hot before the user clicks Start Game; everything else
	// is split into tier 2 (map-mount) and tier 3 (deferred) and
	// fires from inside `BoneBusterScene`. Pre-A4 every entity file's
	// module-scope IIFE pumped all ~90 MB of GLBs into the loader
	// at app boot, contending with the landing-screen UI.
	useEffect(() => {
		preloadTier1Critical();
	}, []);

	// STO1a — async-hydrate persisted settings on mount. The override
	// for `?bonebusterArchetype` still wins (URL flag → procedural) so
	// the test/debug harness can short-circuit the persisted value
	// without first clearing storage. If no blob exists, the loaded
	// value equals DEFAULT_SETTINGS and the setSettings call is a
	// no-op against initial state — no extra render.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const persisted = await loadSettings();
			if (cancelled) return;
			// `loadSettings()` returns null when no blob exists (fresh
			// install). In that case the initial DEFAULT_SETTINGS state
			// is already correct — skip the setSettings call so we
			// don't clobber any code-side `setSettings` that landed
			// during the async window (e.g. `__bonebuster.setDifficulty`
			// called from a playtest script BEFORE this load resolved).
			if (persisted !== null) {
				const archetypeOverride = readArchetypeFromUrl();
				setSettings(archetypeOverride ? { ...persisted, level: "procedural" } : persisted);
			}
			settingsHydratedRef.current = true;
		})();
		return () => {
			cancelled = true;
		};
	}, []);
	// STO1a — save settings back on every change AFTER hydration. The
	// guard prevents the first paint from clobbering a persisted blob
	// with DEFAULT_SETTINGS during the brief window before the load
	// resolves. Write is best-effort (preferences.ts swallows quota /
	// lock failures); the app never blocks on a failed save.
	useEffect(() => {
		if (!settingsHydratedRef.current) return;
		void saveSettings(settings);
	}, [settings]);
	const map: BoneBusterMap = useMemo(
		// I4 — difficulty plumbed through so ManyEnemies (class 9) expands
		// per the ref formula. Procedural maps don't read it.
		() => buildMap(seedPhrase, settings.level, settings.difficulty),
		[seedPhrase, settings.level, settings.difficulty],
	);
	// D8 — alliterative level name. refLevel(0) tutorial (LEVEL_CHOICE 1)
	// is fixed at "Welcome Wing"; every other map rolls from its
	// archetype's pool via the NAME-tagged PRNG so the name is stable
	// across reloads of the same seed.
	const levelName = useMemo(
		() =>
			settings.level === 1
				? WELCOME_WING_NAME
				: pickLevelName(map.archetype, cyrb128(seedPhrase)[3]),
		[settings.level, map.archetype, seedPhrase],
	);

	const tuning = DIFFICULTY_TUNING[settings.difficulty];
	const maxHp = Math.round(PLAYER_MAX_HP * tuning.playerHpMultiplier);

	const [state, setState] = useState<GameState>(() => ({
		status: "landing",
		hp: maxHp,
		maxHp,
		kills: 0,
		score: 0,
		totalEnemies: map.enemySpawns.length,
		hasKey: false,
		hasFlashlight: false,
		hasEmfReader: false,
		hasSpiritBox: false,
		hasUvFlashlight: false,
		crucifixes: 0,
		weapon: "pistol",
		ammo: baseAmmo(),
		ownedWeapons: baseOwnedWeapons(),
		damageFlashAt: 0,
		run: makeInitialRunStats(0),
		phase: "out",
		goingBackDeadlineMs: null,
	}));
	const [touchMode, setTouchMode] = useState<boolean>(() =>
		resolveTouchMode(settings.touchControls),
	);

	// J3 — fade overlay trigger queue. Only the latest active trigger
	// renders; subsequent triggers replace it. AnimatePresence + a unique
	// id per trigger drive the enter/exit animation.
	const [fadeTrigger, setFadeTrigger] = useState<FadeTrigger | null>(null);
	const fadeIdRef = useRef(1);
	const triggerFadeRef = useRef<(kind: FadeKind, intensity?: number) => void>(() => undefined);
	const triggerFade = useCallback((kind: FadeKind, intensity = 1) => {
		setFadeTrigger({
			id: fadeIdRef.current++,
			kind,
			color: FADE_COLOR_BY_KIND[kind],
			peak: computeFadePeak(kind, intensity),
		});
	}, []);
	useEffect(() => {
		triggerFadeRef.current = triggerFade;
	}, [triggerFade]);
	const weaponStateRef = useRef<WeaponState>({
		weapon: state.weapon,
		ammo: state.ammo,
	});

	useEffect(() => {
		weaponStateRef.current = { weapon: state.weapon, ammo: state.ammo };
	}, [state.weapon, state.ammo]);

	useEffect(() => {
		const recompute = () => setTouchMode(resolveTouchMode(settings.touchControls));
		recompute();
		window.addEventListener("resize", recompute);
		// Also re-evaluate when the pointer-capability media query flips
		// (e.g. user plugs in a mouse on a 2-in-1, or DevTools toggles
		// device emulation). Without this, the shell can get stuck in
		// the wrong input mode until reload.
		const mq = typeof window.matchMedia === "function" ? window.matchMedia(TOUCH_AUTO_QUERY) : null;
		mq?.addEventListener?.("change", recompute);
		return () => {
			window.removeEventListener("resize", recompute);
			mq?.removeEventListener?.("change", recompute);
		};
	}, [settings.touchControls]);

	// CONV2 — GameRef callback construction extracted to useGameRef hook.
	// The hook owns the lastPlayerHitAt iframe gate, the ammoIncrement
	// table, and all 7 callback bodies. Shell only declares the deps.
	const gameRef = useGameRef({
		setState,
		triggerFadeRef,
		settings,
		tuning,
		seedPhrase,
		level: settings.level,
	});

	const updateSettings = useCallback((patch: Partial<BoneBusterSettings>) => {
		setSettings((prev) => ({ ...prev, ...patch }));
	}, []);

	const onStartGame = useCallback(async () => {
		if (settings.soundEnabled) {
			// A5 — SFX-critical (weapons, ambient, hit/death stings) blocks
			// the start sequence; music synth allocation deferred to
			// `ensureMusic()` below so time-to-first-interactive on
			// mobile drops by ~200-400ms.
			await ensureSfxCritical();
			startAmbient();
			// Kick off music synth allocation in parallel with the state
			// transition. We don't await — the transition flips to
			// playing immediately and music starts as soon as its
			// synths land.
			void ensureMusic().then(() => {
				setMusicMood("exploration");
				// POL33 — bus-gain shift per chosen difficulty.
				setMusicIntensityForDifficulty(settings.difficulty);
				startMusic();
			});
		}
		// Reset run state — preserves chosen settings + map seed.
		setState({
			status: "playing",
			hp: maxHp,
			maxHp,
			kills: 0,
			score: 0,
			totalEnemies: map.enemySpawns.length,
			hasKey: false,
			hasFlashlight: false,
			hasEmfReader: false,
			hasSpiritBox: false,
			hasUvFlashlight: false,
			crucifixes: 0,
			weapon: "pistol",
			ammo: baseAmmo(),
			ownedWeapons: baseOwnedWeapons(),
			damageFlashAt: 0,
			run: makeInitialRunStats(Date.now()),
			phase: "out",
			goingBackDeadlineMs: null,
		});
	}, [settings.soundEnabled, settings.difficulty, maxHp, map.enemySpawns.length]);

	const onReturnToLanding = useCallback(() => {
		stopAmbient();
		stopMusic();
		document.exitPointerLock?.();
		setState((prev) => {
			// E3 — if the run is mid-flight (paused/playing), preserve the seed
			// so we can resume the same map. Only re-roll when the run ended
			// (dead, won) or there's no live run to resume from.
			const preserveSeed = prev.status === "paused" || prev.status === "playing";
			if (!preserveSeed) {
				setSeedPhrase(randomSeedPhrase(createEventPrng(createFreshEventSeed())));
			}
			return { ...prev, status: "landing" };
		});
	}, []);

	// E3 — surface a "resume run" affordance on the landing when we have a
	// paused run that can be picked up. The user has to have actually clicked
	// MAIN MENU mid-run to get here; first-load lands on status "landing"
	// with no run.
	const onResumeRun = useCallback(() => {
		setState((prev) =>
			prev.status === "landing" && prev.hp > 0 ? { ...prev, status: "playing" } : prev,
		);
	}, []);

	// POL31 — monotonic run id, bumped on every landing→playing
	// transition. Threaded into BoneBusterHUD → HUDOverlays → DifficultyChip
	// where a useEffect on `runId` triggers the 2-second acknowledgment
	// chip. Prop-driven (not event-driven) because the HUD subtree only
	// mounts AFTER the landing→playing transition (AnimatePresence
	// mode="wait" adds a ~350ms exit animation), so an event would fire
	// before the listener exists; the chip's first effect after mount
	// runs *after* runId is non-zero, which is the natural trigger.
	const [runId, setRunId] = useState(0);
	const prevStatusRef = useRef<GameStatus>(state.status);
	useEffect(() => {
		const prev = prevStatusRef.current;
		prevStatusRef.current = state.status;
		if (prev === "landing" && state.status === "playing") {
			setRunId((id) => id + 1);
		}
	}, [state.status]);
	const hasPausedRun =
		state.status === "landing" &&
		state.run.runStartAt > 0 &&
		state.hp > 0 &&
		state.run.runLevelsCleared < 5;

	const onQuit = useCallback(() => {
		stopAmbient();
		stopMusic();
		document.exitPointerLock?.();
		try {
			const url = new URL(window.location.href);
			// Clear the seed param (+ its legacy alias) so the post-quit
			// landing page doesn't replay the just-finished run on reload.
			url.searchParams.delete("bonebusterSeed");
			url.searchParams.delete("objexoomSeed");
			window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
			window.location.reload();
		} catch {
			window.location.reload();
		}
	}, []);

	const onResume = useCallback(() => {
		setState((prev) => (prev.status === "paused" ? { ...prev, status: "playing" } : prev));
	}, []);

	// Whenever the map identity changes during an active run, refresh the
	// totalEnemies counter — the HUD reads it as the kill-count denominator.
	useEffect(() => {
		setState((prev) =>
			prev.status === "playing" || prev.status === "transitioning"
				? { ...prev, totalEnemies: map.enemySpawns.length }
				: prev,
		);
	}, [map]);

	// K5 — switch music mood based on phase. exploration → combat once
	// the player has taken any hit / is mid-fight; going_back overrides
	// when phase flips. Cheap heuristic: HP < maxHp signals engagement.
	// POL26 — fire the going-back klaxon once on the out → going_back
	// transition. The music-mood effect below handles ongoing audio;
	// this is the discrete "the alarm has gone off" sting.
	const lastPhaseRef = useRef<LevelPhase>(state.phase);
	useEffect(() => {
		if (!settings.soundEnabled) return;
		if (state.status !== "playing") return;
		const prevPhase = lastPhaseRef.current;
		lastPhaseRef.current = state.phase;
		if (prevPhase !== "going_back" && state.phase === "going_back") {
			playKlaxon();
		}
	}, [settings.soundEnabled, state.status, state.phase]);

	// POL37 — going-back countdown enforcement. Once per second check the
	// deadline; if elapsed without reachSpawn, drop hp to 0 (engine's
	// existing death handling carries the rest — no new state branch).
	useEffect(() => {
		if (state.status !== "playing") return;
		if (state.phase !== "going_back") return;
		if (state.goingBackDeadlineMs === null) return;
		const interval = window.setInterval(() => {
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				if (prev.phase !== "going_back") return prev;
				if (prev.goingBackDeadlineMs === null) return prev;
				if (performance.now() < prev.goingBackDeadlineMs) return prev;
				// Deadline elapsed — kill the player.
				return { ...prev, hp: 0 };
			});
		}, 250);
		return () => window.clearInterval(interval);
	}, [state.status, state.phase, state.goingBackDeadlineMs]);

	// SLA3 — boss-music shift. Track live boss-encounter state via
	// bossSpotted/bossDefeated channels. Any active boss takes
	// precedence over the combat/exploration mood; going_back still
	// wins (the going-back klaxon + library bed is the player's escape
	// signal — boss music shouldn't override it).
	const [bossActiveCount, setBossActiveCount] = useState(0);
	useEffect(() => {
		const offSpotted = addBoneBusterListener("bossSpotted", () => {
			setBossActiveCount((n) => n + 1);
		});
		const offDefeated = addBoneBusterListener("bossDefeated", () => {
			setBossActiveCount((n) => Math.max(0, n - 1));
		});
		return () => {
			offSpotted();
			offDefeated();
		};
	}, []);
	// Reset the boss counter when leaving the level — a fresh map's
	// bossSpotted dispatch shouldn't see a phantom count from the
	// previous level. The `map.seed` dep is intentional: it's the
	// trigger, not a body-read.
	// biome-ignore lint/correctness/useExhaustiveDependencies: map.seed is the trigger for the reset, not a body-read; biome's stricter inference would auto-fix to [] which breaks the level-transition reset.
	useEffect(() => {
		setBossActiveCount(0);
	}, [map.seedPhrase]);

	useEffect(() => {
		if (!settings.soundEnabled) return;
		if (state.status !== "playing") return;
		if (state.phase === "going_back") {
			setMusicMood("going_back");
		} else if (bossActiveCount > 0) {
			setMusicMood("boss");
		} else if (state.hp < state.maxHp) {
			setMusicMood("combat");
		} else {
			setMusicMood("exploration");
		}
	}, [settings.soundEnabled, state.status, state.phase, state.hp, state.maxHp, bossActiveCount]);

	// H4 — fall-to-death: PlayerController dispatches this when the player
	// has been below the local floor for longer than the grace window. Snap
	// status to dead so the YOU DIED card surfaces.
	useEffect(() => {
		return addBoneBusterListener("fellToDeath", () => {
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				// POL9 — player-death sting also on fall-to-death.
				if (settings.soundEnabled) playPlayerDeath();
				return { ...prev, status: "dead", hp: 0, damageFlashAt: performance.now() };
			});
		});
	}, [settings.soundEnabled]);

	// POL4 — increment the run's secret count on every secretTriggered event.
	// The event itself is fired by fireResolution when the player shoots a
	// secret switch. RunStats survives clearLevel so the win-screen totals
	// reflect every secret found across the whole 5-level run.
	useEffect(() => {
		return addBoneBusterListener("secretTriggered", () => {
			setState((prev) => ({ ...prev, run: runStatsReducer(prev.run, { type: "secretFound" }) }));
			// POL21 — secret-found audio sting. Distinct 4-note ascending
			// chime + brief reverb push so the discovery moment is
			// audible even with the eyes elsewhere.
			playSecretFound();
		});
	}, []);

	// E9 — persist run history on terminal status transitions. The handle is
	// lazily opened once per shell lifetime; sql.js init is a few hundred ms
	// of WASM compile so we don't want it on every record. The recorded-ref
	// gate keeps a single status flip from inserting twice if React 19's
	// strict-mode double-invokes the effect.
	const runHistoryRef = useRef<RunHistory | null>(null);
	const recordedRunRef = useRef<number>(0);
	useEffect(() => {
		if (state.status !== "dead" && state.status !== "won") return;
		if (recordedRunRef.current === state.run.runStartAt) return;
		recordedRunRef.current = state.run.runStartAt;
		void (async () => {
			try {
				if (!runHistoryRef.current) runHistoryRef.current = await openRunHistory();
				await runHistoryRef.current.insert(
					{
						startedAt: state.run.runStartAt,
						levelsCleared: state.run.runLevelsCleared,
						totalKills: state.run.runTotalKills,
						totalDamageTaken: state.run.runTotalDamageTaken,
						totalSecrets: state.run.runTotalSecrets,
						level: settings.level,
						outcome: state.status === "won" ? "won" : "died",
					},
					Date.now(),
				);
			} catch {
				// run-history is a nice-to-have; never block gameplay on it
			}
		})();
	}, [state.status, state.run, settings.level]);

	// B1/B4 — when a level is cleared on a chained run, hold for
	// TRANSITION_HOLD_MS to let the fade play, then advance settings.level
	// (or re-roll the seed for procedural mode) and flip back to "playing"
	// with HP/ammo/key reset (run stats preserved).
	useEffect(() => {
		if (state.status !== "transitioning") return;
		const timer = window.setTimeout(() => {
			if (settings.level === "procedural") {
				setSeedPhrase(randomSeedPhrase(createEventPrng(createFreshEventSeed())));
			} else {
				const next = advanceLevel(settings.level, state.run.runLevelsCleared);
				if (next !== null && next !== "procedural") {
					setSettings((prev) => ({ ...prev, level: next }));
				}
			}
			// PT1E — pure function decides "playing" vs "won". Bug
			// before: unconditionally set "playing", leaving the
			// player stuck at spawn with phase=going_back +
			// lastReachedSpawnAt=true on the final map (no remount
			// since level didn't advance, key didn't change).
			const nextStatus = nextStatusAfterTransition(settings.level, state.run.runLevelsCleared);
			setState((prev) => ({
				...prev,
				status: nextStatus,
				hp: prev.maxHp,
				kills: 0,
				score: 0,
				hasKey: false,
				hasFlashlight: false,
				hasEmfReader: false,
				hasSpiritBox: false,
				hasUvFlashlight: false,
				crucifixes: 0,
				weapon: "pistol",
				ammo: baseAmmo(),
				ownedWeapons: baseOwnedWeapons(),
				damageFlashAt: 0,
			}));
		}, TRANSITION_HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [state.status, state.run.runLevelsCleared, settings.level]);

	// Debug hooks for headed e2e tests. Only attached when ?bonebusterDebug is
	// present AND not in production. The contract is the only stable way to
	// drive the game from Playwright — pointer-lock + canvas-keyed input are
	// hostile to scripted automation.
	// Mirror state + map into refs so the debug-hook installer below can
	// install ONCE per game session instead of re-installing on every
	// state/map change. Re-install caused a tiny window where the global
	// was undefined; e2e loops calling start → triggerWin → next-level
	// six times in a row hit that window often enough to flake.
	const stateRef = useRef(state);
	stateRef.current = state;
	const mapRef = useRef(map);
	mapRef.current = map;
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	const onStartGameRef = useRef(onStartGame);
	onStartGameRef.current = onStartGame;

	// biome-ignore lint/correctness/useExhaustiveDependencies: gameRef is a stable useRef from useGameRef; .current is intentionally read at debug-call time, never as a dependency
	useEffect(() => {
		if (!debugHooksEnabled()) return;
		window.__bonebuster = {
			getState: () => {
				const s = stateRef.current;
				const m = mapRef.current;
				return {
					...s,
					mapKind: m.kind,
					playerSpawn: m.playerSpawn,
					keyPosition: m.keyPosition,
					exitPosition: m.exitPosition,
					enemySpawns: m.enemySpawns,
					totalEnemies: s.totalEnemies,
				};
			},
			start: () => {
				onStartGameRef.current();
			},
			teleport: (x, y, yawRad) => {
				dispatch({ type: "teleport", x, y, yaw: yawRad ?? null });
			},
			fire: () => {
				dispatch({ type: "fire" });
			},
			killAllEnemies: () => {
				dispatch({ type: "debugKillAll" });
			},
			// PT3A — boss-only kill for isolated boss-tier visual capture.
			killBoss: () => {
				dispatch({ type: "debugKillBoss" });
			},
			// E8 step-2 / PT4 — debug weapon switch so playtest can frame
			// individual weapon visuals without going through pickup +
			// keyboard 1-5 swap. Also grants pickupAmmo for the weapon
			// so a debug fire isn't a no-op for weapons with
			// startingAmmo=0 (chaingun/shotgun/flamethrower).
			selectWeapon: (weapon: WeaponId) => {
				setState((prev) => ({
					...prev,
					weapon,
					ownedWeapons: { ...prev.ownedWeapons, [weapon]: true },
					ammo: {
						...prev.ammo,
						[weapon]: Math.max(prev.ammo[weapon], WEAPONS[weapon].pickupAmmo),
					},
				}));
			},
			collectKey: () => {
				gameRef.current.onPickupKey();
			},
			collectAllPickups: () => {
				dispatch({ type: "debugCollectPickups" });
			},
			triggerWin: () => {
				gameRef.current.onWin();
			},
			// PT1B — short-circuit to the win state so playtest/e2e can verify
			// the MissionCompleteCeremony renders without grinding through
			// all RUN_LENGTH levels (which has its own engine timing quirks).
			forceMissionComplete: () => {
				setState((prev) => ({ ...prev, status: "won" }));
			},
			setDifficulty: (difficulty: Difficulty) => {
				setSettings((prev) => ({ ...prev, difficulty }));
			},
			getSettings: () => settingsRef.current,
		};
		return () => {
			delete window.__bonebuster;
		};
	}, []);

	const onSelectWeapon = useCallback(
		(weapon: WeaponId) => {
			setState((prev) => {
				if (!prev.ownedWeapons[weapon]) return prev;
				if (prev.weapon === weapon) return prev;
				return { ...prev, weapon };
			});
			if (settings.soundEnabled) playPickup();
		},
		[settings.soundEnabled],
	);

	useEffect(() => {
		if (touchMode) return;
		const onPointerLockChange = () => {
			if (document.pointerLockElement) return;
			setState((prev) => (prev.status === "playing" ? { ...prev, status: "paused" } : prev));
		};
		document.addEventListener("pointerlockchange", onPointerLockChange);
		return () => document.removeEventListener("pointerlockchange", onPointerLockChange);
	}, [touchMode]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.code === "Escape" && state.status === "playing") {
				setState((prev) => ({ ...prev, status: "paused" }));
				return;
			}
			if (state.status !== "playing") return;
			if (e.code === "Digit1") onSelectWeapon("pistol");
			else if (e.code === "Digit2") onSelectWeapon("chaingun");
			else if (e.code === "Digit3") onSelectWeapon("shotgun");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state.status, onSelectWeapon]);

	useEffect(() => {
		if (touchMode || state.status !== "playing") return;
		const onWheel = (e: WheelEvent) => {
			if (!document.pointerLockElement) return;
			e.preventDefault();
			const owned = WEAPON_ORDER.filter((w) => state.ownedWeapons[w]);
			if (owned.length < 2) return;
			const idx = owned.indexOf(state.weapon);
			const next = owned[(idx + (e.deltaY > 0 ? 1 : owned.length - 1)) % owned.length];
			// next is provably defined: the modulo operand is owned.length
			// (≥2 after the guard above) so the result is always in-bounds.
			if (next === undefined) return;
			onSelectWeapon(next);
		};
		window.addEventListener("wheel", onWheel, { passive: false });
		return () => window.removeEventListener("wheel", onWheel);
	}, [touchMode, state.status, state.weapon, state.ownedWeapons, onSelectWeapon]);

	useEffect(
		() => () => {
			stopAmbient();
		},
		[],
	);

	const showLanding = state.status === "landing";
	const showGame = state.status !== "landing";

	return (
		<div
			data-testid="bonebuster-shell"
			role="dialog"
			aria-label="Bone Buster"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2000,
				background: `radial-gradient(circle at 50% 30%, ${ROLE.bgWorld} 0%, ${SCALE.ink[950]} 100%)`,
				display: "grid",
				placeItems: "center",
				padding:
					"max(0px, env(safe-area-inset-top)) max(0px, env(safe-area-inset-right)) max(0px, env(safe-area-inset-bottom)) max(0px, env(safe-area-inset-left))",
			}}
		>
			<div
				style={{
					position: "relative",
					// BC4/BC7 — on desktop the game frames as a 1280x800
					// cabinet centered on the page. On touch (phones,
					// foldables, tablets) the desktop frame leaves huge
					// black bands on tall portrait viewports — fill the
					// full viewport instead so the HUD reaches the edges
					// and the background gradient covers the page.
					width: touchMode ? "100%" : "min(100vw, 1280px)",
					height: touchMode ? "100%" : "min(100vh, 800px)",
					maxWidth: "100%",
					maxHeight: "100%",
					borderRadius: touchMode ? 0 : 20,
					overflow: "hidden",
					boxShadow: touchMode
						? "none"
						: `0 30px 80px -20px ${SCALE.ink[950]}b3, 0 0 0 1px ${ROLE.borderSoft}`,
					background: ROLE.bgWorld,
				}}
			>
				<AnimatePresence mode="wait">
					{showLanding && (
						<motion.div
							key="landing"
							style={layerStyle}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.35 }}
						>
							<BoneBusterLanding
								settings={settings}
								onSettingsChange={updateSettings}
								onStart={onStartGame}
								onQuit={onQuit}
								canResume={hasPausedRun}
								onResume={onResumeRun}
							/>
						</motion.div>
					)}
					{showGame && (
						<motion.div
							key="game"
							style={layerStyle}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.4 }}
						>
							<Canvas
								camera={{
									fov: 75,
									near: 0.1,
									far: 200,
									position: [0, 1.7, 0],
								}}
								gl={{ antialias: false, powerPreference: "low-power" }}
								style={{ width: "100%", height: "100%", display: "block" }}
								dpr={[1, 1.5]}
								// J4 — enable shadow mapping. The flashlight + sun cast;
								// floors + walls + enemies receive. Budget: PCF soft
								// shadows at 1024² to keep mobile happy.
								shadows="soft"
							>
								{/* Re-key on map identity so enemies/pickups/bullets/lastWonAt
								    reset between levels. Without this, Section B level
								    transitions silently inherit dead state from level 1. */}
								<BoneBusterScene
									key={`${settings.level}-${seedPhrase}-${map.seedPhrase}`}
									map={map}
									active={state.status === "playing"}
									hasKey={state.hasKey}
									gameRef={gameRef}
									weapon={state.weapon}
									ammoRef={weaponStateRef}
									settings={settings}
									phase={state.phase}
									hasFlashlight={state.hasFlashlight}
									hasEmfReader={state.hasEmfReader}
									hasSpiritBox={state.hasSpiritBox}
									hasUvFlashlight={state.hasUvFlashlight}
								/>
							</Canvas>
							<BoneBusterHUD
								state={state}
								touchMode={touchMode}
								onResume={onResume}
								onReturnToLanding={onReturnToLanding}
								onQuit={onQuit}
								onSelectWeapon={onSelectWeapon}
								levelName={levelName}
								difficulty={settings.difficulty}
								runId={runId}
							/>
							<AnimatePresence>
								{fadeTrigger && <FadeOverlay key={fadeTrigger.id} trigger={fadeTrigger} />}
							</AnimatePresence>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

// J3 — generic colored fade overlay. Each new `trigger.id` makes
// AnimatePresence re-mount the motion.div, which restarts the
// peak-then-fade envelope. The color and peak come from the trigger
// dispatched by triggerFade().
//
// J8 — when prefers-reduced-motion is set, render a static low-opacity
// frame instead of an animated flash so the signal still lands but
// nothing flickers.
function FadeOverlay({ trigger }: { trigger: FadeTrigger }) {
	const reduced = useReducedMotion();
	const peak = reduced ? Math.min(0.18, trigger.peak * 0.5) : trigger.peak;
	const animate = reduced ? { opacity: peak } : { opacity: [0, peak, 0] };
	const transition = reduced ? { duration: 0.2 } : { duration: 0.6, times: [0, 0.33, 1] };
	return (
		<motion.div
			data-testid="bonebuster-fade-overlay"
			data-fade-kind={trigger.kind}
			initial={{ opacity: 0 }}
			animate={animate}
			transition={transition}
			style={{
				position: "absolute",
				inset: 0,
				background: trigger.color,
				pointerEvents: "none",
				mixBlendMode: trigger.kind === "damage" ? "screen" : "normal",
			}}
		/>
	);
}

const layerStyle = {
	position: "absolute" as const,
	inset: 0,
};
