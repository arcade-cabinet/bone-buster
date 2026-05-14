import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ARCHETYPE_NAMES, pickArchetype } from "./archetype";
import { buildMap } from "./buildMap";
import { PLAYER_MAX_HP } from "./constants";
import { ROLE, SCALE } from "./design-tokens";
import type { ObjexoomMap, PickupKind } from "./engine";
import { addObjexoomListener, dispatch } from "./events";
import { pickLootKind } from "./loot";
import { ObjexoomHUD } from "./ObjexoomHUD";
import { ObjexoomLanding } from "./ObjexoomLanding";
import { ObjexoomScene } from "./ObjexoomScene";
import { openRunHistory, type RunHistory } from "./runHistory";
import { advanceLevel, makeInitialRunStats, type RunStats, runStatsReducer } from "./runStats";
import { DEFAULT_SETTINGS, DIFFICULTY_TUNING, type ObjexoomSettings } from "./settings";
import {
	ensureSfx,
	playFlashlightClick,
	playHitSting,
	playKlaxon,
	playPickup,
	playPlayerDeath,
	playSecretFound,
	setMusicMood,
	startAmbient,
	startMusic,
	stopAmbient,
	stopMusic,
} from "./sfx";
import { WEAPON_ORDER, WEAPONS, type WeaponId } from "./weapons";

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
	weapon: WeaponId;
	ammo: Record<WeaponId, number>;
	ownedWeapons: Record<WeaponId, boolean>;
	damageFlashAt: number;
	run: RunStats;
	phase: LevelPhase;
};

export const TRANSITION_HOLD_MS = 800;
export const RUN_LENGTH = 5;

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
};

const isCoarsePointer = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(pointer: coarse)").matches;

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

const ammoIncrement: Record<
	PickupKind,
	{ weapon: WeaponId; amount: number } | "health" | "flashlight" | "loot"
> = {
	health: "health",
	chaingunAmmo: { weapon: "chaingun", amount: WEAPONS.chaingun.pickupAmmo },
	shotgunAmmo: { weapon: "shotgun", amount: WEAPONS.shotgun.pickupAmmo },
	// J1 — flashlight is a binary owned/not-owned switch on GameState.
	flashlight: "flashlight",
	// COV12 step-2 — sentinel; per-lootKind bonus resolution happens at
	// collect time using `pickLootKind(seed)` because the discriminator
	// lives on the map seed, not on the PickupKind itself.
	loot: "loot",
};

function readSeedFromUrl(): number {
	const base = readBaseSeedFromUrl();
	return applyArchetypeOverride(base, readArchetypeFromUrl());
}

function readBaseSeedFromUrl(): number {
	if (typeof window === "undefined") return Date.now() & 0xffffffff;
	try {
		const url = new URL(window.location.href);
		const raw = url.searchParams.get("objexoomSeed");
		if (raw && /^[0-9]+$/.test(raw)) {
			return Number.parseInt(raw, 10) & 0xffffffff;
		}
	} catch {
		// fall through
	}
	return Date.now() & 0xffffffff;
}

function readArchetypeFromUrl(): string | null {
	if (typeof window === "undefined") return null;
	try {
		const url = new URL(window.location.href);
		return url.searchParams.get("objexoomArchetype");
	} catch {
		return null;
	}
}

/**
 * INF3 — rewrite a seed so `pickArchetype(map)` lands on the requested
 * archetype. The mapping in `archetype.ts` is `seed % 5`, so we shift
 * `seed` by `-(seed % 5) + wantedIndex`. Returns the seed unchanged
 * when `archetype` is null / unknown.
 *
 * Exported for the unit test that pins the invariant: after override
 * the seed satisfies `seed % 5 === wantedIndex` for every input seed.
 */
export function applyArchetypeOverride(seed: number, archetype: string | null): number {
	if (!archetype) return seed;
	const idx = ARCHETYPE_NAMES.indexOf(archetype as (typeof ARCHETYPE_NAMES)[number]);
	if (idx < 0) return seed;
	const s = seed >>> 0;
	return ((s - (s % ARCHETYPE_NAMES.length) + idx) >>> 0) & 0xffffffff;
}

function debugHooksEnabled(): boolean {
	if (typeof window === "undefined") return false;
	if (process.env.NODE_ENV === "production") return false;
	try {
		return new URL(window.location.href).searchParams.has("objexoomDebug");
	} catch {
		return false;
	}
}

