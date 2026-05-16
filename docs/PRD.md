---
title: PRD — Bone Buster overhaul (remaining work)
updated: 2026-05-15
status: current
domain: product
---

# Bone Buster — Product Requirements (remaining work)

Authoritative spec for the **overhaul** work-unit. Every
unshipped item has a user story / motivation, the specific
surfaces it touches, an acceptance criterion the global
commit-gate or `pnpm verify` can confirm, and the
dependencies it carries.

This PRD is the executable plan. `.agent-state/directive.md`
is its lean queue mirror — one line per item, pointing back
here for the why and the acceptance bar. Shipped milestone
history lives in `docs/ROADMAP.md` (human-readable summary)
and in `git log` + `.agent-state/decisions.ndjson` (audit
trail).

Authority chain when docs disagree (per `AGENTS.md`):
DESIGN > ARCHITECTURE > DECISIONS > **PRD (this doc)** >
directive > ROADMAP.

## Lanes — corrected ordering (foundation → asset → surface)

Original PR #60 ordering put REBRAND before BUILD-CONFIG /
RESTRUCTURE, which forced every new component to land in the
old `src/BoneBuster*.tsx` shape and need a second move later.
The corrected topological order below is now the authority.
Items already shipped pre-correction (ITCH-FETCH IF1-IF7,
REBRAND R1-R5) stay as shipped — they were genuine-value work
that will be re-located by RESTRUCTURE in the same mechanical
pass as everything else.

**Foundations first** — these have to land before any
post-RESTRUCTURE component or asset wiring:

1. **BUILD-CONFIG** — Vite/Vitest/Pages alignment. Get the
   deployed gh-pages target green so every subsequent commit
   can verify against a real URL. Lock in foldable
   responsive + touch sticks so input contract is stable
   before UI work starts.
2. **RESTRUCTURE** — adopt `app/` + `src/` layout per
   arcade-cabinet conventions; drop project-name prefix from
   filenames. Migrate every shipped component (including
   `BoneBusterWordmark`, `ScuffShader`, `audio/logoSting.ts`)
   to the new layout in one mechanical pass.

**Asset acquisition next** — depends on foundations being
in place so outputs land where consumers will live:

3. **ITCH-FETCH** — *(IF1-IF7 already shipped; only the
   audio-inventory follow-up [A11a renamed to ITCH-AUDIO]
   remains here)* — full itch.io library walk + extract.

**Surface work last** — depends on foundations + assets:

4. **REBRAND** — typography + palette + landing redesign.
   New components land in `app/landing/`, `app/atoms/`,
   etc. directly. *(R1-R5 already shipped; R6-R10 remain.
   R6 logo sting is re-scoped to play a sampled OGG via
   Howler, not procedural Tone synths — see AUDIO §A11c.)*
5. **AUDIO** — itch.io horror/ambient/SFX integration. The
   runtime audio layer swaps from Tone.js (procedural-synth,
   wrong tool for sampled OGG) to Howler.js (purpose-built
   for game audio sample playback). The existing 19
   procedural play-functions in `src/sfx.ts` are REMOVED
   and replaced with OGG sprite-play calls.
6. **IDENTITY** — gameplay-design depth (HUD, weapons,
   enemy renames, 24-kind roster expansion, vulnerability
   tags, level-name generator). Depends on REBRAND palette
   + ITCH-FETCH extracts (D5 needs the 12 new enemy GLBs).
7. **ARCHETYPE INTERLEAVE** — per-archetype content audit
   + InstancedField/EphemeralPool perf refactor, 5 slices
   (corridor → arena → courtyard → sewer → library).

**Parallel cleanup:**

8. **MIGRATE** — old-repo Pages redirect + 30-day archive.
   Can run in parallel throughout.

---

## ITCH-FETCH — full library audit + extract

**Motivation:** The user owns 316 itch.io keys (verified via
`~/src/arcade-cabinet/voxel-realms/.itch-cache/all-keys.json`).
The current `references/` directory holds a fraction of that
library. The PSX/retro bucket alone (37 keys) covers character
megapacks, modular mansion assets, machinery, traps, vehicles,
farm/food, weapon variants — most never downloaded. ITCH-FETCH
unblocks every downstream content lane (D5/D7/D9/A11).

