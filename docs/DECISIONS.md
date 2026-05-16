---
title: Decisions
updated: 2026-05-15
status: current
domain: technical
---

# BONE BUSTER — binding technical decisions

Append-only. Each decision records the call, the why, and what was
considered + rejected. Override an old decision by adding a new
record that references the old one, not by editing it.

---

## D1 — Vite, not Next.js

**Status:** Locked
**Date:** 2026-04-23 (decision predates extraction)

BONE BUSTER uses Vite + React 19 + react-three-fiber. Not Next.js, not
Remix, not Astro, not vinext.

**Why:** BONE BUSTER is a single-page interactive 3D experience. SSR,
file-system routing, server components, ISR, edge runtime — all
weight without payoff. The game doesn't render on the server (it's
hostile to react-three-fiber), doesn't need SEO (single screen), and
ships into Capacitor (which has no concept of a server).

**Rejected:**
- *Next.js* — too much SSR machinery for a Canvas-mounted SPA. The
  parent arcade-cabinet app is Next.js; BONE BUSTER intentionally is not.
- *vinext* — interesting in principle but adds a Next.js compatibility
  layer the game never uses.
- *Astro* — built for content-shaped sites; the game is interaction-
  shaped, not page-shaped.

---

## D2 — react-three-fiber + three, not raw WebGL or Babylon

**Status:** Locked
**Date:** 2026-04-23

3D rendering is r3f over three.js. Postprocessing via
`@react-three/postprocessing`. AI steering via `yuka`. Procedural
audio via Tone.js.

**Why:** r3f's declarative scene tree composes cleanly with React's
component model. The ecosystem (drei helpers, postprocessing
effects, useGLTF loader) covers 80% of game-shaped needs without
bespoke wiring. yuka brings textbook steering behaviors without
forcing us to write our own pursuit lead-target math.

**Rejected:**
- *Babylon.js* — heavier engine, more authoring tools, less React-
  ergonomic, weaker fit for the procedural-AND-curated mix.
- *PlayCanvas* — editor-first; we're code-first.
- *Pixi.js* — 2D only; the game is 3D.
- *Hand-rolled WebGL* — no.

---

## D3 — Capacitor, not React Native or Flutter

**Status:** Locked
**Date:** 2026-04-23

Mobile (Android + iOS) is Capacitor wrapping the web bundle.

**Why:** The game IS a web app. Capacitor lets the same Vite build
run as a native package by injecting WebView bindings. No port,
no separate codebase, no second renderer.

**Rejected:**
- *React Native* — would require porting the entire 3D stack to a
  different renderer (WebGL via expo-gl + react-three-fiber-native is
  immature and missing critical drei features).
- *Flutter* — different language, different rendering primitives,
  nothing carries over.

---

## D4 — Biome only

**Status:** Locked
**Date:** 2026-05-13

Lint + format is Biome. No ESLint, no Prettier, no separate
formatter.

**Why:** One tool, one config, one source of truth, one CI step. Biome
is fast enough to run on every save. The lint rules it doesn't have
yet (a handful of stylistic preferences) are not worth a second
toolchain.

**Rejected:**
- *ESLint + Prettier* — two tools, two configs, two slow steps. We
  used to run them; biome replaces both.

---

## D5 — release-please for versioning

**Status:** Locked
**Date:** 2026-05-13

Releases are cut by release-please reading Conventional Commits on
`main`. Manifest is `.release-please-manifest.json`.

**Why:** Squash-merging PRs produces a clean conventional-commit
history; release-please reads it, opens a release PR, and merges it
to cut a tag. No manual `npm version`, no hand-curated CHANGELOG.

**Rejected:**
- *changesets* — better for multi-package monorepos; this is a single
  app. Adds dev friction without payoff here.
- *Hand-curated tags* — fine for a one-person hobby; we're past that.

---

## D6 — Self-hosted fonts, not Google Fonts CDN

**Status:** Locked
**Date:** 2026-05-13

Black Ops One + Rajdhani live as 12 woff2 files in
`public/assets/fonts/`. `app/fonts.css` declares them with
`font-display: swap`.

**Why:** Capacitor runs offline. CDN fetches stalled the Playwright
stability gate during the e2e screenshot pass. Self-hosting eliminates
both failure modes at the cost of ~120 KB total bundle.

