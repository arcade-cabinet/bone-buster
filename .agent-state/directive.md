# Continuous Work Directive — objexoom

**Status:** ACTIVE
**Owner:** Claude
**Mandate:** "you are to treat NOTHING as pre-existing I WANT A FULLY POLISHED PLAYABLE GAME PORTED FROM THE REFERENCE DOOM CLONE" — carried over from the original `objexiv/objexiv@feat/objexoom-easter-egg` directive.

**Branch strategy:** `feat/objexoom-game-buildout` is the single LONG-RUNNING branch until the game is FULLY done. No PR churn. All design tokens, all GLB wiring, all reference-clone parity, all polish ships through this one branch. (User directive 2026-05-13.)

**Spec authority:** [`docs/PRD.md`](../docs/PRD.md) is the comprehensive remaining-work spec — user stories, acceptance criteria, asset paths, dependency DAG. This directive is the executable checklist mirror of the PRD; when they disagree, PRD wins and the directive gets updated.

## What CONTINUOUS means

1. Never stop for status reports the user didn't ask for.
2. Never stop for scope caution.
3. Never stop to summarize — git log is the summary.
4. Never stop for context pressure — task-batch + PreCompact handle it.
5. Never stop because a task feels big — pick the next atomic commit.
6. Only stop on: explicit user halt, red CI blocking, or genuine STOP_FAIL.

## Operating loop

while queue has [ ] items: implement → verify → commit → dispatch reviewers → mark [x] → next.

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
- [ ] **B1.7** `pnpm assets:fbx-to-glb` regenerates GLBs from `references/` (locally — references/ is gitignored). Acceptance: script runs end-to-end on a clean `references/` symlink, every GLB referenced in `models.ts` is reproducible from a documented FBX source.

### B2 — Mobile + CI

- [ ] **B2.1** `cap add android` and verify `pnpm build:native` produces an APK. Acceptance: `dist-android/app-debug.apk` exists, launches on a Pixel emulator, ObjexoomShell renders, touch controls respond.
- [x] **B2.2** `.github/workflows/ci.yml` runs lint + check + test + build on PRs.
- [x] **B2.3** `.github/workflows/release.yml` runs release-please on push to main.
- [ ] **B2.4** `.github/workflows/cd.yml` deploys `pnpm build:pages` to GitHub Pages on release tag. Acceptance: a release-please tag results in `objexiv.github.io/objexoom/` serving the latest build with correct BASE_URL prefix on every asset.
- [x] **B2.5** `.github/dependabot.yml` weekly group non-major + major.

### B3 — Cut OBJEXOOM out of Objexiv

- [x] **B3.1** Delete the OBJEXOOM easter-egg dir, public assets, references, scripts, tests, spec from `objexiv/objexiv`.
- [x] **B3.2** Prune deps no longer needed (three, @react-three/*, postprocessing, tone, yuka, fbx2gltf, sharp).
- [x] **B3.3** Archive tag `archive/objexoom-easter-egg` preserved on `objexiv/objexiv`; branch deleted local + remote per user directive.
- [x] **B3.4** Done — standalone repo lives at `objexiv/objexoom`, objexiv main is clean.

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
- [ ] **AO.4** Bundle slasher weapon GLBs under `public/assets/models/weapons/slasher/`. Acceptance: melee_axe, melee_chainsaw, melee_knife, melee_machete, melee_meathook moved (or symlinked) into `weapons/slasher/`; references in `models.ts` updated; `verify-runtime-assets` still passes.
- [ ] **AO.5** Add PWA manifest + favicon set. Acceptance: `public/manifest.webmanifest` declares name, theme_color from `--obx-bg-void`, 192/512/maskable icons; `public/favicon.ico` + apple-touch-icon present; Lighthouse PWA score ≥ 90.
- [ ] **AO.6** Verify `index.html` head references the manifest + favicons (rel="manifest", rel="apple-touch-icon", theme-color meta).

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
- [ ] **PA-MOD7** Wire `gltfjsx` to auto-generate typed React components per GLB. Acceptance: muzzle bones become addressable as named refs; viewmodel can attach the muzzle light to the actual barrel tip rather than camera-relative.

### ELEVATION — beyond reference parity

Full roadmap: [`docs/ELEVATION.md`](../docs/ELEVATION.md). Specs in [`docs/PRD.md`](../docs/PRD.md).

**Phase 1 — Critical infra (DONE):**

- [x] **E12** Adaptive resolution via `gl.setPixelRatio` (PA16). Shipped 57dd8fa.
- [x] **E9** sql.js persistent run history. Shipped 5d74778.

**Phase 2 — Mechanical elevation:**

- [x] **E1** Full melee weapon slot — wired BLADE/machete viewmodel + whoosh sfx + DRY'd ownedWeapons. Shipped 8d71475.
- [ ] **E5** Destructible barrels with AoE damage. Acceptance: barrel pickups/props spawn in sectors, take N hits, on death emit `objexoom:burst` + AoE radius damage to adjacent enemies + the player; uses `barrel.glb` from 3DPSX Mega Pack II.
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
- [ ] **COV14** Characters/ChibiCharacters (14) + individuals (66). Acceptance: hub-area NPCs (non-hostile) using these meshes; could be vendors/mission-givers in a future hub level.

These are sequenced by gameplay value (light/structures/props first
because they yield the biggest visual ROI). Re-order any time.

### INFRA — supporting infrastructure

- [x] **INF1** WASM/asset sync per arcade-cabinet pattern. `scripts/prepare-web-wasm.mjs` runs at postinstall + prebuild; sql.js WASM copies to `public/assets/wasm/`. Shipped 81ed15d.
- [ ] **INF2** Build-time `scripts/copy-public-assets.mjs` mirror. Acceptance: build-step copies `public/assets/` to `dist/assets/` (or equivalent) and reports per-category totals. NO arbitrary byte budgets — asset weight is tuned deliberately per pickup, not enforced by an arbitrary CI threshold.
- [x] **INF3** CI gate `scripts/verify-runtime-assets.mjs` — every GLB referenced by `models.ts` exists at the resolved path. Shipped 81ed15d; byte-budget enforcement removed in a follow-up commit after the budgets cost us a quality downgrade on barrel.glb.

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