### IF1 — General-purpose itch.io fetcher

- **Surfaces:** `scripts/fetch-itch.mjs` (new), `package.json` script `itch:fetch`.
- **Reference shape:** `~/src/arcade-cabinet/voxel-realms/scripts/fetch-itch-audio.mjs` — drop the "-audio" coupling.
- **Acceptance:** `pnpm itch:fetch --dry --filter=psx` lists matching owned packs by category without downloading. Idempotent (re-running skips already-downloaded archives). Reads `ITCH_API_KEY` from `.env` (gitignored).

### IF2 — Owned-key metadata cache

- **Surfaces:** `.itch-cache/all-keys.json` (gitignored), `scripts/fetch-itch.mjs`.
- **Acceptance:** Fresh fetch from the itch.io API populates `.itch-cache/all-keys.json` with all 316 owned packs. Each entry has category inference (PSX / audio / 3D-low-poly / 2D / weapons / tileset / characters / horror / nature / misc).

### IF3 — Whole-library inventory doc

- **Surfaces:** `docs/ITCH-INVENTORY.md` (new).
- **Acceptance:** `pnpm itch:fetch --inventory` writes every owned pack to the doc grouped by category, with title + url + category + (downloaded? extracted? wired?) status flags. Re-runnable; deterministic ordering.

### IF4 — Opt-in allow-list per category

- **Surfaces:** `scripts/itch-allowlist.json` (new).
- **Acceptance:** Initial draft includes all 37 PSX/retro packs + 15 audio packs + 5 horror-character extras (~57 packs total). Editing the JSON gates the next fetch.

### IF5 — Bulk download + extract

- **Surfaces:** `raw-assets/archives/` (gitignored), `raw-assets/extracted/{category}/{pack}/` (gitignored), `scripts/fetch-itch.mjs`.
- **Acceptance:** `pnpm itch:fetch` walks the allow-list, downloads to archives/, extracts (zip + 7z + tar.gz) to extracted/{category}/. Re-running skips finished work. Disk-usage summary printed at end.

### IF6 — FBX→GLB conversion pass

- **Surfaces:** `scripts/convert-fbx.mjs` (extend), `references/_extracted/{category}/`.
- **Acceptance:** Existing converter walks `raw-assets/extracted/**.fbx` (and `.obj`, `.glb`) and emits GLBs to `references/_extracted/{category}/`. Materials embedded; textures inlined. Production wiring happens via D7-X.

### IF7 — Asset inventory doc

- **Surfaces:** `docs/ASSET-INVENTORY.md` (refresh), `scripts/audit-extracted-assets.mjs` (new).
- **Acceptance:** Inventory groups every extracted GLB by category with suggested archetype assignment (corridor / arena / courtyard / sewer / library). Source of truth for D5 / D7 / D9 sub-pickers. Re-runnable from the references tree.

---

## REBRAND — typography + palette + landing redesign

**Motivation:** Lock-in of the Bone Buster identity per
`docs/REBRAND.md`. Sequential: each item gates the next.

### R1 — Self-hosted Bone Buster fonts

- **Surfaces:** `package.json` (`@fontsource/{bungee,bungee-inline,bungee-shade,space-grotesk,jetbrains-mono,tilt-prism}`), `src/design-tokens/typography.ts` (new exports `TYPE.display`, `TYPE.body`, `TYPE.mono`, `TYPE.flair`), `app/fonts.css`.
- **Acceptance:** Every `font-family` reference in app code resolves through `TYPE.*`. CSP gate (S2) still passes — no remote font URLs. Smoke test loads landing in Vitest browser project and asserts computed `font-family` includes "Bungee" for the display element.

### R2 — Bone palette swap

- **Surfaces:** `src/design-tokens/colors.ts` (`ROLE.*` values), `app/tokens.css` (`--obx-*` mirror).
- **Acceptance:** ROLE.* names unchanged; values match `docs/REBRAND.md` §Color scheme (warm cream + buster-orange + dried-blood on charcoal-violet). 5 canonical screenshots refresh; visual diff against expectations.

### R3 — Landing redesign