**Rejected:**
- *Google Fonts CDN* — fails offline, stalls Playwright.
- *@fontsource* — adds a build dependency for what is fundamentally
  a static-file copy.

---

## D7 — Design tokens via semantic ROLE layer

**Status:** Locked
**Date:** 2026-05-13

Component code references `ROLE.actionFire`, NOT `SCALE.blood[500]`.
`ROLE` maps to specific scale steps; component code is shielded from
scale drift.

**Why:** Without the indirection, swapping `blood[500]` would require
grepping for every site. With it, one edit in `colors.ts` propagates.
This is the standard design-token pattern from Tailwind / Radix /
Vanilla Extract et al.

**Override protocol:** A component that genuinely needs a specific
scale step (e.g., a tooltip arrow tint that differs from the role's
default by one step) imports `SCALE` directly with a `// scale-step:
<reason>` comment.

---

## D8 — `feat/bone-buster-game-buildout` is one long-running branch

**Status:** Superseded by D12 on 2026-05-14
**Date:** 2026-05-13

The branch that lands every design-system + GLB-wiring + reference-
parity commit is one long-running `feat/bone-buster-game-buildout` PR,
not a churn of small PRs.

**Why:** User directive 2026-05-13 — "you have zero churn / and can
FULLY implement EVERYTHING all GLBS all procedural full clone of the
reference clone etc". Zero context-switching, one review surface, the
PR opens only when the game is FULLY done.

**Caveat:** This decision does NOT apply to hotfixes or unrelated
work — those still get their own focused PRs.

---

## D9 — Port-pinned to 5191 (dev) + 8191 (preview)

**Status:** Locked
**Date:** 2026-05-13

`vite.config.ts` sets `server.port: 5191` + `preview.port: 8191` with
`strictPort: true`. Playwright also pins to 5191.

**Why:** Vite's default 5173 is shared by every other Vite project on
the machine. With `reuseExistingServer: true` Playwright was happily
attaching to whichever project owned 5173, producing screenshots of
totally different games. Pinning eliminates the collision.

---

## D10 — `import.meta.env.BASE_URL` aware asset URLs

**Status:** Locked
**Date:** 2026-05-13

All asset URLs in `src/models.ts` flow through `A(path)` which
prefixes `import.meta.env.BASE_URL`.

**Why:** Three's loaders (useGLTF, GLTFLoader) fetch URLs via `fetch`
which respects the document base, NOT Vite's `base` env. In gh-pages
mode where `base: "/bone-buster/"`, raw `/assets/...` URLs 404. The
helper applies the prefix once, every site stays readable.

---

## D11 — Muzzle tip via per-weapon offset table, not gltfjsx-generated bone refs

**Status:** Locked
**Date:** 2026-05-14

PA-MOD7's original framing was "wire gltfjsx so muzzle bones become addressable as named refs." Investigation showed the wired GLBs (`pistol.glb`, `chaingun.glb`, `shotgun.glb`, `melee_machete.glb`) ship with only generic node names like `Gun` / `Bullet` — no muzzle/barrel/tip bones to address. gltfjsx would have generated typed components over those generic names, but the muzzle position would still need to be specified out-of-band.

**Call:** add a `muzzleBboxFrac: [x, y, z]` to `WeaponModel` in `src/models.ts` specifying the muzzle's position as a fraction of the GLB's bounding box on each axis (0 = bbox min, 1 = bbox max). The viewmodel computes the bbox at mount, multiplies by the frac, and parents an empty `<group ref={muzzleRef}>` at that local position — so the marker rides through the same `autoScale` + `rotation` the rest of the weapon does. `BoneBusterScene` reads the world-position of the muzzle ref each frame instead of `camera.position` for `muzzleLightRef`. (Earlier draft called this `muzzleOffset` measured in absolute weapon-local units; the bbox-frac form was the actual implementation chosen because GLB authoring scales vary.)

**Why:**
- Solves the user-visible outcome (muzzle light at the barrel tip rather than camera center) without a codegen step, new devDep, or per-asset re-export.
- Per-weapon offsets live in the same `models.ts` table where rotation and offset already do — single source of truth.
- gltfjsx-generated components add a tracked codegen surface (re-run on every GLB swap, diff churn) for no marginal benefit when the bones don't exist.
- Future-proof: if a future GLB DOES ship with a muzzle bone, the viewmodel can detect that node by name in the loaded scene graph and `<group>`-attach the muzzleRef to it inside the cloned scene — no codegen required.

