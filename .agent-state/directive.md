# Continuous Work Directive — objexoom

**Status:** ACTIVE
**Owner:** Claude
**Mandate:** "you are to treat NOTHING as pre-existing I WANT A FULLY POLISHED PLAYABLE GAME PORTED FROM THE REFERENCE DOOM CLONE" — carried over from the original `objexiv/objexiv@feat/objexoom-easter-egg` directive.

**Branch strategy (2026-05-14, supersedes 2026-05-13 single-long-branch policy):** the `feat/objexoom-game-buildout` long-running branch was squash-merged as PR #12 on 2026-05-14 and is deleted. New work ships as **one feature branch per directive item (or tight cluster of related items)**, opened off the latest pulled `origin/main`, PR'd and squash-merged. No more single mega-branch. Branch naming: `feat/<item-id>-<slug>` (e.g. `feat/pa-mod7-gltfjsx`, `feat/e6-switches-secrets`).

**Spec authority:** [`docs/PRD.md`](../docs/PRD.md) is the comprehensive remaining-work spec — user stories, acceptance criteria, asset paths, dependency DAG. This directive is the executable checklist mirror of the PRD; when they disagree, PRD wins and the directive gets updated.

**Reference codebases:** `~/src/reference-codebases/` holds local clones of upstream libraries and game references used for code/doc/example consultation (NOT modified, NOT linked from this repo). The two that matter here:

- `~/src/reference-codebases/yuka/` — Yuka steering/AI library source. Consult when wiring enemy behaviors (seek/flee/path-follow), debugging `yukaIntegration.ts`, or pulling example patterns from the upstream `examples/` dir.
- `~/src/reference-codebases/js13k2019-yet-another-doom-clone/` — the reference DOOM clone that PARITY items mirror. Consult for: sprite-billboard math, weapon timings, hit-feedback patterns, level-gen seed conventions, the exact mechanics PARITY items are restoring.

Prefer reading these LOCAL clones over web search or training recall. They're the source of truth when "what does Yuka actually do?" or "how does the reference clone do X?" comes up.

## What CONTINUOUS means

1. Never stop for status reports the user didn't ask for.
2. Never stop for scope caution.
3. Never stop to summarize — git log is the summary.
4. Never stop for context pressure — task-batch + PreCompact handle it.
5. Never stop because a task feels big — pick the next atomic commit.
6. Only stop on: explicit user halt, red CI blocking, or genuine STOP_FAIL.

## Operating loop

while queue has [ ] items: implement → verify → commit → dispatch reviewers → mark [x] → next.

## Lane priority (read this before picking any item)

**Hard rule: NO item in this directive may block on external state.** Every acceptance criterion is fully autonomously verifiable from this machine. Items that previously required device/CI/human verification have been rewritten — the "device launch / live URL / human eyeball" portion is OUT of the acceptance for ship-readiness; if it matters later it ships as a manual smoke ticket, never as a directive blocker.

Pick the topmost `[ ]` item from the highest-priority lane that has remaining work:

1. **PARITY** — reference-clone gaps (all currently `[x]`; if any regress, fix first). Next executable: **PA-MOD7**.
2. **ARCH** — architectural maintenance raised by reviews. **ARCH2 (re-decomp) blocks E3.** Pick first if it's the gate.
3. **ELEVATION Phase 2** — mechanical (E5 ✅ shipped; E6 next).
4. **ELEVATION Phase 3** — visual. Order: PA-MOD7 → COV1 → E4 → COV4 → E3 → COV3 → E2. (Lane-interplay table below explains why.)
5. **ELEVATION Phase 4** — polish (E13, E7, E8, E11, E10). E13 depends on COV3.
6. **COV*** — 3DPSX coverage NOT paired with an E. Requires `/Volumes/home/assets/3DPSX/` mounted. NAS mount is verified at session start; if it goes away mid-run, remount or skip the COV lane and pick the next executable item from a different lane.
7. **INFRA** — INF2 (build-time asset copy).
8. **Standalone hardening** — B1.7, B2.1, B2.4, AO.4, AO.5, AO.6, DS.* (all parallel; pick any).