- **Surfaces:** `app/landing/Landing.tsx` (replaces `BoneBusterLanding.tsx` after RESTRUCTURE; pre-RESTRUCTURE lands at `src/BoneBusterLanding.tsx`).
- **Acceptance:** SVG `<text>` logo in Bungee, layered Bungee Inline + Bungee Shade for letterpress depth, framer-motion stagger drop-in, Tilt Prism axis flicker on lock-in. "They had it coming." tagline in Space Grotesk. Browser smoke test renders the route and asserts the tagline string is present.

### R4 — Animated scuff shader

- **Surfaces:** `src/shaders/scuff.frag` (or canvas `<canvas>` Perlin noise component), Landing background.
- **Acceptance:** Animated noise tinted `surface.elevated` with occasional `accent.primary` scratch flashes. Falls back to static SVG noise on AdaptiveResolution low-quality.

### R5 — Radix card-menu

- **Surfaces:** Landing `<NavigationMenu>`, framer-motion hover.
- **Acceptance:** Landing's button list becomes Radix `<NavigationMenu>` styled as -2°-tilted ticket-stub cards. Keyboard nav preserved (Tab order + Enter activate).

### R6 — Audio logo sting

- **Surfaces:** `src/audio/logoSting.ts` (new), Landing mount effect.
- **Acceptance:** Tone.js 1.2s minor-key arpeggio (A2-C3-E3) + rim-shot on lock-in. Fires once on landing mount; dedupes across re-mounts (module-level flag).

### R7 — HUD palette + type refresh

- **Surfaces:** `BoneBusterHUD.tsx` chips + readouts.
- **Acceptance:** Numerals + level names use TYPE.display; sub-labels use TYPE.body; debug overlay uses TYPE.mono.

### R8 — Source-string sweep

- **Surfaces:** every `src/**`, `tests/**`, `docs/**`, `.github/**`, `package.json`, `capacitor.config.ts`.
- **Acceptance:** No `objexoom` / `Objexoom` / `OBJEXOOM` literals outside changelog appendices and intentional historical references. Unit tests pin the post-rebrand contract. The URL flag `?bonebusterDebug` becomes `?debug`, the window global `__bonebuster` becomes `__bonebuster`, and every e2e spec is updated alongside. The Capacitor `appId` and Java package path rename live separately under R9 (Capacitor + Android namespace).

### R9 — Capacitor + Android namespace rename

- **Surfaces:** `capacitor.config.ts` (`appId=com.arcadecabinet.bonebuster`, `appName=Bone Buster`), `android/app/build.gradle`, Java package path `com/objexiv/objexoom/` → `com/arcadecabinet/bonebuster/`.
- **Acceptance:** `pnpm cap:sync` succeeds. S1 hardening test's package-path assertion updated. APK built via `assembleDebug` installs and launches.

### R10 — release-please rename

- **Surfaces:** `release-please-config.json` (`package-name="bone-buster"`).
- **Acceptance:** Next release tag cuts a fresh `v0.5.0` with REBRAND as the headline; release-please bot posts a green release PR.

---

## IDENTITY — gameplay-design depth

### D1 — Locked-weapon HUD as status indicator

- **Surfaces:** `BoneBusterHUD.tsx` weapon-chip render.
- **Acceptance:** Locked chips render with dim numeral, no border, no `cursor: not-allowed`. Matches DOOM-style ownership row. Visual gate refreshes.

### D2 — Procedural maps spawn weapon-ammo pickups

- **Surfaces:** `src/buildMap.ts` pickup spawn logic, `src/scatter/{archetype}/`.
- **Acceptance:** Every generated map spawns ≥1 chaingunAmmo + ≥1 shotgunAmmo, plus 1 flamethrowerAmmo every 3 maps. Per-archetype bias (arena → chaingun, courtyard → shotgun, library → rare flamethrower). Spawn locations farthest-from-spawn sector. Unit test pins min counts across 50 seeds.

### D3 — Weapon-acquired HUD beat

- **Surfaces:** `BoneBusterHUD.tsx` PickupChip + new weapon-acquired ref handler.
- **Acceptance:** First time `ownedWeapons[X]` flips false→true, 600ms chip-brighten animation fires. Idempotent (no replay on weapon switch). Unit test asserts the ref-trigger fires exactly once per weapon.

### D4 — Enemy kind rename

