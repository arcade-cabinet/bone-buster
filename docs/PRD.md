---
title: PRD — remaining work to a fully polished playable OBJEXOOM
updated: 2026-05-14
status: current
domain: product
---

# OBJEXOOM — Product Requirements (remaining work)

This is the comprehensive remaining-work spec. Every item that is
NOT yet shipped on `feat/objexoom-game-buildout` has:

1. A user story
2. Acceptance criteria
3. Asset paths (when assets are required)
4. Dependencies (which items must ship first)
5. Estimated commit count

`docs/PARITY.md` and `docs/ELEVATION.md` are the historical
catalogues. This PRD is the executable plan; the
`.agent-state/directive.md` is its checklist mirror.

## Top-level principle — 3DPSX asset coverage maximization

User directive 2026-05-14: **"I want as much possible value from ALL
the PSX assets — anything that makes sense in a level."**

The 3DPSX library on the NAS is ~1,400+ GLBs across PSX Mega Pack II
v1.8 (520+ assets in Buildings/Debris/Decals/Doors/Large Props/Light
Sources/Masks/Modular Props/Modular Structures/Props/Structures/
Weapons), Props (Farm/Kitchen/Tools/Traps/Weapons/Electrical/Misc),
Fantasy (Knight/Skeleton/Bat/Loot/Mine/Buildings/Weapons), Vehicles,
Environment (Nature/Buildings), and Characters.

Every gameplay feature in this PRD MUST take maximum advantage of the
library:

- Multi-variant pools by default. A "barrel" is 5 GLBs cycled by id,
  not one. A "lamp" is ≥2 variants. A "decoration" is ≥6 variants per
  archetype.
- Asset weight is a deliberate per-asset tuning decision — never an
  arbitrary CI gate. The 6.8 KB Farm barrel was the wrong choice over
  the 408 KB Mega Pack II metal barrel; the verify-script no longer
  enforces those budgets.
- New asset categories surface dedicated work items. The COV* queue
  in the directive tracks one task per category.

## Status at a glance

**Shipped on this branch (200+ commits since 624d7ae):**

- Full repository extraction from objexiv/objexiv (archive tag preserved)
- Visual: design tokens, horror-tactical typography (Black Ops One +
  Rajdhani), 5 canonical screenshots, polygon-contains fix
- Engine: ObjexoomScene decomposition (1900→<800 LOC orchestrator),
  yuka pursuit, sector + grid maps, lava damage, going-back phase
- Audio: 14-voice procedural Tone.js bank + per-archetype ambient bed (E11)
- AI: per-enemy GameEntity registry, FSM, per-archetype enemy mix (E13 step-3)
- Assets: 163 GLB URLs wired (enemies, weapons, props, structures);
  ~81 MB on-disk total, BASE_URL-aware `A()` helper
- Test harness: 498+ unit tests, 6 real-Chromium browser tests, 5
  canonical e2e screenshots, 5 per-archetype e2e screenshots, ANGLE-GL launch args
- Infra: pinned ports (5191/8191), Vitest 2-project setup,
  Capacitor scaffold, dependabot grouped, release-please wired
- Reference parity: **100% reached** (E12 closed the last gap)
- Persistence: sql.js run history (E9) + secrets persistence (POL5)
- Weapons: BLADE melee slot (E1), chaingun + shotgun + flamethrower (E8) — 5-weapon roster
- All standalone hardening shipped: B1.7, B2.1, B2.4, DS.7, AO.4, AO.5, AO.6, PA9b, PA-MOD7, INF2
- All elevation phases shipped: E2-E13 inclusive
- All COV phases shipped: COV1-COV14 plus COV3 steps 2-8 (modular structures end-to-end)
- Polish phase POL1-POL7 shipped: score field, secrets HUD + history, archetype HUD label,
  best-run chip on landing, transitioning + died cards show run stats

**Remaining work:** procedural-archetype identity is now exhaustively
keyed across 15+ axes; outstanding gaps are exploratory rather than
"reach feature parity" items. See the directive for the current
forward-sweep queue.

## Dependency DAG