**Rejected:**
- *Adopting gltfjsx as authored* — generates typed components, but the GLBs lack muzzle bones, so the typed access doesn't deliver the outcome.
- *Adding muzzle bones in Blender to each GLB and re-exporting* — pulls 4+ external authoring passes per weapon swap; tracks externally-authored binaries; couples gameplay to manual asset surgery.
- *Hardcoding the world offset at the BoneBusterScene call site* — couples scene to the per-weapon barrel geometry; explodes if we ever swap weapons.

---

## D12 — Per-item feature branches off latest main, not one long-running branch

**Status:** Locked. **Supersedes D8.**
**Date:** 2026-05-14

`feat/bone-buster-game-buildout`, the single-long-running branch policy from D8, was squash-merged as PR #12 on 2026-05-14 and deleted on the remote. New work ships as **one feature branch per directive item (or tight cluster of related items)**, opened off the latest pulled `origin/main`, PR'd and squash-merged.

**Why:**
- The long-running branch grew to ~50 commits and ~12k LOC of churn before review. Review feedback at that scale loops indefinitely.
- Per-item branches keep CI feedback tight and let reviews focus on one acceptance criterion.
- Squash-merging per-item keeps `main` log readable (one commit per item or cluster) without sacrificing per-branch atomic history.

**Branch naming:** `feat/<item-id>-<slug>` (e.g. `feat/pa-mod7-muzzle-offset`, `feat/e6-switches-secrets`).

**Rejected:**
- *Keeping the long-running branch and rebasing on main periodically* — review fatigue + merge-conflict surface only grows.
- *PR per commit* — too granular when one acceptance criterion legitimately spans 3-4 commits.

---

## D13 — Keep `bone-buster:*` channels as window-event broadcasts, just type them

**Status:** Locked. **Amends ARCH1 directive item.**
**Date:** 2026-05-14

ARCH1's original framing called for converting five "Shell↔Scene channels" (`fpsUpdate`, `shake`, `playerHit`, `fellToDeath`, `teleport`) from window-event broadcasts to direct ref callbacks on `GameRef` / `SceneRef`. Use-case enumeration before opening the migration revealed the actual cross-component traffic is NOT Shell↔Scene:

| Channel | Producer | Consumer | Actual topology |
|---|---|---|---|
| `fpsUpdate` | `BoneBusterScene` (inside Canvas) | `BoneBusterHUD` (DOM sibling) | Scene → HUD, not Shell↔Scene |
| `shake` | `BoneBusterShell` (onHit handler) | `PlayerController` (inside Scene) | Shell → grandchild |
| `teleport` | `BoneBusterShell` (level-change effect) | `PlayerController` | Shell → grandchild |
| `playerHit` | both Shell (onHit) AND Scene (explosion path) | Scene (burst emitter) | multi-source |
| `fellToDeath` | `PlayerController` (fall detection) | `BoneBusterShell` (game-over) | grandchild → Shell |

**Call:** keep all 14 `bone-buster:*` channels as window-event broadcasts; just route every call site through the typed `dispatch` + `addBoneBusterListener` helpers landed in ARCH1a. Topology stays; type-safety lands.

**Why:**
- Direct ref callbacks would force `BoneBusterShell` to receive imperative handles from grandchildren (`PlayerController` via `BoneBusterScene`), inverting the React data-flow direction it already establishes via `GameRef`.
- Broadcast IS the right shape when producer and consumer are siblings or aunt/nephew — there's no shared parent that can plumb a callback without leaking implementation details.
- The original ARCH1 framing was a categorization error (treating these as "Shell↔Scene" because the originating directive was written before the actual call-site map was inspected). Use-case enumeration before code is the standing rule per CLAUDE.md.
- The full **win** of ARCH1 — type-checked event payloads, autocomplete on `e.detail.kind`, compile-time failure when a producer and consumer disagree on shape — lands fully from typed-dispatch alone.

**Rejected:**
- *Forcing five channels through ref callbacks* — would invert data flow, leak grandchild handles into Shell, and add coupling worse than the broadcast it replaced.
- *Splitting the channel set into "ref-callback" + "broadcast"* — discoverability hit; future devs have to remember which channels live where. One uniform pattern is better.

---

## D14 — PWA verification via Lighthouse best-practices + manifest validity, not the retired `pwa` category