- **Surfaces:** `src/engine.ts` (EnemyKind union), `src/models.ts` (ENEMY_MODELS), `src/enemyAi.ts`, every test.
- **Acceptance:** `skeleton→rattler`, `wraith→phaser`, `imp→bouncer`. HUD strings + kill-confirm popups updated. All ~700 tests green.

### D5 — Promote enemy variants + new extracts to 24 first-class kinds

- **Surfaces:** `src/engine.ts` (EnemyKind union grows from 3 → 24), `src/models.ts`, `src/enemyAi.ts`, `src/enemyMix.ts` (per-archetype mix tables).
- **Acceptance:** Roster = 3 renames (D4) + 9 promotions of already-shipped variants + 12 new extracts from ITCH-FETCH. Full table at `docs/REBRAND.md` §"Enemy roster — 24 first-class kinds". `enemyMix.ts` per-archetype distribution sums to 1.0 for each archetype. Browser smoke test loads each archetype + asserts 24 distinct kinds reachable across 100 seeds.

### D6 — Weapon vs enemy vulnerability tags

- **Surfaces:** `src/engine.ts` (Enemy.vulnerability tag), `src/weapons.ts` (damage modifier), HUD targeting overlay.
- **Acceptance:** Each enemy kind tags one vulnerability (BLADE / PISTOL / CHAINGUN / SHOTGUN / FLAMETHROWER); damage from that weapon is +50%. HUD shows vulnerability icon when targeting (subtle overlay). Unit test pins damage multiplier.

### D7 — Per-archetype content interleave (5 slices)

See **ARCHETYPE INTERLEAVE** lane below.

### D8 — Level-name generator

- **Surfaces:** `src/levelNames.ts` (new), `BoneBusterHUD.tsx` top-left readout.
- **Acceptance:** Per-archetype pool of alliterative two-word names (table at `docs/REBRAND.md`). `pickLevelName(archetype, seed)` deterministic. HUD reads generated name instead of `E1M1 · CORRIDOR`. refLevel(0) returns fixed "Welcome Wing". Unit test pins deterministic mapping for 10 archetype × seed combinations.

### D9 — references/ weapon promotions

- **Surfaces:** `src/meleeSkins.ts` (MELEE_SKIN_URLS), `src/models.ts` weapon entries.
- **Acceptance:** 4 unused melee weapons from `references/SlasherWeaponPackRelease10.zip` (chainsaw, kitchen knife, meat hook, axe) wired into MELEE_SKIN_URLS rotation. Uzi.zip exposed as chaingun skin variant; Handcannon.glb as pistol variant; Shotgun.glb wired as canonical shotgun if not already. Unit test pins full reachability.

---

## ARCHETYPE INTERLEAVE — content audit + perf pass per archetype

**Motivation:** Each archetype gets a content audit + perf
pass slice. Order: corridor → arena → courtyard → sewer →
library. After the first slice ships, the `InstancedField` +
`EphemeralPool` factories generalize for the remaining four.

For each archetype X ∈ {corridor, arena, courtyard, sewer, library}:

### D7-X — Per-archetype content audit

- **Surfaces:** `src/scatter/{X}/`, `src/enemyMix.ts` ({X} row), `references/` assignments, archetype-specific scene tweaks.
- **Acceptance:** Outside-the-box discipline applies — every audit produces two outputs: (a) slotted asset assignments + (b) "ideas this asset gave me" list. Slot if obvious; ideas either ship inside the slice OR get added to `docs/REBRAND.md` "Parked" list. Canonical archetype screenshot refresh visually matches the new content.

### A1-X — InstancedField refactor for static scatter

- **Surfaces:** `src/scene/render/InstancedField.tsx` (new for corridor; reused for others), `src/scene/{X}Scene.tsx` static-scatter mount.
- **Acceptance:** All static walls + props + lamps + debris + decals + large-props in {X} render via one `<InstancedField>` per kind. OBS3 baseline at `tests/perf-baselines/{X}.json` updated with new draw-call count; regression check fails if subsequent commit raises draw-calls > 10% above the baseline. Visual gate unchanged.

### A2-X — EphemeralPool refactor for transient scatter