The DAG below shows what must ship before what. Independent leaves
can run in parallel; everything else waits on its ancestors.

```text
                              ┌──────────────────┐
                              │ INF2             │
                              │ copy-assets      │
                              └────────┬─────────┘
                                       │
   ┌──────────┐   ┌──────────┐    ┌────▼─────┐    ┌──────────┐
   │ B1.7     │   │ B2.1     │    │  B2.4    │    │ AO.5/.6  │
   │ FBX→GLB  │   │ Android  │    │  CD      │    │ PWA      │
   └────┬─────┘   │ APK      │    │  Pages   │    │ manifest │
        │         └────┬─────┘    └────┬─────┘    └────┬─────┘
        │              │               │               │
        ▼              ▼               ▼               ▼
   ┌──────────────────────────────────────────────────────────┐
   │  Standalone hardening — independent of gameplay features  │
   └──────────────────────────────────────────────────────────┘

  ┌──────────┐
  │ DS.7     │  scene-material token rollout — independent
  └──────────┘
  ┌──────────┐
  │ AO.4     │  asset directory tidy — independent
  └──────────┘
  ┌──────────┐
  │ PA-MOD7  │  gltfjsx typed components — needed by E4 (lit lamps)
  └────┬─────┘
       │
       ├─────────────┐
       ▼             ▼
  ┌──────────┐  ┌──────────┐
  │  E4 lit  │  │ PA9b     │  shell ejection extension
  │  lamps   │  └──────────┘
  └────┬─────┘
       │
       ▼  ┌──────────────────────────┐
       └──┤  E3 decorative scatter   │ ───┐
          └──────────────┬───────────┘    │
                         │                ▼
                         │           ┌──────────┐
                         │           │  E5      │  destructible barrels
                         │           └────┬─────┘
                         │                │
                         ▼                ▼
                    ┌──────────┐    ┌──────────┐
                    │  E13     │    │  E6      │  switches + secrets
                    │  archetypes│  └──────────┘
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │  E2      │  bosses
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐  ┌──────────┐  ┌──────────┐
                    │  E7      │  │  E8      │  │  E11     │
                    │  water   │  │  flame   │  │  ambient │
                    └────┬─────┘  └──────────┘  └──────────┘
                         │
                         ▼
                    ┌──────────┐
                    │  E10 3D  │
                    │  HUD     │
                    └──────────┘
```

The standalone-hardening lane (B1.7, B2.1, B2.4, AO.5/.6, INF2) is
fully parallel to the gameplay lanes. They can land in any order at
any point.

## Standalone hardening

### B1.7 — FBX→GLB regeneration

**User story.** As a maintainer, I want `pnpm assets:fbx-to-glb` to
produce every GLB referenced by `models.ts` from a documented FBX
source, so that license-restricted FBX sources stay local while the
public/assets/ outputs are reproducible.

**Acceptance.**

- `references/` symlink (gitignored) points at a real FBX source set.
- `pnpm assets:fbx-to-glb` exits 0 and writes GLBs that pass
  `pnpm assets:verify-runtime`.
- A `references/MANIFEST.md` (local-only) lists each source FBX with
  attribution.

**Asset paths.** Source: `references/_extracted/` (per-pack). Output:
`public/assets/models/{enemies,weapons,props}/`.

**Dependencies.** None.

**Estimated commits.** 1.

### B2.1 — Capacitor Android APK

**User story.** As a player on Android, I want a downloadable APK that
launches OBJEXOOM with touch controls so I can play without a desktop
browser.

**Acceptance.**

- `cap add android` succeeds.
- `pnpm cap:sync:android && cd android && ./gradlew assembleDebug`
  produces `dist-android/app-debug.apk`.
- APK installs on a Pixel emulator, `ObjexoomShell` renders, both
  virtual joysticks respond, fire button fires, weapon switching
  works.
- Capacitor config sets `webDir: "dist"`, `appId: "io.objexiv.objexoom"`.
- `.github/workflows/ci.yml` adds an `actions/setup-java@v4` +
  `android-actions/setup-android@v3` step that uploads the APK as a
  CI artifact.