Within a lane, pick the topmost unchecked. Inside each item's checkbox the acceptance criterion is a one-liner; long-form spec is [`docs/PRD.md`](../docs/PRD.md).

## Executable next-pick algorithm (zero ambiguity)

```
for lane in [PARITY, ARCH, ELEVATION-P2, ELEVATION-P3, ELEVATION-P4, COV, INFRA, HARDENING]:
    for item in lane.unchecked_in_order:
        if item.requires_nas and not nas_mounted():
            attempt_remount()         # one shot
            if still not mounted: continue
        return item                   # this is the next pick
return "queue drained — flip Status to RELEASED"
```

The anti-stop hook's `[WAIT-*]` escape hatch exists for emergencies (a remote dep genuinely cannot be made local). The standing rule is: rewrite the acceptance criterion until it IS autonomously checkable. `[WAIT-*]` should be empty in steady-state — and currently is.

## Lane interplay (deduplication of overlapping items)

Some COV* items overlap E* items. The COV* row is the **asset-prereq enabler**; the E* row is the **gameplay feature consuming the assets**. Always land COV before its paired E in that pair.

| COV (assets) | E (feature) | Relationship |
|---|---|---|
| **COV1** Light Sources (10 GLBs) | **E4** Lit lamps + shadow projection | COV1 stages the variants; E4 wires the pointLights + shadow maps. **COV1 first.** |
| **COV3** Modular Structures (210 GLBs) | **E13** Procedural archetype deepening | COV3 stages the tile palette; E13 reads them through archetype configs. **COV3 first.** |
| **COV4** Props (137 GLBs) | **E3** Decorative sector scatter | COV4 stages the scatter pool; E3 wires per-archetype curation. **COV4 first.** |
| **COV9** Melee variants (axe/knife/etc) | **E1** Melee slot (BLADE shipped) | E1 shipped with machete; COV9 adds seeded variant cycling. **E1 done; COV9 is the extension.** |
| **COV8** Traps (20 GLBs) | **E6** Switches + secrets | Independent — traps are hazards, switches disable them. Either order works; pick the topmost. |

All other COV* items have no E* pair and run standalone.

## Forbidden phrases

"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up"
"TODO" | "FIXME" | "stub" | "placeholder" | "mock for now"
"pause point" | "natural pause" | "fresh session" | "next session" | "stopping point" | "clean handoff" | "ready to hand off"

## Queue — Standalone repo bring-up

### B0 — Initial commit + remote

- [x] **B0.1** First commit on `main` capturing the extracted source + scaffolding.
- [x] **B0.2** Create `objexiv/objexoom` GitHub repo (internal visibility).
- [x] **B0.3** Push `main` to origin.

### B1 — Verify it actually runs

- [x] **B1.1** `pnpm install` succeeds.
- [x] **B1.2** `pnpm check` (tsc no-emit) green.
- [x] **B1.3** `pnpm lint` (biome) green.
- [x] **B1.4** `pnpm dev` boots Vite, root page mounts `<ObjexoomShell />` cleanly.
- [x] **B1.5** `pnpm test` (vitest unit) green — 12 suites / 163 tests.
- [x] **B1.6** `pnpm test:e2e:screenshots` produces the 5 canonical PNGs.
- [x] **B1.7** `pnpm assets:fbx-to-glb` regenerates GLBs from `references/`. Shipped: fixed stale `public/objexoom/models/` output paths → `public/assets/models/` (matches AO.2 reorg); created `docs/ASSET_PROVENANCE.md` documenting all 10 FBX→GLB jobs with pack origin + license + re-extraction recipe; script runs idempotent (10/10 skipped on second run, 0 failed); `pnpm assets:verify-runtime` confirms all 27 wired URLs resolve.