- **Surfaces:** `src/scene/render/EphemeralPool.tsx` (new for corridor; reused for others), `src/scene/{X}Scene.tsx` ephemeral mount (body parts, shells, motes, bullets).
- **Acceptance:** Ephemeral entities render via `<EphemeralPool>` with `setMatrixAt` + scale-to-zero for expired slots. Unit test asserts pool reclamation on entity expiry.

---

## AUDIO — Howler swap + itch.io sample integration

**Depends on IF5 + RESTRUCTURE.** Replaces the entire Tone.js
procedural-synth surface with Howler.js sample playback driven
by sampled OGG/MP3/WAV from the owned itch.io horror/ambient/
SFX packs. Tone.js is the wrong tool for sampled game audio
(see `howler-not-tone-for-sample-audio` rule); Howler is
purpose-built for it.

### A11a — Audio inventory

- **Surfaces:** `docs/AUDIO-INVENTORY.md` (new).
- **Acceptance:** Catalog every audio file across the 15 owned audio packs (horror SFX, ambient, music, footsteps, UI clicks). Slot suggestions per gameplay channel (pistol, chaingun, shotgun, melee, hurt, death, pickup, door, doorTick, portal, boom, ambient, music, UI click, footstep). Generated by walking `raw-assets/extracted/audio/**`.

### A11b — `public/assets/audio/` layout

- **Surfaces:** `public/assets/audio/{ambient,music,sfx,footsteps,ui}/`.
- **Acceptance:** Selected OGG/MP3 files (per A11a) hand-promoted from `raw-assets/extracted/audio/**` into the layout, tracked in git. `pnpm assets:verify-runtime` extended to walk every audio URL referenced in `src/audio/spriteRegistry.ts`.

### A11c — Howler.js swap + sprite registry

- **Surfaces:** `package.json` (`howler` runtime dep + `@types/howler`), DELETE `src/sfx.ts` (Tone.js procedural-synth surface), NEW `src/audio/howl.ts` (typed wrapper around Howler), NEW `src/audio/spriteRegistry.ts` (channel → file + sprite-offsets map).
- **Acceptance:** Every existing `playFoo(...)` call site in the gameplay code (engine, fire-path, hurt-path, enemy-AI, pickups, doors, portal, boss) routes through `play("foo")` where the channel name maps to a Howler instance + sprite offset. The 19 procedural synth channels become 19 sample-backed channels with matching cue contracts (same timing, same trigger surface). Tone.js is removed from runtime deps (devDep only if needed for build-time sting bake). Browser smoke test asserts `Howl` instances exist and no `Tone.Synth` references survive in `src/audio/**` or `src/engine.ts`/`src/scene/**`.

### A11d — Per-archetype ambient

- **Surfaces:** `src/audio/ambientGraph.ts` (new, Howler-backed), per-archetype Scene mount.
- **Acceptance:** Horror dark ambient for sewer / library; mystery for corridor; retro combat for arena. Cross-fade between moods via Howler's `fade(from, to, duration)` API. Loops use Howler's native looping (no manual splice).

### A11e — Music graph integration

- **Surfaces:** `src/audio/musicGraph.ts` (new, Howler-backed).
- **Acceptance:** Per-archetype background music loops via HTML5 streaming (`html5: true` on Howler for files > 2MB to avoid full-buffer decode). Boss-tier music when `devil` enemy spawns; victory sting on mission complete. No clipping at the master bus (Howler.volume cap at 0.85 by default).

### A11f — Runtime audio verifier

- **Surfaces:** `scripts/verify-runtime-audio.mjs` (new), `package.json` `assets:verify-runtime` script.
- **Acceptance:** Walks every audio URL referenced in `src/audio/spriteRegistry.ts` + per-archetype ambient/music maps; confirms file exists on disk + has a non-zero size. CI gate added to `pnpm verify`. Replaces the implicit Tone.js placeholder synth coverage.

---

## BUILD-CONFIG — Vite + Vitest + Pages alignment

**Motivation:** Align with the canonical
`~/src/arcade-cabinet/voxel-realms/{vite,vitest}.config.ts`
pattern, fix the deployed Pages site (currently broken),
and make the build viable on a foldable form factor.