**Asset paths.** N/A (Capacitor wraps the existing build).

**Dependencies.** None.

**Estimated commits.** 2-3 (one for cap add, one for CI step, one
for any Android-specific shim).

### B2.4 — GitHub Pages CD on release tag

**User story.** As a maintainer, I want a release-please tag to
automatically deploy `pnpm build:pages` output to `objexiv.github.io/objexoom/`
so the live demo always matches the latest release.

**Acceptance.**

- `.github/workflows/cd.yml` triggers on `push` to a release tag.
- Runs `pnpm build:pages` (which sets BASE_URL=/objexoom/).
- Publishes `dist/` to the `gh-pages` branch via
  `peaceiris/actions-gh-pages@v4`.
- `objexiv.github.io/objexoom/` serves the built game; every asset
  resolves with the `/objexoom/` prefix (verified via the `A()`
  helper).

**Dependencies.** B2.2 (CI), B2.3 (release-please) — both shipped.

**Estimated commits.** 1.

### INF2 — Build-time copy-public-assets

**User story.** As a deployment engineer, I want the build step to
mirror `public/assets/` into the build output and report per-category
totals so I have visibility into what's shipping without having to
chase down which files made the cut.

**Acceptance.**

- `scripts/copy-public-assets.mjs` exists; runs at build time via a
  package.json hook.
- Logs per-category file counts + totals (matching
  verify-runtime-assets output shape).
- **No arbitrary byte budgets.** Asset weight is a deliberate tuning
  decision per asset, not a CI threshold — we'd rather wire the
  408 KB metal barrel than the 6.8 KB Farm variant because the
  visual fidelity matters. Reporting is enough; if a specific asset
  needs to be lighter, that's a per-asset decision.

**Dependencies.** None.

**Estimated commits.** 1.

### AO.5 / AO.6 — PWA manifest + favicons

**User story.** As a player on mobile, I want to add OBJEXOOM to my
home screen with a proper icon and full-screen launch so it feels
like an app, not a web page.

**Acceptance.**

- `public/manifest.webmanifest` declares `name: "OBJEXOOM"`,
  `short_name: "OBJEXOOM"`, `theme_color` from `--obx-bg-void`,
  `background_color`, `display: "fullscreen"`, `orientation:
  "landscape"`, and icons at 192/512 + maskable variants.
- `public/favicon.ico` + `public/apple-touch-icon.png` present.
- `index.html` head includes:
  - `<link rel="manifest" href="/manifest.webmanifest">`
  - `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
  - `<meta name="theme-color" content="…">`
- Lighthouse PWA score ≥ 90 against a local dev build.

**Asset paths.** Generated via favicon.io from the OBJEXOOM wordmark
SVG; manifest icons rasterized from `public/assets/branding/wordmark.svg`
(create if absent).

**Dependencies.** None.

**Estimated commits.** 1.

## Visual / token rollout

### DS.7 — Tokens in scene materials

**User story.** As a designer, I want every material color in the
scene to route through the `OBJEXOOM_PALETTE` / `ROLE` token set so
brand changes are one-line.

**Acceptance.**

- Zero literal hex codes (`#xxxxxx`) anywhere under
  `src/scene/**/*.tsx` outside the design-tokens module.
- Materials referencing lava, key glow, fire muzzle, pickup tints,
  exit portal hues, all door colors use `OBJEXOOM_PALETTE.*` or
  `ROLE.*`.
- The 5 canonical screenshots re-shot and visually compared — no
  regression.

**Dependencies.** None.

**Estimated commits.** 1-2.

### AO.4 — Slasher weapon bundle reorg

**User story.** As a maintainer, I want the 5 staged melee GLBs
(axe, knife, machete, chainsaw, meathook) under
`public/assets/models/weapons/slasher/` so the directory hierarchy
mirrors the conceptual grouping in `ASSET_INVENTORY.md`.

**Acceptance.**

- 5 melee GLBs moved (or git-renamed) into `weapons/slasher/`.
- `src/models.ts` paths updated.
- `pnpm assets:verify-runtime` still passes.
- `public/README.md` documents the slasher subdir convention.