### B2 — Mobile + CI

- [x] **B2.1** Android scaffold + APK + AVD smoke shipped. `cap add android` produced the Android Studio project (54 files, 994 LOC); `pnpm build && pnpm cap:sync` runs clean; `./gradlew assembleDebug` builds `app-debug.apk` (15.8 MB); `aapt dump badging` reports `package: name='com.objexiv.objexoom'` + `launchable-activity: name='com.objexiv.objexoom.MainActivity'`; on the running `emulator-5554` (Pixel-class AVD, arm64-v8a, boot_completed=1) `adb install` succeeded, `adb shell monkey ... LAUNCHER 1` foregrounded the app, `dumpsys window` confirmed `mCurrentFocus=com.objexiv.objexoom/.MainActivity` and `topResumedActivity` matches; `adb shell screencap -p` produced a 1.0 MB PNG showing the OBJEXOOM landing screen (title in Black Ops One, menu visible, design tokens applied) — verified visually. ci.yml already conditionally builds the APK and uploads it as `app-debug-apk` (now will trigger since `android/` is tracked). .gitignore scoped to exclude only build outputs (`android/build/`, `android/app/build/`, `android/.gradle/`, `android/local.properties`); the source tree is tracked.
- [x] **B2.2** `.github/workflows/ci.yml` runs lint + check + test + build on PRs.
- [x] **B2.3** `.github/workflows/release.yml` runs release-please on push to main.
- [x] **B2.4** Rewrote `.github/workflows/cd.yml` from the broken `workflow_run`-after-Release stub into a full build+deploy pipeline. Triggers on `push.tags: ['v*']` + `workflow_dispatch: {}`. Build job uses `actions/configure-pages@v5` + `actions/upload-pages-artifact@v3`; deploy job uses `actions/deploy-pages@v4`. `actionlint` exits 0. Local `pnpm build:pages` produces `dist/index.html` with assets resolving to `/objexoom/assets/index-*.{js,css}` (correct BASE_URL prefix); `dist/assets/` contains all 27 GLBs (10.10 MB) verified by `pnpm assets:verify-runtime`. PWA manifest + icons + favicon all copy through to `dist/` with `./`-relative refs that resolve cleanly under `/objexoom/`.
- [x] **B2.5** `.github/dependabot.yml` weekly group non-major + major.

### B3 — Standalone-repo cutover (HISTORICAL; this IS the game repo)

All complete on 2026-05-13. `objexiv/objexoom` is the canonical home of OBJEXOOM. No further action — items preserved as audit trail.