**Diagnosed Pages defect (2026-05-15):**
`https://arcade-cabinet.github.io/bone-buster/` returns 200
but `index.html` references `/objexoom/assets/index-*.js`
(404). Root cause: hardcoded `base: "/objexoom/"` in
`vite.config.ts:8` for `mode === "github-pages"`. Compounded
by stale `package.json` `homepage` field.

### BC1 — vite.config.ts overhaul

- **Surfaces:** `vite.config.ts`.
- **Reference:** `~/src/arcade-cabinet/voxel-realms/vite.config.ts`.
- **Acceptance:** `base` reads from `VITE_BASE_PATH` env-var via `normalizeBasePath()`, not mode-driven. `manualChunks` splits vendor (`vendor-three`, `vendor-react`, `vendor-sqlite`, `vendor-misc`, project-internal `game-engine`). `resolve.alias` matches the post-RESTRUCTURE layout (`@scene`, `@audio`, `@engine`, `@views`, `@components`, `@atoms`, `@hooks`). `optimizeDeps.include` + `dedupe: ['react','react-dom','three']` populated.

### BC2 — vitest.config.ts overhaul

- **Surfaces:** `vitest.config.ts`.
- **Acceptance:** Matches voxel-realms `unit` + `browser` projects structure; both projects read the same aliases as vite. All ~700 tests pass against the new resolver.

### BC3 — Pages base-path fix end-to-end

- **Surfaces:** `vite.config.ts`, `.github/workflows/release.yml`, `package.json` `homepage`.
- **Acceptance:** Three changes in one commit: (a) `vite.config.ts` reads `VITE_BASE_PATH`; (b) `release.yml` passes `VITE_BASE_PATH=/bone-buster/` to the `build:pages` step; (c) `package.json` `homepage = "https://arcade-cabinet.github.io/bone-buster/"`. Verification: tag a release, `release.yml` succeeds, fetch the Pages URL, `index.html` references `/bone-buster/assets/...`, and every asset URL in the deployed `index.html` returns HTTP 200 (curl or browser-network-inspect both fine).

### BC4 — Foldable viewport + safe-area CSS