declare global {
	interface Window {
		__objexoom?: {
			getState: () => unknown;
			start: () => void;
			teleport: (x: number, y: number, yawRad?: number) => void;
			fire: () => void;
			killAllEnemies: () => void;
			collectKey: () => void;
			collectAllPickups: () => void;
			triggerWin: () => void;
		};
	}
}

export function ObjexoomShell() {
	const [seed, setSeed] = useState(readSeedFromUrl);
	// INF3 — when `?objexoomArchetype` is present, switch the level to
	// procedural so the seed rewrite (and thus the archetype pick)
	// actually drives map generation. Without this override the default
	// `level: 1` would load the baked refLevel 0 (corridor) and the
	// archetype flag would silently no-op.
	const [settings, setSettings] = useState<ObjexoomSettings>(() =>
		readArchetypeFromUrl() ? { ...DEFAULT_SETTINGS, level: "procedural" } : DEFAULT_SETTINGS,
	);
	const map: ObjexoomMap = useMemo(
		// I4 — difficulty plumbed through so ManyEnemies (class 9) expands
		// per the ref formula. Procedural maps don't read it.
		() => buildMap(seed, settings.level, settings.difficulty),
		[seed, settings.level, settings.difficulty],
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
		weapon: "pistol",
		ammo: baseAmmo(),
		ownedWeapons: baseOwnedWeapons(),
		damageFlashAt: 0,
		run: makeInitialRunStats(0),
		phase: "out",
	}));
	const [touchMode, setTouchMode] = useState<boolean>(() => isCoarsePointer());

	// J3 — fade overlay trigger queue. Only the latest active trigger
	// renders; subsequent triggers replace it. AnimatePresence + a unique
	// id per trigger drive the enter/exit animation.
	const [fadeTrigger, setFadeTrigger] = useState<FadeTrigger | null>(null);
	const fadeIdRef = useRef(1);
	const triggerFadeRef = useRef<(kind: FadeKind, intensity?: number) => void>(() => undefined);
	const triggerFade = useCallback((kind: FadeKind, intensity = 1) => {
		const colorByKind: Record<FadeKind, string> = {
			damage: ROLE.actionDamage,
			key: SCALE.amber[400],
			flash: SCALE.parchment[50],
			win: SCALE.parchment[50],
		};
		const peakByKind: Record<FadeKind, number> = {
			damage: 0.55,
			key: 0.4,
			flash: 0.5,
			win: 0.85,
		};
		setFadeTrigger({
			id: fadeIdRef.current++,
			kind,
			color: colorByKind[kind],
			peak: Math.min(1, peakByKind[kind] * intensity),
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
		const onResize = () => setTouchMode(isCoarsePointer());
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// I5 — i-frame gate. Enemies cannot multi-hit per frame; cooldown
	// scales by difficulty (tuning.playerIframeMs). Held outside React
	// state so the gate is decision-time rather than render-time.
	const lastPlayerHitAt = useRef(0);

	const gameRef = useRef<GameRef>({
		onHit: (damage) => {
			const now = performance.now();
			if (now - lastPlayerHitAt.current < tuning.playerIframeMs) return;
			lastPlayerHitAt.current = now;
			// I6 — camera shake amount scales with raw incoming damage; the
			// controller decays at SHAKE_DECAY/sec and applies XZ jitter.
			dispatch({ type: "shake", amount: damage });
			// I2 — 30 red motes at the player on every successful enemy hit
			// (post-iframe gate so the visual matches actual damage taken).
			// Scene resolves the player position from the camera and emits the
			// burst there; this is the wakeup, not the placement.
			dispatch({ type: "playerHit" });
			// J3 — red fade overlay scaled by damage. On the 0-9 HP scale,
			// 3 hp = max-flash; 1 hp = 1/3.
			triggerFadeRef.current("damage", Math.min(1, damage / 3));
			// K2 — sharp hit sting (distinct from the ambient playHurt the
			// Scene already fires).
			if (settings.soundEnabled) playHitSting();
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				const finalDamage = Math.round(damage * tuning.enemyDamageMultiplier);
				const hp = Math.max(0, prev.hp - finalDamage);
				// POL9 — player-death sting fires exactly once on the HP→0
				// transition. Inside the setState updater so React 19 strict-
				// mode's double-invoke doesn't double-play; we read prev.hp
				// (was > 0) and current hp (now 0) as the gate.
				if (prev.hp > 0 && hp === 0 && settings.soundEnabled) {
					playPlayerDeath();
				}
				return {
					...prev,
					hp,
					status: hp <= 0 ? "dead" : prev.status,
					damageFlashAt: now,
					// Pre-aggregate per-level damage on the live counter; the reducer
					// rolls these into the run totals on level-clear.
					run: {
						...prev.run,
						runTotalDamageTaken: prev.run.runTotalDamageTaken + finalDamage,
					},
				};
			});
		},
		onKill: () => {
			// Clamp per-level kill counter at totalEnemies. The Scene
			// fires onKill once per HP-zero transition, but debug paths
			// (`killAllEnemies` looped in tests, or rapid double-fire)
			// can re-trigger on already-dead enemies; the HUD reads
			// `kills / totalEnemies` so an unclamped counter renders
			// nonsense like "9 / 3".
			setState((prev) => ({
				...prev,
				kills: Math.min(prev.kills + 1, prev.totalEnemies),
				run: {
					...prev.run,
					runTotalKills: prev.run.runTotalKills + 1,
				},
			}));
		},
		onPickupKey: () => {
			// H6 — `playDoor` now fires from the LockedDoor mesh on the open
			// animation transition; key pickup is the pickup chime only.
			playPickup();
			triggerFadeRef.current("key");
			setState((prev) => ({ ...prev, hasKey: true }));
			// POL22 — fire the typed event consumed by the
			// KeyPickupCeremony HUD overlay slot.
			dispatch({ type: "keyPickedUp" });
		},
		onWin: () => {
			// H8 — first "win" trigger (player crossed the RealDoor) flips
			// phase from "out" → "going_back". Every enemy re-aggros, lights
			// strobe, music dies, and the player must fight back to the
			// original spawn. The actual level-clear fires on `onReachSpawn`.
			// L2 — goal-collect also drops the chaingun + shotgun so the
			// going-back fight has firepower (ref's "RealDoor drop" pattern).
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				if (prev.phase === "going_back") return prev;
				return {
					...prev,
					phase: "going_back",
					ownedWeapons: {
						...prev.ownedWeapons,
						chaingun: true,
						shotgun: true,
						flamethrower: true,
					},
					ammo: {
						...prev.ammo,
						shotgun: Math.max(prev.ammo.shotgun, WEAPONS.shotgun.pickupAmmo + 4),
						flamethrower: Math.max(prev.ammo.flamethrower, WEAPONS.flamethrower.pickupAmmo + 10),
					},
				};
			});
		},
		onReachSpawn: () => {
			triggerFadeRef.current("win");
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				if (prev.phase !== "going_back") return prev;
				const advanced = advanceLevel(settings.level, prev.run.runLevelsCleared);
				const clearedRun = runStatsReducer(prev.run, {
					type: "clearLevel",
					killsThisLevel: 0,
					damageThisLevel: 0,
					scoreThisLevel: prev.score,
				});
				return {
					...prev,
					run: clearedRun,
					status: advanced === null ? "won" : "transitioning",
				};
			});
		},
		onSpendAmmo: (weapon, amount) => {
			if (amount <= 0) return;
			setState((prev) => ({
				...prev,
				ammo: {
					...prev.ammo,
					[weapon]: Math.max(0, prev.ammo[weapon] - amount),
				},
			}));
		},
		onCollectPickup: (kind) => {
			const action = ammoIncrement[kind];
			setState((prev) => {
				if (action === "health") {
					// L1 — +1 HP per pickup on the 0-9 scale (ref's update_health(+1)).
					return { ...prev, hp: Math.min(prev.maxHp, prev.hp + 1) };
				}
				if (action === "flashlight") {
					triggerFadeRef.current("flash");
					// POL28 — flashlight click-on sting + typed event.
					// Distinct from the pickup chime; reads as the
					// flashlight literally being turned on.
					playFlashlightClick();
					dispatch({ type: "flashlightAcquired" });
					return { ...prev, hasFlashlight: true };
				}
				if (action === "loot") {
					// COV12 step-2 — kind-specific bonus driven by the map seed
					// (pickLootKind(seed) resolved the variant at spawn time).
					// We don't have seed access here; resolve via the current
					// map's seed which is stable for the duration of this call.
					const lootKind = pickLootKind(seed);
					if (lootKind === "bottles") {
						// +5 HP (potion stash) — clamp to maxHp.
						return { ...prev, hp: Math.min(prev.maxHp, prev.hp + 5) };
					}
					if (lootKind === "books") {
						// Knowledge → bonus ammo across both ranged weapons.
						return {
							...prev,
							ammo: {
								...prev.ammo,
								chaingun: prev.ammo.chaingun + WEAPONS.chaingun.pickupAmmo,
								shotgun: prev.ammo.shotgun + WEAPONS.shotgun.pickupAmmo,
							},
						};
					}
					// POL1 — treasure → +50 score (real score field).
					// Pre-POL1 used kills+5 as a proxy because GameState
					// lacked score; that stub is now resolved.
					return { ...prev, score: prev.score + 50 };
				}
				return {
					...prev,
					ammo: {
						...prev.ammo,
						[action.weapon]: prev.ammo[action.weapon] + action.amount,
					},
					ownedWeapons: { ...prev.ownedWeapons, [action.weapon]: true },
					weapon: prev.weapon === "pistol" ? action.weapon : prev.weapon,
				};
			});
		},
	});

	const updateSettings = useCallback((patch: Partial<ObjexoomSettings>) => {
		setSettings((prev) => ({ ...prev, ...patch }));
	}, []);

	const onStartGame = useCallback(async () => {
		if (settings.soundEnabled) {
			await ensureSfx();
			startAmbient();
			// K5 — boot the procedural music loop in exploration mood.
			setMusicMood("exploration");
			startMusic();
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
			weapon: "pistol",
			ammo: baseAmmo(),
			ownedWeapons: baseOwnedWeapons(),
			damageFlashAt: 0,
			run: makeInitialRunStats(Date.now()),
			phase: "out",
		});
	}, [settings.soundEnabled, maxHp, map.enemySpawns.length]);

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
				setSeed(Date.now() & 0xffffffff);
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
			url.searchParams.delete("objexoom");
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

	useEffect(() => {
		if (!settings.soundEnabled) return;
		if (state.status !== "playing") return;
		if (state.phase === "going_back") {
			setMusicMood("going_back");
		} else if (state.hp < state.maxHp) {
			setMusicMood("combat");
		} else {
			setMusicMood("exploration");
		}
	}, [settings.soundEnabled, state.status, state.phase, state.hp, state.maxHp]);

	// H4 — fall-to-death: PlayerController dispatches this when the player
	// has been below the local floor for longer than the grace window. Snap
	// status to dead so the YOU DIED card surfaces.
	useEffect(() => {
		return addObjexoomListener("fellToDeath", () => {
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
		return addObjexoomListener("secretTriggered", () => {
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
				runHistoryRef.current.insert(
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
				setSeed(Date.now() & 0xffffffff);
			} else {
				const next = advanceLevel(settings.level, state.run.runLevelsCleared);
				if (next !== null && next !== "procedural") {
					setSettings((prev) => ({ ...prev, level: next }));
				}
			}
			setState((prev) => ({
				...prev,
				status: "playing",
				hp: prev.maxHp,
				kills: 0,
				score: 0,
				hasKey: false,
				hasFlashlight: false,
				weapon: "pistol",
				ammo: baseAmmo(),
				ownedWeapons: baseOwnedWeapons(),
				damageFlashAt: 0,
			}));
		}, TRANSITION_HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [state.status, state.run.runLevelsCleared, settings.level]);

	// Debug hooks for headed e2e tests. Only attached when ?objexoomDebug is
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
	const onStartGameRef = useRef(onStartGame);
	onStartGameRef.current = onStartGame;

	useEffect(() => {
		if (!debugHooksEnabled()) return;
		window.__objexoom = {
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
			collectKey: () => {
				gameRef.current.onPickupKey();
			},
			collectAllPickups: () => {
				dispatch({ type: "debugCollectPickups" });
			},
			triggerWin: () => {
				gameRef.current.onWin();
			},
		};
		return () => {
			delete window.__objexoom;
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
			data-testid="objexoom-shell"
			role="dialog"
			aria-label="OBJEXOOM"
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
					width: "min(100vw, 1280px)",
					height: "min(100vh, 800px)",
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
							<ObjexoomLanding
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
								<ObjexoomScene
									key={`${settings.level}-${seed}-${map.seed}`}
									map={map}
									active={state.status === "playing"}
									hasKey={state.hasKey}
									gameRef={gameRef}
									weapon={state.weapon}
									ammoRef={weaponStateRef}
									settings={settings}
									phase={state.phase}
									hasFlashlight={state.hasFlashlight}
								/>
							</Canvas>
							<ObjexoomHUD
								state={state}
								touchMode={touchMode}
								onResume={onResume}
								onReturnToLanding={onReturnToLanding}
								onQuit={onQuit}
								onSelectWeapon={onSelectWeapon}
								level={settings.level}
								archetype={pickArchetype(map)}
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
			data-testid="objexoom-fade-overlay"
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