**Dependencies.** None. (E1 already wires the machete via the current
flat path; this is a pure reorg.)

**Estimated commits.** 1.

## Parity polish

### PA9b — Chaingun shell ejection

**User story.** As a player firing the chaingun, I want each pulse to
eject a brass shell with bounce + spin so the weapon feels mechanical,
matching the reference clone's chaingun-shell behavior.

**Acceptance.**

- The `onFire` block in `ObjexoomScene` emits an
  `objexoom:shellEject` event for `weapon === "chaingun"` in addition
  to the existing `weapon === "shotgun"` branch.
- Shell visuals differ: chaingun shell is smaller (0.6× scale) and
  ejects toward camera-right with slightly less velocity than the
  shotgun shell.
- Per-shell despawn budget preserved; `ShellEjectField` cap raised
  proportionally if needed.

**Dependencies.** None.

**Estimated commits.** 1.

### PA-MOD7 — gltfjsx typed GLB components

**User story.** As an engineer, I want each GLB to be available as a
typed React component with named bones (muzzle, barrel tip, exhaust
port) so visual effects can attach to mesh-relative anchors instead
of camera-relative offsets.

**Acceptance.**

- `pnpm gltfjsx public/assets/models/weapons/pistol.glb -t` produces
  `src/scene/viewmodel/generated/Pistol.tsx` with typed `nodes` +
  `materials` interfaces.
- At least one consumer (muzzle flash) attaches to a named bone (eg
  `nodes.MuzzleBone`) rather than the camera position.
- A `pnpm assets:regenerate-gltfjsx` script regenerates the whole set;
  the generated dir is gitignored to keep the diff clean.

**Dependencies.** None directly. **E4** (lit lamps) benefits from
this.

**Estimated commits.** 2 (one for the script + one consumer, one for
folding into E4).

## Phase 2 — Mechanical elevation

### E5 — Destructible barrels with AoE damage

**User story.** As a player, I want to shoot explosive barrels to take
out groups of enemies, creating tactical chains and rewarding
positioning.

**Acceptance.**

- New `PickupKind` or sibling type for `"barrel"` (or a dedicated
  `Barrel` registry in `engine.ts`); barrels are placed at sector-load
  time using a deterministic seed.
- Each barrel has HP (3-5); take any weapon hit, decrement HP, on 0
  trigger:
  - `objexoom:burst` event with `kind: "explode"`, 18 motes
  - AoE damage to every enemy + the player within 2.5 tiles
  - Chain-react: barrels inside the AoE also explode (recursive
    1-tick delayed)
- Barrel GLB: `/Volumes/home/assets/3DPSX/Props/Mega Pack II/barrel*.glb`
  (multiple variants available; pick the rust-textured one for the
  horror-tactical palette).
- Sfx: reuse `playBoom` with a slight pitch shift.

**Asset paths.** Source from 3DPSX Mega Pack II; copy to
`public/assets/models/props/barrel.glb`.

**Dependencies.** None directly. Pairs well with **E3** (scatter
generates barrel slots).

**Estimated commits.** 2-3.

### E6 — Switches + secret walls + hidden rooms

**User story.** As a player who explores aggressively, I want to find
hidden switches that reveal secret areas containing rare pickups
(extra health, weapon ammo, shortcut to next level).

**Acceptance.**

- New `MapInteractive` type: switches at known sector edges.
- Fire-while-aiming at a switch triggers it; switch state persists for
  the run.
- Each refLevel ships at least one secret area: switch raises (or
  retracts) a wall, exposing a hidden sector with a guaranteed
  flashlight + ammo pack.
- Switch visual: small panel GLB from
  `/Volumes/home/assets/3DPSX/Props/Switch/` (multiple available).
- Sfx: `playDoorTick` + a low rumble.

**Asset paths.**
`public/assets/models/props/switch.glb`,
`public/assets/models/props/switch_pressed.glb`.

**Dependencies.** None.

**Estimated commits.** 2-3.

## Phase 3 — Visual elevation

### E3 — Decorative sector prop scatter