- **Surfaces:** `index.html` (meta viewport), `app/tokens.css` (safe-area padding).
- **Acceptance:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`. HUD padding uses `env(safe-area-inset-*)`. Visual gate at unfolded foldable resolution shows no clipped chips.

### BC5 — Touch joysticks on foldable

- **Surfaces:** `PlayerController.tsx` (`isCoarsePointer()` gate), settings menu.
- **Acceptance:** Joystick gate uses `(pointer: coarse) OR (max-width: 1024px AND any-pointer: coarse)` so a foldable in unfolded tablet mode still produces touch sticks. In-game "touch sticks: forced / auto / off" override added to settings, persists via existing settingsStore.

### BC6 — Responsive HUD scaling

- **Surfaces:** `BoneBusterHUD.tsx` chip CSS.
- **Acceptance:** Chip widths use `clamp(120px, 20vw, 280px)` so unfolded foldable (~2200px) HUD reads at readable scale. Visual gate at 880×2100 and 2200×1400 both render legibly.

### BC7 — Foldable smoke test

- **Surfaces:** `tests/e2e/foldable-screenshots.spec.ts` (new), `package.json` (`test:e2e:screenshots:foldable` script).
- **Acceptance:** Two new canonical screenshots — unfolded 2200×1400 and folded 880×2100 — captured via Playwright device emulation. Gates `pnpm test:e2e:screenshots:foldable` script. Both screenshots tracked in `test-results/bone-buster-screenshots/`.

---

## RESTRUCTURE — app/ + src/ layout

**Motivation:** Adopt the canonical arcade-cabinet layout:
root `app/` for `.tsx` (React/JSX) decomposed into
atoms/components/hooks/views/styles; root `src/` for `.ts`
(no JSX) bucketed by responsibility. Project-name prefixes
drop from filenames — folder owns the namespace.

Reference: `~/src/arcade-cabinet/voxel-realms/{app,src}`.

### RS1 — Migration plan

- **Surfaces:** `docs/RESTRUCTURE-PLAN.md` (new).
- **Acceptance:** Spreadsheet of every current `src/*.{ts,tsx}` file with its new home. Sub-bucket conventions documented (`app/atoms/`, `app/components/`, `app/hooks/`, `app/views/`, `app/styles/`, `src/ai/`, `src/assets/`, `src/audio/`, `src/engine/`, `src/platform/`, `src/scene/`, `src/shared/`, `src/store/`, `src/world/`).

### RS2 — Resolver + tsconfig paths

- **Surfaces:** `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`.
- **Acceptance:** `include`, `paths`, alias rewrites so both `app/` and `src/` compile and resolve. Build emits one bundle.

### RS3 — Bulk `git mv`

- **Surfaces:** every src file.
- **Acceptance:** Per-bucket commits (one commit per target directory) so reviewers see one chunk at a time. Import statements updated as part of each move commit (sed pass). All tests green between commits.

### RS4 — Drop project-name prefix on filenames

- **Surfaces:** `BoneBusterShell.tsx` → `app/shell/Shell.tsx`, `BoneBusterHUD.tsx` → `app/hud/HUD.tsx`, `BoneBusterLanding.tsx` → `app/landing/Landing.tsx`, `BoneBusterScene.tsx` → `app/scene/Scene.tsx`.
- **Acceptance:** Import-statement sweep updates every reference. Build + tests green.

### RS5 — Test imports + verify gate

- **Surfaces:** `vitest.config.ts` project includes, every test file's imports.
- **Acceptance:** All ~700 unit + 6 browser tests pass against new paths. `pnpm verify` green.

### RS6 — Docs that reference file paths

- **Surfaces:** `docs/ARCHITECTURE.md` file table, `README.md`, `AGENTS.md`, `CLAUDE.md`.
- **Acceptance:** No surviving references to `src/BoneBuster*.tsx`. Examples in docs use the new paths.

---

## MIGRATE — final residual (NON-APPLICABLE — cut)

Remote rename `objexiv/objexoom` → `arcade-cabinet/bone-buster`
completed by the user 2026-05-15. Local repo stays at
`~/src/objexiv/objexoom`; GitHub's git-protocol redirect routes
the existing origin URL transparently.

Empirical check on 2026-05-16:

- `gh repo view objexiv/objexoom` resolves to `arcade-cabinet/bone-buster`
  — the GitHub-internal repo rename handles all git + API
  redirects transparently. There is no separate OLD repo to
  manage.
- `https://objexiv.github.io/objexoom/` returns 404 — no
  legacy Pages site was ever deployed under that URL. The
  historical `package.json` "homepage" field for the
  `objexoom` name pointed at the source github URL, not at a
  Pages deployment.
- The live Pages site is the new `arcade-cabinet.github.io/bone-buster/`
  and only that.

**M4 (OLD-repo Pages redirect) and M5 (30-day archive grace)
both presupposed a separate OLD repo with its own gh-pages
deployment. Neither artifact exists.** GitHub's repo-rename
redirect is the durable substitute for both items:

- Git-protocol redirect: cloning from the old origin URL
  succeeds.
- HTTP redirect on github.com URLs: visiting the old web
  URL redirects to the new repo page.
- No Pages site to redirect; no separate repo to archive.

M4 + M5 are cut, not deferred. If a future external tool
shows stale traffic against an old Pages URL we don't know
about, re-open as a new directive item with the actual URL
captured.

## Parked — out of scope until the overhaul backlog drains

These are good ideas with no acceptance gate yet. Sliced
into a lane only when an item up-prioritizes them.

- Ghost Hunting Tools as a new gameplay layer (spirit box, EMF reader, UV flashlight, walkie-talkie, crucifix, tape recorder) — brainstormed in `docs/REBRAND.md`.
- Per-enemy-variant flavor names in kill-confirmation popup ("You busted a Plaguebeak (Stained-Cassock variant)").
- Bespoke commissioned logo — current SVG re-letter with Bungee/Inline/Shade is good enough for ship.
- Slasher melee weapons as distinct damage-profile variants (chainsaw: loud-attract; meat-hook: pull; axe: heavy-slow).

---

## Shipped history

Per-release shipped-milestone summaries live in
`docs/ROADMAP.md`. Per-decision rationale lives in
`docs/DECISIONS.md`. Per-commit audit trail lives in
`git log` + `.agent-state/decisions.ndjson`. This PRD only
carries the **remaining** work — items that ship are deleted
from here in the same commit that closes them.