**Status:** Locked. **Amends AO.5 directive item.**
**Date:** 2026-05-14

AO.5's original acceptance referenced "Lighthouse PWA score ≥ 90." Lighthouse 12 retired the dedicated `pwa` category; Lighthouse 13 (current at the time of this commit, `npx lighthouse@13.3.0`) reports exactly five categories: `performance`, `accessibility`, `best-practices`, `seo`, `agentic-browsing`. There is no PWA score to target.

**Call:** PWA-readiness is verified by three concrete signals instead:

1. `public/manifest.webmanifest` exists and is served with `Content-Type: application/manifest+json`. The manifest declares: `name`, `short_name`, `description`, `start_url`, `scope`, `display`, `background_color`, `theme_color` (from token `#03050b` = `--obx-bg-void`), and a `icons` array including a 192×192 and a 512×512 PNG plus a maskable 512×512.
2. `index.html` head links the manifest, favicon (32×32 PNG + `.ico` alias), apple-touch-icon (180×180), and sets `theme-color` to match the manifest value.
3. Lighthouse 13 `best-practices` and `accessibility` categories both score ≥ 90 against a `vite preview` build.

**Why:**
- Tooling drift: targeting a retired Lighthouse category creates an acceptance criterion that can never be marked done.
- The underlying signals (installable manifest, viewport/theme-color/icons in HEAD) ARE still audited by Lighthouse 13 — they just live under the `best-practices` and `seo` umbrellas rather than the dedicated `pwa` category.
- Manifest validity + icon presence + theme-color consistency is enough for Android `Add to Home Screen` and iOS "Add to Home Screen" to install the game correctly — which is the underlying user-facing goal.

**Rejected:**
- *Pinning Lighthouse to a pre-12 version that still has `pwa`* — masks the truth and ships against deprecated tooling.
- *Switching to PWABuilder's report.* — third-party dependency for a thing Lighthouse already covers via separate categories.

---

## D15 — AudioBus: channel-per-synth, not channel-per-cue (AUDIO1)

**Status:** Locked.
**Date:** 2026-04-30 (shipped); backfilled 2026-05-15 per ARCHITECTURE audit §7.5

`src/audioBus.ts` keys channels by SYNTH INSTANCE, not by cue. Multiple cues (e.g. `playPickup`, `playSecretFound`) that share the underlying `Tone.PolySynth` route through the SAME channel; channels schedule via a strictly-increasing `t` so Tone's "Start time must be strictly greater than previous start time" check never trips.

**Why:**
- Pre-AUDIO1, every cue had its own scheduling state. Two cues firing into the same synth in the same JS tick (e.g. pickup chime + secret-found chime via overlapping pickups) would race on Tone's per-synth precondition and throw mid-frame.
- The synth-instance keying is what the precondition actually cares about; cue keying was the wrong axis.
- Reduces N×M scheduling complexity (N cues × M synths) to N synth channels with a single jitter pool each.

**Rejected:**
- *One channel per cue with explicit synth re-binding.* — would just move the race condition into the binding layer; doesn't actually solve the precondition.
- *Single global Tone scheduler.* — couples unrelated cues; one slow cue stalls the global timeline.

Source: `src/audioBus.ts:30-65` documents the synth-to-cue map inline.

---

## D16 — Per-frame work extracted from BoneBusterScene to `src/scene/tick/*` (ARCH2a/b + QW8)

**Status:** Locked.
**Date:** 2026-05-10 (ARCH2a enemyTickLoop) / 2026-05-13 (ARCH2b fireResolution) / 2026-05-15 (QW8 directory rename)

Per-frame logic that doesn't belong in the r3f scene-render path lives in pure-function modules under `src/scene/tick/`:
- `enemyTickLoop.ts` — per-frame enemy AI loop (FSM step + collision + LOS + bullet emission).
- `fireResolution.ts` — single-shot fire resolution (ray cast + barrel/enemy hit dispatch).
- `returnBearing.ts` — module-scope ref + `computeBearingRad` pure helper for the going-back HUD arrow.
- `timeScaleBus.ts` — combined-min time-scale reservation bus (POL35 hitstop + POL22 key-acquire stacking).

These take an explicit "context" object (refs + game state) and return nothing — pure-fn signatures, testable without mounting React. The Scene's useFrame body becomes "build the context, call the tick fn."

