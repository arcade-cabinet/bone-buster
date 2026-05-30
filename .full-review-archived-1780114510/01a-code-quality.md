# Phase 1A — Code Quality Findings (OVERHAUL2 review run)

## HIGH
- **H-1 `pickUvHidden` O(n²)** (src/engine/spawn.ts:84,110) — fresh forkStream + advance i+1 per enemy = 136 draws for 16 enemies. Fix: seed the ENMX-UV stream ONCE in spawnEnemies, advance linearly. Byte-stable. (10min)

## MEDIUM
- **M-1 debrisScatter bbox duplication** (src/world/scatter/debrisScatter.ts:62) — hand-rolled bbox loop despite sampling.ts bboxOf. Import + replace. (5min)
- **M-2 Shell.tsx exports types belonging in a leaf module** (app/views/Shell.tsx:48-179) — GameState/GameStatus/LevelPhase/FadeKind/FadeTrigger/WeaponState/GameRef consumed by gameReducer/sceneTick/Scene; fan-in cycle. Extract to app/views/gameTypes.ts (leaf), Shell re-exports. Same pattern as gameConstants.ts.
- **M-3 SceneTickDeps 33 fields** (src/scene/tick/sceneTick.ts) — parameter-object at scale; split into sub-objects (player/phase/ai/...). Future commit + test update.
- **M-4 patrolBearing magic 1.732** (src/engine/spawn.ts:84) — name + document (sqrt(3) approx golden-angle). (2min)
- **M-5 onStartGame uncaught audio rejection** (app/views/Shell.tsx:457-500) — awaited ensureSfxCritical() rejection freezes UI on landing (no state→playing). try/catch + continue muted. (5min) [relates to ERR1]
- **M-6 readSeedPhraseFromUrl no length cap** (app/views/urlFlags.ts:80) — unbounded seed → cyrb128 main-thread DoS via crafted URL. Cap ≤200 chars. (5min)
- **M-7 writeJsonPref swallows JSON.stringify failure** (src/platform/persistence/preferences.ts:79) — circular/BigInt silently drops write (settings + event-seed). Log in dev. (5min)
- **M-8 Scene.tsx 86 hook calls / 7 useFrame** (app/views/Scene.tsx) — past readable threshold. Extract useScatterState/useWeaponViewModel/useEntityState/useBulletState hooks. Sustained refactor.
- **M-9 Shell.tsx 22 useEffect calls** — extract useBossTracker/useRunHistory/useAudioMoodSync (→Shell ~600 lines). Sustained refactor.

## LOW
- **L-1 gridGen inlines ARCHETYPE_NAMES_INLINE + ARCHETYPE_ENEMY_MULTIPLIER parallel arrays** — extract to typed Record<PropArchetype,number>.
- **L-2 reduceWin hardcodes +4/+10 ammo bonuses** (src/store/gameReducer.ts) — name GOAL_BONUS_AMMO per weapon.
- **L-3 DamageNumberField bindSlot `as any`** — typeable as SlotRefs[typeof key] if values nullable.
- **L-4 ParticleBurstField Math.random non-determinism** — intentional (cosmetic); add a top-of-file comment so screenshot tests don't snapshot bursts.
- **L-5 Shell.tsx resolveTouchMode + GameRef = app/→src/ layer violation** (useGameRef in src/ imports @views/Shell). Extract to gameTypes.ts.
- **L-6 HUD.tsx console.warn in render path** (app/views/HUD.tsx:359) — verify it's effect/ref-gated not component body.

## Non-issues (cleared): preferences.ts/urlFlags.ts empty catches (intentional best-effort), Shell reload catch, run-history catch, ParticleBurstField Math.random (cosmetic), DamageNumberField as-any (reasoned), palette tokens (compliant), ARCHETYPE_LIGHT_PALETTES config table (allowed).