**User story.** As a player exploring a sector, I want it to feel
inhabited — barrels, chains, crates, debris piles — instead of an
empty floor between walls.

**Acceptance.**

- New `scatter` config per archetype: prop pool, density, walkable vs
  blocking.
- Deterministic seed (`sectorId * map.seed`) chooses which props
  spawn where; same seed → identical scatter.
- Props are collision-flat by default (the player walks through them);
  a `blocking: true` flag opts a prop into the collision system.
- No visible repeats within a single FOV — distributor uses
  rejection sampling.
- 2-5 props per sector at default density; configurable per archetype.

**Asset paths.** 3DPSX Mega Pack II — 200+ modular props available.
Curate ~30 into `public/assets/models/props/scatter/`.

**Dependencies.** None directly. Pairs with **E4** (some scatter is
lit lamps), **E5** (some scatter is destructible barrels).

**Estimated commits.** 3-4 (scatter system + asset curation + per-archetype
tuning).

### E4 — Lit lamp props with real shadow projection

**User story.** As a player walking through a dim sector, I want lit
lamps to cast actual shadows and illuminate the immediate area, making
the lighting feel real instead of pre-baked.

**Acceptance.**

- `lamp_on.glb` (shipped) spawns at scatter-designated lamp slots.
- Each lamp emits a `<pointLight>` scoped to a 4-tile radius with
  shadow-mapping enabled.
- Performance: total active lit-lamp count capped at 8 to keep
  shadow-map composite within budget.
- Flashlight effect doesn't double-light the lamp itself (lamp's own
  emissive prevents the bleed).
- Per-level archetype controls lamp density.

**Asset paths.** `public/assets/models/props/lamp_on.glb` (shipped).

**Dependencies.** **PA-MOD7** (named-bone access for the lamp's bulb
emitter origin). **E3** (scatter places the lamp slots).

**Estimated commits.** 2.

### E2 — Boss enemies (rigged horror)

**User story.** As a player who has cleared the regular enemies on a
level, I want to face a distinctive, harder-hitting boss whose death
unlocks the exit portal.

**Acceptance.**

- New `Enemy.tier === "boss"` flag (or a parallel `Boss` type).
- Boss HP = 3-5× standard.
- Each refLevel's final sector spawns exactly one boss.
- Boss has a named-track attack telegraph animation distinct from
  regular enemies.
- HUD overlay: `BOSS APPROACHES` on first sight; `BOSS DEFEATED` on
  death.
- Portal stays locked until the boss is dead.
- Distinctive aggro alert + death stinger SFX.

**Asset paths.**
`references/_extracted/horror_rigged/{plague_doctor,abomination,elk_demon,clown_a,clown_b}/final_rigged.fbx`
→ regen via `pnpm assets:fbx-to-glb` into
`public/assets/models/enemies/bosses/`.

