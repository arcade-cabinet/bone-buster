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
import { addBoneBusterListener, dispatch } from "@engine/events";
import type { BoneBusterMap } from "@engine/mapTypes";
import { createEventPrng, createFreshEventSeed, cyrb128 } from "@engine/rng";
import { CANONICAL_SEED_PHRASE, randomSeedPhrase } from "@engine/seedPhrase";
import {
	advanceAndPersistEventSeed,
	loadBiomePressure,
	loadEventSeed,
	saveBiomePressure,
} from "@platform/persistence/eventSeed";
import { loadSettings, saveSettings } from "@platform/persistence/settingsStore";
import { Canvas } from "@react-three/fiber";
import { PLAYER_MAX_HP } from "@shared/constants";
import { computeFadePeak, FADE_COLOR_BY_KIND } from "@shared/fadeTriggers";
import { WEAPON_ORDER, WEAPONS, type WeaponId } from "@shared/weapons";
import type {
	FadeKind,
	FadeTrigger,
	GameState,
	GameStatus,
	LevelPhase,
	WeaponState,
} from "@store/gameState";
import { openRunHistory, type RunHistory } from "@store/runHistory";
import { makeInitialRunStats, runStatsReducer } from "@store/runStats";
import {
	type BoneBusterSettings,
	DEFAULT_SETTINGS,
	DIFFICULTY_TUNING,
	type Difficulty,
	type TouchControlMode,
} from "@store/settings";
import { ROLE, SCALE } from "@styles/tokens/index";
import { AssetErrorBoundary, type AssetErrorReason } from "@views/AssetErrorBoundary";
import { AssetErrorModal } from "@views/AssetErrorModal";
import { BoneBusterHUD } from "@views/HUD";
import { HudFrame } from "@views/HudFrame";
import { BoneBusterLanding } from "@views/Landing";
import { BoneBusterScene } from "@views/Scene";
import {
	captureModeEnabled,
	debugHooksEnabled,
	readArchetypeFromUrl,
	readSeedPhraseFromUrl,
} from "@views/urlFlags";
import { applyArchetypeOverride, archetypeForPhrase } from "@world/archetype";
import { type BiomePressure, initialBiomePressure, pickBiome } from "@world/biomePressure";
import { buildMap } from "@world/buildMap";
import { pickLevelName } from "@world/levelNames";
import type { PropArchetype } from "@world/scatter/propPool";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameRef } from "../../src/scene/hooks/useGameRef";
import { useLevelTransition } from "./hooks/useLevelTransition";

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
	// SEED4 — the device-persistent event-PRNG seed (Capacitor Preferences).
	// Loaded once on mount; `rollSeedPhrase` advances it (persisting the new
	// value) and draws a fresh suggested phrase, so each roll/new-game uses a
	// deterministic-but-fresh event stream rather than an inline crypto mint.
	const eventSeedRef = useRef<string | null>(null);
	// SEED4 — true once a roll (or any advance) has taken ownership of the
	// event stream. Guards against the bootstrap loadEventSeed().then() landing
	// LATE and rewinding eventSeedRef back to the persisted value after the user
	// already randomized — which would replay a stale stream head on the next roll.
	const eventSeedOwnedRef = useRef(false);
	useEffect(() => {
		let cancelled = false;
		void loadEventSeed().then((s) => {
			if (!cancelled && !eventSeedOwnedRef.current) eventSeedRef.current = s;
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const rollSeedPhrase = useCallback(() => {
		// Draw the suggested phrase from the current event stream, then advance
		// + persist the buried seed for the next roll. Falls back to a fresh
		// mint if Preferences hasn't resolved yet (first frames after mount).
		const seed = eventSeedRef.current ?? createFreshEventSeed();
		// INF3 — preserve a forced `?bonebusterArchetype` across rerolls: rewrite
		// the freshly drawn phrase so it still hashes to the chosen archetype,
		// exactly as the initial URL-seed path (readSeedFromUrl) does. Without
		// this, RANDOMIZE on a forced-archetype run would escape to whatever the
		// raw phrase hashes to.
		const phrase = applyArchetypeOverride(
			randomSeedPhrase(createEventPrng(seed)),
			readArchetypeFromUrl(),
		);
		setSeedPhrase(phrase);
		// Take ownership so a late bootstrap load can't rewind the stream head.
		eventSeedOwnedRef.current = true;
		void advanceAndPersistEventSeed(seed).then((next) => {
			eventSeedRef.current = next;
		});
	}, []);
	const [settings, setSettings] = useState<BoneBusterSettings>(DEFAULT_SETTINGS);
	// STRUCT1/STRUCT5 — the CURRENT biome skin (pressure-picked) + the
	// device-persistent biome-pressure map. The biome is the archetype that
	// "wears" the depth-keyed geometry; it's chosen by `pickBiome` off the
	// event PRNG at New Game and again on each level clear (the transition
	// hook). Seeded initially from the phrase's archetype so the canonical
	// phrase still reads as corridor at depth 0 (pins the canonical baseline
	// before any roll). `pressure` advances with each pick + persists.
	const [biome, setBiome] = useState<PropArchetype>(() => archetypeForPhrase(seedPhrase));
	// STRUCT1 — the current descent DEPTH (= biomes cleared so far). Drives the
	// per-depth geometry fork. Kept in lockstep with `run.runLevelsCleared`:
	// New Game resets it to 0, the transition hook bumps it on each clear. It's
	// a separate state (not read off `state.run`) so the map useMemo can sit
	// above the GameState declaration without an ordering cycle.
	const [depth, setDepth] = useState(0);
	const pressureRef = useRef<BiomePressure>(initialBiomePressure());
	// STRUCT5 — hydrate the persisted biome pressure once on mount (device
	// state, not game state). The current biome stays phrase-seeded until the
	// next New Game / transition pick consumes the pressure.
	// STRUCT5 — true once a New-Game reset has taken ownership of the pressure
	// map, so a late-resolving hydrate can't clobber a fresh run (mirrors
	// eventSeedOwnedRef — review STRUCT1b#2).
	const pressureOwnedRef = useRef(false);
	useEffect(() => {
		let cancelled = false;
		void loadBiomePressure().then((p) => {
			if (!cancelled && !pressureOwnedRef.current) pressureRef.current = p;
		});
		return () => {
			cancelled = true;
		};
	}, []);
	// STRUCT5 — pressure-pick the next biome off the event PRNG, advance +
	// persist the pressure map, and set it as the current biome. Used both at
	// New Game (kicks the descent off a fresh pressure map) and on each level
	// clear (the transition hook). The pick uses the device event seed — biome
	// order is per-run variance, NOT map identity, so it never touches the phrase.
	const advanceBiome = useCallback(() => {
		// Review STRUCT1b#1 — ADVANCE the buried event seed each pick so every
		// transition draws a FRESH stream position. Rebuilding createEventPrng
		// from an unchanged seed returned the identical roll every level, making
		// the biome order a deterministic function of pressure alone (the "never
		// predictable" promise was broken). Advancing + persisting the seed (like
		// rollSeedPhrase) keeps the variance AND survives reloads.
		const seed = eventSeedRef.current ?? createFreshEventSeed();
		const rng = createEventPrng(seed);
		const { biome: next, pressure } = pickBiome(pressureRef.current, rng);
		// ADVANCE + persist the buried event seed (same pattern as rollSeedPhrase)
		// so the NEXT pick draws a fresh stream position — without this, every
		// transition rebuilt createEventPrng from the unchanged seed and got the
		// identical roll, making biome order deterministic-by-pressure.
		eventSeedOwnedRef.current = true;
		void advanceAndPersistEventSeed(seed).then((advanced) => {
			eventSeedRef.current = advanced;
		});
		pressureRef.current = pressure;
		pressureOwnedRef.current = true;
		setBiome(next);
		void saveBiomePressure(pressure);
		return next;
	}, []);
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

	// STO1a — async-hydrate persisted settings on mount. If no blob
	// exists, the loaded value equals DEFAULT_SETTINGS and the
	// setSettings call is a no-op against initial state — no extra render.
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
				setSettings(persisted);
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
	// VIS-AUTO — resolved once; the e2e harness needs a readable drawing buffer.
	// useState initializer (not useMemo) so it's evaluated exactly once on mount
	// and never re-reads window during the session.
	const [preserveDrawingBuffer] = useState(captureModeEnabled);
	// ERR1 — asset-load error surfaced by the AssetErrorBoundary around the
	// Canvas. Discriminated by null (ok) vs a reason object (error → modal).
	const [assetError, setAssetError] = useState<AssetErrorReason | null>(null);
	const map: BoneBusterMap = useMemo(
		// STRUCT1 — geometry forks off (phrase, depth); the pressure-picked
		// biome drives the archetype skin + per-biome shape over it.
		() => buildMap(seedPhrase, depth, biome, settings.difficulty),
		[seedPhrase, depth, biome, settings.difficulty],
	);
	// D8 — alliterative level name. Rolls from the current biome's pool via
	// the NAME-tagged PRNG (seed-stable). The depth mixes into the seed so
	// successive levels of the same descent get distinct names.
	const levelName = useMemo(
		() => pickLevelName(map.archetype, cyrb128(seedPhrase)[3] ^ depth),
		[map.archetype, seedPhrase, depth],
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
	// CR-H1scene step-d — authoritative current state, kept fresh every render.
	// useGameRef's reducer adapter reads `stateRef.current` (and writes the
	// reduced result back to it) so synchronous same-batch GameRef calls
	// accumulate correctly without a functional setState updater. Declared here
	// (above the useGameRef call) so it can be passed in as a dep.
	const stateRef = useRef(state);
	stateRef.current = state;
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
		stateRef,
		triggerFadeRef,
		settings,
		tuning,
		seedPhrase,
	});

	const updateSettings = useCallback((patch: Partial<BoneBusterSettings>) => {
		setSettings((prev) => ({ ...prev, ...patch }));
	}, []);

	const onStartGame = useCallback(async () => {
		// ERR1 — clear any stale asset error from a prior run so a fresh start
		// doesn't ghost-modal over a level that hasn't tried to load yet.
		setAssetError(null);
		// STRUCT1/STRUCT5 — a New Game restarts the descent at depth 0 and
		// pressure-picks the opening biome off a FRESH pressure map (every
		// biome equally stale). This is the only place the descent resets.
		setDepth(0);
		pressureRef.current = initialBiomePressure();
		pressureOwnedRef.current = true; // a late hydrate must not clobber the fresh run
		advanceBiome();
		if (settings.soundEnabled) {
			// A5 — SFX-critical (weapons, ambient, hit/death stings) blocks
			// the start sequence; music synth allocation deferred to
			// `ensureMusic()` below so time-to-first-interactive on
			// mobile drops by ~200-400ms.
			// M-5 — audio init must NEVER block the game from starting. A
			// failed AudioContext unlock (autoplay policy, no device, a
			// throwing Howler init) would otherwise skip the setState below
			// and leave the player stuck on landing. Swallow + dev-log; the
			// run starts silent rather than not at all.
			// no-visual-impact: wraps audio init in try/catch so a failed unlock cannot block the playing-state transition; rendering is unchanged
			try {
				await ensureSfxCritical();
				startAmbient();
				// Kick off music synth allocation in parallel with the state
				// transition. We don't await — the transition flips to
				// playing immediately and music starts as soon as its
				// synths land.
				void ensureMusic()
					.then(() => {
						setMusicMood("exploration");
						// POL33 — bus-gain shift per chosen difficulty.
						setMusicIntensityForDifficulty(settings.difficulty);
						startMusic();
					})
					.catch((err) => {
						if (import.meta.env.DEV) console.warn("[bonebuster] music init failed:", err);
					});
			} catch (err) {
				if (import.meta.env.DEV) console.warn("[bonebuster] audio init failed:", err);
			}
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
	}, [settings.soundEnabled, settings.difficulty, maxHp, map.enemySpawns.length, advanceBiome]);

	const onReturnToLanding = useCallback(() => {
		stopAmbient();
		stopMusic();
		document.exitPointerLock?.();
		// ERR1 — drop any asset error so the modal doesn't linger on the menu.
		setAssetError(null);
		setState((prev) => {
			// E3 — if the run is mid-flight (paused/playing), preserve the seed
			// so we can resume the same map. Only re-roll when the run ended
			// (dead, won) or there's no live run to resume from.
			const preserveSeed = prev.status === "paused" || prev.status === "playing";
			if (!preserveSeed) {
				rollSeedPhrase();
			}
			return { ...prev, status: "landing" };
		});
	}, [rollSeedPhrase]);

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
	// STRUCT1 (endless) — a run is resumable whenever it's mid-flight and the
	// player is alive. There's no campaign length cap to bound it against.
	const hasPausedRun = state.status === "landing" && state.run.runStartAt > 0 && state.hp > 0;

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
						// STRUCT1 — the descent identity is the seed phrase now.
						levelSet: seedPhrase,
						outcome: state.status === "won" ? "won" : "died",
					},
					Date.now(),
				);
			} catch {
				// run-history is a nice-to-have; never block gameplay on it
			}
		})();
	}, [state.status, state.run, seedPhrase]);

	// STRUCT1 — bump the descent depth (the geometry forks per depth). Kept in
	// lockstep with run.runLevelsCleared, which the reducer already incremented
	// on the clear that triggered this transition.
	const advanceDepth = useCallback(() => setDepth((d) => d + 1), []);

	// STRUCT1 — level-transition lifecycle (hold-for-fade → advance depth +
	// biome → reset the per-level slice → "playing") lives in useLevelTransition.
	// `freshLevelSlice` is the HP/ammo/key/tools reset merged over prev; run
	// stats are preserved by NOT including them here.
	const freshLevelSlice = useCallback(
		(): Partial<GameState> => ({
			hp: maxHp,
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
		}),
		[maxHp],
	);
	useLevelTransition({
		status: state.status,
		setState,
		advanceDepth,
		advanceBiome,
		freshLevelSlice,
	});

	// Debug hooks for headed e2e tests. Only attached when ?bonebusterDebug is
	// present AND not in production. The contract is the only stable way to
	// drive the game from Playwright — pointer-lock + canvas-keyed input are
	// hostile to scripted automation.
	// Mirror state + map into refs so the debug-hook installer below can
	// install ONCE per game session instead of re-installing on every
	// state/map change. Re-install caused a tiny window where the global
	// was undefined; e2e loops calling start → triggerWin → next-level
	// six times in a row hit that window often enough to flake.
	// (stateRef is declared above, before the useGameRef call — step-d.)
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
					archetype: m.archetype,
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
			// the MissionCompleteCeremony renders without grinding through a long
			// descent (the endless run never naturally reaches "won").
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
								seedPhrase={seedPhrase}
								onSeedPhraseChange={setSeedPhrase}
								onRandomizeSeedPhrase={() => rollSeedPhrase()}
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
							{/* ERR1 — boundary around the Canvas: a failed GLB/texture/
							    wasm load throws out of the scene Suspense; without this
							    React would unmount to a silent blank canvas. The
							    boundary emits bonebuster:assetError + lifts the reason
							    so the modal below renders. */}
							<AssetErrorBoundary onError={setAssetError}>
								<Canvas
									camera={{
										fov: 75,
										near: 0.1,
										far: 200,
										position: [0, 1.7, 0],
									}}
									gl={{ antialias: false, powerPreference: "low-power", preserveDrawingBuffer }}
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
										key={`${depth}-${biome}-${seedPhrase}-${map.seedPhrase}`}
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
							</AssetErrorBoundary>
							{/* HUD1 — frame the scene (chrome cockpit on large screens,
							    subtle vignette on phones; responsive). Sits above the
							    Canvas, below the HUD chips. */}
							<HudFrame />
							{assetError && <AssetErrorModal reason={assetError} />}
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