- [x] **B3.1** Easter-egg dir, public assets, references, scripts, tests, spec removed from `objexiv/objexiv`.
- [x] **B3.2** Pruned deps no longer needed in objexiv (three, @react-three/*, postprocessing, tone, yuka, fbx2gltf, sharp).
- [x] **B3.3** Archive tag `archive/objexoom-easter-egg` preserved on `objexiv/objexiv`; branch deleted local + remote.
- [x] **B3.4** Standalone repo `objexiv/objexoom` is the source of truth; objexiv main is clean.

### DS — Design system rollout

- [x] **DS.1** Token sources: `src/design-tokens/{colors,typography,spacing,motion,index}.ts`.
- [x] **DS.2** CSS mirror: `app/tokens.css` with `--obx-*` custom properties.
- [x] **DS.3** Self-hosted horror-tactical fonts: Black Ops One + Rajdhani, 12 woff2 files, declared in `app/fonts.css`.
- [x] **DS.4** Dependabot grouped non-major + major per ecosystem.
- [x] **DS.5** Wire tokens into `ObjexoomHUD` (replace hardcoded hex/rgba with `var(--obx-…)`).
- [x] **DS.6** Wire tokens into `ObjexoomShell` landing / mission-complete / game-over overlays.
- [x] **DS.7** Wired tokens into every scene material. Zero literal hex codes remain in `src/scene/**/*.tsx`. Added 14 semantic anchors to `OBJEXOOM_PALETTE` (wallShadow/wallBase/wallVariantCool/wallVariantWarm/wallVariantNeutral/wallEmissive/door/flashlightWarm/weaponMetalLight/weaponMetalDark/ammoBrass/chestWood/chestWoodDeep/portalTeal/portalRose).
- [x] **DS.8** Apply Black Ops One to all heading-class HUD elements.
- [x] **DS.9** Re-shoot the 5 canonical screenshots with the new typography + tokens applied.

### AO — Asset organization

- [x] **AO.1** Inventory current `public/` layout, document the convention in `public/README.md`.
- [x] **AO.2** Move every existing GLB under `public/assets/models/{enemies,weapons,props}/`.
- [x] **AO.3** Bundle horror enemy GLBs (sewerfiend, plague_doctor, elk_demon, abomination ×2, anomaly, horned, nun, alien, clown ×2) under `public/assets/models/enemies/horror/`.
- [x] **AO.4** Bundled 5 slasher weapon GLBs under `public/assets/models/weapons/slasher/`. Updated `src/models.ts` melee URL to `slasher/melee_machete.glb`, updated all 5 jobs in `scripts/convert-fbx.mjs`, updated provenance + inventory docs. `pnpm assets:verify-runtime` resolves all 27 URLs; canonical screenshots unchanged.
- [x] **AO.5** Shipped PWA manifest + favicon set. `public/manifest.webmanifest` declares name/short_name/description/start_url/scope, `display: fullscreen`, `theme_color`+`background_color`=`#03050b` (`--obx-bg-void`), 192×192 + 512×512 + maskable-512 icons; `public/favicon.ico` + `favicon-32.png` + `apple-touch-icon.png` (180×180). `scripts/generate-pwa-icons.mjs` rasterizes the OBJEXOOM stacked-wordmark SVG via Playwright Chromium (idempotent, runs via `pnpm assets:pwa-icons`). **D14 amends original Lighthouse PWA-category criterion** — Lighthouse 12 retired that category. Verified via current Lighthouse 13: best-practices=100, accessibility=100, seo=91, performance=38 (FPS game, expected). Best-practices + a11y both ≥ 90 per D14.
- [x] **AO.6** `index.html` head references the manifest + all favicon sizes + apple-touch-icon + apple-mobile-web-app-* meta + theme-color synced to `#03050b`. Verified via `curl http://localhost:5191/manifest.webmanifest` returns `Content-Type: application/manifest+json`.

### PARITY — DOOM reference clone

Full audit: [`docs/PARITY.md`](../docs/PARITY.md).

- [x] **PA-MOD2** Visually verify all 5 screenshot poses render cleanly post-extraction.
- [x] **PA1** ManyEnemies spawner wired in `src/refLevel.ts`.
- [x] **PA9** Shell ejection on shotgun fire (`ShellEjectField` active).
- [x] **PA10** Weapon recoil offset on viewmodel (per-weapon `RECOIL_DISTANCE`).
- [x] **PA11** Body-part physics: gravity arc + spin on death (`BodyPartField` active).
- [x] **PA-FULL** End-to-end deep dive — complete; result captured in `docs/PARITY.md`.
- [x] **PA16 / E12** Adaptive resolution via `gl.setPixelRatio` on low FPS. Shipped 57dd8fa. **100% reference parity reached.**
- [x] **PA9b** Extended shell ejection to chaingun fires. Shotgun ejects one large shell per pull; chaingun ejects a smaller (0.6× scale) shell on every pulse. `ShellEjectField` per-shell despawn cap raised to 80 to handle the chaingun rate.
- [x] **PA-MOD7** Muzzle light at the actual barrel tip rather than camera-relative. Shipped per D11: `WeaponModel.muzzleBboxFrac` is a per-weapon [fx,fy,fz] ∈ [0,1]³ lerped against the GLB's runtime Box3 to land at the visible barrel tip; `WeaponViewmodel` renders a `<group>` at that point and surfaces it via an `onMuzzleAnchor` callback; `ObjexoomScene`'s muzzle-flash point light reads `anchor.getWorldPosition()` each frame (falls back to camera.position when no anchor is registered yet, preserving the prior behavior for test harnesses). 5 unit tests in `objexoom-muzzle-anchor.test.ts` pin the authoring contract (frac in bounds, at least one axis ≥ 0.9 marking the tip, the other two axes near center, lerp produces a non-degenerate position distinct from bbox center). Canonical screenshots unchanged — flash position only differs during fire frames, none of the 5 canonical poses capture a fire frame.

### ELEVATION — beyond reference parity

Full roadmap: [`docs/ELEVATION.md`](../docs/ELEVATION.md). Specs in [`docs/PRD.md`](../docs/PRD.md).

**Phase 1 — Critical infra (DONE):**

- [x] **E12** Adaptive resolution via `gl.setPixelRatio` (PA16). Shipped 57dd8fa.
- [x] **E9** sql.js persistent run history. Shipped 5d74778.

**Phase 2 — Mechanical elevation:**

- [x] **E1** Full melee weapon slot — wired BLADE/machete viewmodel + whoosh sfx + DRY'd ownedWeapons. Shipped 8d71475.
- [x] **E5** Destructible barrels with AoE damage. Shipped 688104d. 5-variant skin pool (4 metal + 1 wooden), HP=3, 2.5-tile AoE, 35dmg to enemies / 3dmg to player, chain reactions via queue. 14 unit tests in `objexoom-barrels.test.ts`.
- [ ] **E6** Switches + secret walls + hidden rooms. Acceptance: at least one secret area per refLevel, gated by a wall-mounted switch; switch interaction via fire while pointed at, plays the door SFX, raises the wall.

**Phase 3 — Visual elevation:**

- [ ] **E3** Decorative sector prop scatter (3DPSX Mega Pack has 200+ modular props). Acceptance: every sector seeds 2-5 props on level load via deterministic seed; props are collision-flat (no walk-blocking by default); zero visible repeats within camera FOV.
- [ ] **E4** Lit lamp props with real shadow projection. Acceptance: `lamp_on.glb` spawned in dim sectors; each emits a real point light scoped to shadow-map; flashlight effect doesn't double-light the lamp.
- [ ] **E2** Boss enemies using `final_rigged.fbx` horror tier. Acceptance: one boss spawn slot per refLevel's final sector; 3-4× standard HP; unique aggro alert + death stinger; portal unlocks only after boss death.

**Phase 4 — Polish + variety:**

- [ ] **E13** Procedural level archetype deepening (corridor / arena / courtyard / sewer / library). Acceptance: `buildMap` reads a per-archetype config; archetypes differ in sector-density, prop-density, enemy-mix, lighting palette.
- [ ] **E7** Animated water + sewer biome (`PSX-Ocean-Surface` unmined). Acceptance: at least one sector is a water tile; water has a UV-scrolled normal-map surface; standing in water applies a movement-speed multiplier.
- [ ] **E8** Flamethrower weapon (continuous-fire AoE; `Flamethrower.glb` shipped). Acceptance: 5th WeaponId slot; held-trigger continuous-fire; cone-AoE damage every 100ms; ammo pickup from a fuel canister; particle stream visual via `ParticleBurstField`.
- [ ] **E11** Per-level ambient creature SFX layers. Acceptance: each refLevel ships an ambient-bed track of distant growls/drips/wind; volume reactive to `phase === "going_back"`.
- [ ] **E10** 3D HUD elements (floating key mini-model, etc). Acceptance: when player has key, a small spinning key GLB renders in screen-space top-right; on take damage, the model flashes red.

### COV — 3DPSX asset coverage maximization (user directive 2026-05-14)

> "I want as much possible value from ALL the PSX assets — anything
> that makes sense in a level."

Every category below is a directive item: wire at least one
gameplay-meaningful feature that consumes a multi-variant pool from
that category. Seeded id picks the variant so the same instance is
visually consistent across reloads.

- [ ] **COV1** PSX Mega Pack II "Light Sources" (10 GLBs). Acceptance: ≥2 lamp variants spawn as scatter in dim sectors, each emitting a scoped pointLight; pairs with E4. Caps lit-lamp count at 8 for shadow-map budget.
- [ ] **COV2** PSX Mega Pack II "Large Props & Machinery" (52 GLBs). Acceptance: ≥6 props scattered into level archetypes (cranes, generators, pipes); some are collision-blocking, some pass-through; per-archetype filter chooses which.
- [ ] **COV3** PSX Mega Pack II "Modular Structures" (210 GLBs). Acceptance: at least one refLevel rebuilt to use these as wall/floor tile primitives instead of the procedural box-extrusion; unlocks E13 archetype identity.
- [ ] **COV4** PSX Mega Pack II "Props" (137 GLBs). Acceptance: ≥10 prop variants in the E3 scatter pool. Per-archetype curation (kitchen/factory/temple/sewer).
- [ ] **COV5** PSX Mega Pack II "Debris & Misc" (34 GLBs). Acceptance: ≥5 destroyed-prop variants spawn in the body of every sector; reads as "this place has been overrun."
- [ ] **COV6** PSX Mega Pack II "Decals" (12 GLBs). Acceptance: wall-decals (blood, scorch, faction marks) seeded onto wall faces by tile hash; ≥3 per sector.
- [ ] **COV7** PSX Mega Pack II "Doors & Gates" (6 GLBs). Acceptance: RealDoor + LockedDoor cycle through ≥3 variants by seed; current `door.glb`/`door_locked.glb` becomes one of several.
- [ ] **COV8** Props/Traps (20 GLBs). Acceptance: spike traps, swinging blades, pressure-plate triggers as level hazards; tick damage when player overlaps; pairs with E6 (switches disarm).
- [ ] **COV9** Props/Weapons additional viewmodels (3 swords, 5 knives, 5 revolvers, baseball bats, katana). Acceptance: post-E1 melee variant cycling — `pickMeleeSkin(level.seed)` rotates BLADE between machete/katana/cleaver/bat per run.
- [ ] **COV10** Vehicles/PS1-RVS (3 GLBs). Acceptance: at least one wrecked-vehicle prop spawns as a permanent piece of set-dressing in the courtyard archetype.
- [ ] **COV11** Environment/Nature — bushes (5 seasons × ~40), trees (44), grass (12). Acceptance: outdoor/courtyard archetype seeds at least one seasonal pass; trees + grass tufts as collision-flat scatter.
- [ ] **COV12** Fantasy/Bottles/Books/Scrolls/Loot pack. Acceptance: rare bonus pickup spawns (XP-equivalent, score boost, ammo cache) using these meshes.
- [ ] **COV13** Props/Kitchen (48 GLBs). Acceptance: kitchen-archetype sector uses these as set-dressing (knife blocks, pots, sinks).
- [ ] **COV14** Characters/ChibiCharacters (14) + individuals (66). Acceptance: hub-area NPCs (non-hostile) using these meshes as set-dressing in a HUB sector type. Spec: a new `EnemyKind = "npc"` variant that the FSM treats as ambient (no aggro, no LOS, no attack). Pairs with E13 (HUB archetype = the 6th archetype joining corridor/arena/courtyard/sewer/library).

These are sequenced by gameplay value (light/structures/props first
because they yield the biggest visual ROI). Re-order any time.

### ARCH — architectural maintenance (raised by PR #12 architect review)

- [x] **ARCH1a** Shipped `src/events.ts` with `ObjexoomEvent` discriminated union over all 14 channels plus `dispatch` + `addObjexoomListener` helpers. Wire format preserved (CustomEvent.detail omits the discriminator `type`), so untyped existing consumers and typed new listeners cross-talk freely — enables ARCH1b's incremental migration. 6 new unit tests pin the round-trip + back-compat contracts (191 unit tests passing).
- [x] **ARCH1b** Migrated every `objexoom:*` call site in production code to `dispatch` / `addObjexoomListener` per D13. Zero `window.dispatchEvent(new CustomEvent("objexoom:` strings remain in `src/` (verified by grep). 8 production files touched (Shell, Scene, HUD, PlayerController, WeaponViewmodel, ParticleBurstField, BodyPartField, ShellEjectField, fireResolution). Topology preserved (no Shell↔Scene→PlayerController ref-callback rewiring); the win is compile-time-typed payloads. 191 unit + 5 browser + 5 e2e screenshot tests green; canonical screenshots unchanged.

- [x] **ARCH2a** Extracted enemy-tick loop to `src/scene/hooks/enemyTickLoop.ts` as a pure `tickEnemyLoop(ctx)` function (not a hook — useFrame plumbing stays where it belongs). ObjexoomScene shed ~96 LOC (891 → 795); the in-frame call site is one line. Behavior byte-identical (185 unit + 5 browser + 5 e2e screenshot tests stay green; canonical screenshots unchanged).
- [x] **ARCH2b** Extracted single-shot resolution to `src/scene/hooks/fireResolution.ts` as a pure `resolveFire(ctx)` function (parallel shape to ARCH2a). The useEffect that wires the `objexoom:fire` listener stays in ObjexoomScene; the body is one call into the helper. ObjexoomScene shed another ~149 LOC (795 → 646; total -245 across ARCH2a+ARCH2b). All 185 unit + 5 browser + 5 e2e screenshot tests green; canonical screenshots unchanged (pure relocation refactor).

### INFRA — supporting infrastructure

- [x] **INF1** WASM/asset sync per arcade-cabinet pattern. `scripts/prepare-web-wasm.mjs` runs at postinstall + prebuild; sql.js WASM copies to `public/assets/wasm/`. Shipped 81ed15d.
- [ ] **INF2** Build-time `scripts/copy-public-assets.mjs` mirror. Acceptance: build-step copies `public/assets/` to `dist/assets/` (or equivalent) and reports per-category totals. NO arbitrary byte budgets — asset weight is tuned deliberately per pickup, not enforced by an arbitrary CI threshold.
- [x] **INF3** CI gate `scripts/verify-runtime-assets.mjs` — every GLB referenced by `models.ts` exists at the resolved path. Shipped 81ed15d; byte-budget enforcement was removed in 688104d because the budgets cost us a quality downgrade on barrel.glb (the 6.8 KB Farm barrel got chosen over the 408 KB PSX Mega Pack II metal barrel).

## Verification

Before flipping any [ ] to [x]:

1. `pnpm verify` green (lint + check + test + test:browser + assets:verify-runtime).
2. For any UI/scene change, the relevant canonical screenshot re-shot and visually compared against `docs/assets/objexoom/`.
3. For any new mechanic, at least one unit or browser test pinning the contract.
4. Commit pushed to `feat/objexoom-game-buildout`.

## Self-assessment after every commit

Per `~/.claude/CLAUDE.md` — before opening the next item, ask:

- **Backward:** what shipped, what gap did self-review or the simplification reviewer surface, did anything user-visible regress?
- **Forward:** given the just-shipped learnings, is the next directive item still the right next item? Does its acceptance criterion still hold, or did the prior commit move the goalposts?

Encode forward learnings into the directive before starting the next stage.