**Dependencies.** **B1.7** (FBX regeneration must work; bosses come
from FBX sources). **E3** + **E13** preferred (archetypes inform boss
choice, scatter sets the boss's room dressing).

**Estimated commits.** 3-4.

## Phase 4 — Polish + variety

### E13 — Procedural archetype deepening

**User story.** As a replayer of procedural mode, I want each run to
feel structurally different — sometimes I'm in a tight corridor, next
run an open arena, next a dripping sewer.

**Acceptance.**

- 5 archetypes seeded by `(map.seed % 5)`: corridor, arena,
  courtyard, sewer, library.
- Each archetype config covers:
  - sector-density / size range
  - prop-density (E3 hook)
  - enemy-mix (which kinds prefer this archetype)
  - lighting palette (which `OBJEXOOM_PALETTE` color tints the fog
    + directional)
  - SFX ambient bed (E11 hook)
- `buildMap` reads the archetype config and applies all of the above.
- Visual identity test: a screenshot of each archetype is distinct
  to the eye.

**Dependencies.** **E3** (scatter config), **E11** (ambient SFX
hookup).

**Estimated commits.** 4-5.

### E7 — Animated water + sewer biome

**User story.** As a player entering a sewer-archetype level, I want
to wade through actual water — surface ripples, slower movement,
visible foot splashes — not just a blue floor.

**Acceptance.**

- New `WaterSector` type with a UV-scrolled normal-map plane.
- Standing in water applies `PLAYER_MOVE_SPEED × 0.6`.
- Optional splashes: `objexoom:burst` with `kind: "splash"` on
  position changes inside water.
- Asset: `PSX-Ocean-Surface` mesh from 3DPSX (unmined per
  ASSET_INVENTORY.md).

**Asset paths.**
`/Volumes/home/assets/3DPSX/PSX-Ocean-Surface/*.glb` →
`public/assets/models/props/water_surface.glb`.

**Dependencies.** **E13** (sewer archetype calls water sectors).

**Estimated commits.** 2-3.

### E8 — Flamethrower weapon

**User story.** As a player who has been overwhelmed by a horde, I
want a continuous-fire AoE weapon that trades aim precision for
crowd control.

**Acceptance.**

- 5th `WeaponId = "flamethrower"`.
- Continuous-fire: held trigger dispatches `objexoom:fire` every
  100ms.
- Cone-shaped damage: 60° spread, 4-tile range, 8 dmg/tick.
- Particle stream via `ParticleBurstField` with `kind: "flame"`
  (amber/ember gradient).
- Ammo from `flamethrower_fuel` pickup (new `PickupKind`).
- Asset: `Flamethrower.glb` (shipped).

**Asset paths.** `public/assets/models/weapons/Flamethrower.glb`
(shipped). Fuel canister: use `/Volumes/home/assets/3DPSX/PSX Mega Pack II v1.8/Props/canister_*.glb` (search `mcp__assets-library__search_assets` for "canister" when NAS is mounted; pick the rust-tinted variant for palette fit).

**Dependencies.** None directly. E1's `WeaponId` widening + base
records pattern is the template.

**Estimated commits.** 2-3.

### E10 — 3D HUD elements

**User story.** As a player, I want the HUD's key indicator and ammo
counters to feel three-dimensional — a small spinning key icon in the
corner when I have the key, ammo cells that pulse when I'm low.

**Acceptance.**

- A second small `<Canvas>` (or HUD-scene viewport) renders 3D
  miniatures.
- Floating mini-key GLB spins in screen-top-right when `state.hasKey`.
- Damage-flash: when player takes damage, all 3D HUD elements flash
  red briefly.
- Performance: total triangle count under 2k.

**Dependencies.** **PA-MOD7** preferred (typed mini-models). Phase 4
ordering — wait for E2/E3/E13 to land first.

**Estimated commits.** 2.

### E11 — Per-level ambient creature SFX

**User story.** As a player exploring a dark sector, I want to hear
distant growls, drips, chains, and wind that match the level's
archetype, making the world feel inhabited offscreen.

**Acceptance.**

- New `playAmbientLayer(name: string)` API in `sfx.ts`.
- Per-archetype ambient bed declared in the same config as E13:
  - corridor → distant footsteps + occasional growl
  - arena → chains rattling on a slow loop
  - sewer → constant drips + far-off splashes
  - courtyard → wind + distant howl
  - library → page rustles + faint whisper
- Volume reactive: `phase === "going_back"` doubles the ambient bed
  intensity.
- Cross-fades on level transition (1.5s).

**Dependencies.** **E13** (archetype config carries the ambient name).

**Estimated commits.** 2.

## COV — 3DPSX asset coverage tasks

Each item is a directive checkbox in `.agent-state/directive.md`
(COV1-COV14). User stories below; acceptance criteria mirror those
in the directive. These can run in parallel with the E*/PA*/etc.
lanes — they're per-category coverage drives, not architectural
features. Many of them naturally fold into E3 (scatter), E4 (lit
lamps), E6 (traps via switches), and the archetype work (E13).

### COV1 — Light Sources

10 GLBs in PSX Mega Pack II/Light Sources. Wire ≥2 lamp variants as
scatter in dim sectors; each emits a scoped `pointLight`. Pairs
directly with E4 (real shadow projection). Performance: cap active
lit lamps at 8.

### COV2 — Large Props & Machinery

52 GLBs of cranes, generators, pipes, machinery. ≥6 scattered into
archetype-appropriate sectors. Some collision-block, some pass-through;
per-archetype filter.

### COV3 — Modular Structures

210 GLBs. Rebuild at least one refLevel using these as wall/floor
tile primitives instead of the procedural box extrusion. This is the
biggest visual ROI item in the whole COV queue — unlocks the E13
archetype identity story.

### COV4 — Props (Mega Pack II)

137 GLBs. ≥10 prop variants in the E3 scatter pool, curated per
archetype (kitchen/factory/temple/sewer).

### COV5 — Debris & Misc

34 destroyed-prop variants. ≥5 spawn per sector body; reads as "this
place has been overrun." Acts as ambient scatter background.

### COV6 — Decals

12 wall-decals (blood, scorch, faction marks). Seeded onto wall faces
by tile hash; ≥3 per sector.

### COV7 — Doors & Gates

6 variants. RealDoor + LockedDoor cycle through ≥3 by seed. Adds
visual variety to the key-door moment that currently feels uniform.

### COV8 — Traps

20 trap GLBs (spike, swinging blade, pressure plate). Treat as level
hazards with tick damage on player overlap. Pairs with E6 (switches
disarm).

### COV9 — Melee viewmodel variants

3 swords, 5 knives, 5 revolvers, baseball bats, katana, cleaver.
Post-E1, `pickMeleeSkin(level.seed)` rotates BLADE between
machete/katana/cleaver/bat per run.

### COV10 — Vehicles (PS1-RVS, 3 GLBs)

Wrecked-vehicle props as permanent set-dressing in courtyard
archetype.

### COV11 — Environment/Nature

5 seasons × ~40 bushes, 44 trees, 12 grass tufts. Outdoor archetype
seeds one seasonal pass; trees + grass as collision-flat scatter.

### COV12 — Fantasy loot

Bottles, books, scrolls, dungeon loot pack. Rare bonus pickups
(XP/score/ammo cache).

### COV13 — Kitchen

48 GLBs. Kitchen-archetype sector uses these as set-dressing.

### COV14 — Characters (Chibi + individuals)

14 + 66 GLBs. Non-hostile hub NPCs as set-dressing in the HUB sector
type (6th archetype joining corridor/arena/courtyard/sewer/library
per E13). New `EnemyKind = "npc"` variant the FSM treats as ambient
(no aggro, no LOS, no attack). Spec lives at `.agent-state/directive.md` §COV14.

## Acceptance checklist (cross-cutting)

Every PRD item must satisfy these to be marked `[x]` in the
directive:

1. `pnpm verify` green (lint + check + test + test:browser +
   assets:verify-runtime).
2. For visual changes: relevant canonical screenshot re-shot and
   visually inspected. Spec drift = bug.
3. For new mechanics: at least one unit OR browser test pinning the
   contract.
4. CHANGELOG.md updated under Unreleased section.
5. PARITY.md or ELEVATION.md updated to reflect the new state.
6. Directive checkbox flipped in the same commit as the code change.

## Estimated total commit count to "fully done"

Summing all sections: **~50 forward commits**. The branch already has
~52 commits; comfortably-rounded the path to "fully polished playable
game" is another ~50-60 commits.

## Order of attack

Recommended execution order, given the DAG and dependency arrows:

1. **Standalone-hardening lane (parallel):** B1.7, B2.1, B2.4, AO.4,
   AO.5/.6, INF2, DS.7. Mostly mechanical, low-risk.
2. **Phase 2 mechanics:** E5 barrels, E6 secrets — adds tactical
   depth.
3. **Visual scaffolding:** PA-MOD7 → E3 scatter → E4 lit lamps.
4. **Boss tier:** B1.7 must land first (FBX regen) → E2 bosses.
5. **Archetype deepening:** E13 once E3 + E2 are stable.
6. **Polish layer:** E7, E8, E11 (any order).
7. **Final touches:** E10 3D HUD, PA9b chaingun shells.

Re-sequence whenever a dependency surfaces — the DAG is the
constraint, not this list.