QW8 (Phase 21) moved the files from `src/scene/hooks/` to `src/scene/tick/` because none of them are React hooks (no `use*` calls). `src/scene/hooks/` still exists but now only holds genuine React hooks (CONV2's `useGameRef.ts`).

**Why:**
- BoneBusterScene was a 1000+ LOC braid of declarative scene-graph + imperative tick logic; extracting tick logic let each side be reasoned about independently.
- Pure-function shape means unit tests don't need r3f's test renderer; they assert against the context state directly.

**Rejected:**
- *Custom useFrame hooks (one per behavior).* — coupling between hooks via shared refs would have meant N hooks each reading the same ~10 refs; the pure-function pattern keeps the ref set explicit at the call site.

Source: ARCHITECTURE.md (rendering layer table). Files in `src/scene/tick/`.

---

## D17 — sql.js removed after STO1b migration grace window (ARCH3)

**Status:** Locked.
**Date:** 2026-05-15 (PR #39)

Pre-STO1b, run history was an sql.js `Database` blob in `localStorage["bone-buster.runHistory"]`. STO1b shipped the Capacitor SQLite + jeep-sqlite migration (D18 below) with a one-time legacy-blob read+import. ARCH3 (Phase 20) removed sql.js entirely:
- `package.json`: removed `sql.js` + `@types/sql.js` deps.
- `src/runHistory.ts:79-104`: the legacy-blob branch now logs a warning, drops the localStorage key, and continues — no import path.
- `scripts/prepare-web-wasm.mjs`: emptied the WASM artifact list (was just `sql-wasm.wasm`).

**Why:**
- Any install with the legacy blob that hadn't yet opened the game between STO1b shipping (2026-05-11) and ARCH3 shipping (2026-05-15) is vanishingly rare. The grace window was real; the warning catches the edge case visibly.
- Carrying sql.js was 1.1MB of wasm + a duplicate persistence path for a contract STO1b already satisfied.

**Rejected:**
- *Indefinite grace window with sql.js as a fallback.* — defers the cleanup forever; STO1b's whole point was to unify on one persistence API.

Source: `src/runHistory.ts:79-104`, `src/__tests__/unit/bone-buster-sqljsRemoval.test.ts` (pins the absence contract).

---

## D18 — Persistence stack: `@capacitor-community/sqlite` native + `jeep-sqlite` web (STO1b)

**Status:** Locked.
**Date:** 2026-05-11 (shipped); backfilled 2026-05-15

`src/persistence/createDatabase.ts` returns a `DatabaseAdapter` backed by:
- **Native (iOS/Android):** `@capacitor-community/sqlite` via the Capacitor bridge → a real SQLite database in the app sandbox.
- **Web:** `jeep-sqlite` (IndexedDB-backed sql.js shim via a custom element). The element is mounted once at app boot via `src/persistence/initJeepSqlite.ts`.

Settings (light, hot-read) use `@capacitor/preferences` instead — also localStorage-backed on web, native KV store on native.

**Why:**
- Pre-STO1b, persistence was sql.js + base64-into-localStorage. That works on web but doesn't survive Capacitor's native runtime (no shared `window.localStorage` write path) and forces two parallel storage APIs in the codebase.
- The Capacitor SQLite plugin gives both targets a real SQL surface; we keep one query layer (`runHistory.ts`) on top of one adapter contract.
- `"no-encryption"` is intentional — the only persisted data is run history (scores, secrets-found counts) which is non-sensitive. Encryption would add a passphrase-management surface we don't need for a single-player game.

**Rejected:**
- *Drizzle / Prisma / etc.* — overhead for a 1-table schema with ≤500 rows lifetime.
- *Pure IndexedDB.* — DIY query layer is bigger than the persistence module itself.
- *sql.js everywhere.* — preserves the localStorage roundtrip that breaks under Capacitor.

Source: `src/persistence/createDatabase.ts`, `src/persistence/database.ts`, `src/runHistory.ts`, `capacitor.config.ts:13-17` (encryption opt-out rationale).

---

## Decisions log conventions

- One section per decision, with a short slug (`## D11 — short title`).
- `**Status:**` is one of: `Locked`, `Active`, `Superseded by D<n>`,
  `Reverted`.
- Lead with the call, then `**Why:**` and `**Rejected:**` if relevant.
- Date is the day the decision was MADE, not the day it was written
  down.
- Never delete a decision. Supersede it.
