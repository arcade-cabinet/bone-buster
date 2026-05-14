---
title: Decisions
updated: 2026-05-13
status: current
domain: technical
---

# OBJEXOOM — binding technical decisions

Append-only. Each decision records the call, the why, and what was
considered + rejected. Override an old decision by adding a new
record that references the old one, not by editing it.

---

## D1 — Vite, not Next.js

**Status:** Locked
**Date:** 2026-04-23 (decision predates extraction)

OBJEXOOM uses Vite + React 19 + react-three-fiber. Not Next.js, not
Remix, not Astro, not vinext.

**Why:** OBJEXOOM is a single-page interactive 3D experience. SSR,
file-system routing, server components, ISR, edge runtime — all
weight without payoff. The game doesn't render on the server (it's
hostile to react-three-fiber), doesn't need SEO (single screen), and
ships into Capacitor (which has no concept of a server).

**Rejected:**
- *Next.js* — too much SSR machinery for a Canvas-mounted SPA. The
  parent Objexiv app is Next.js; OBJEXOOM intentionally is not.
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

## D8 — `feat/objexoom-game-buildout` is one long-running branch

**Status:** Superseded by D12 on 2026-05-14
**Date:** 2026-05-13

The branch that lands every design-system + GLB-wiring + reference-
parity commit is one long-running `feat/objexoom-game-buildout` PR,
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
mode where `base: "/objexoom/"`, raw `/assets/...` URLs 404. The
helper applies the prefix once, every site stays readable.

---

## D11 — Muzzle tip via per-weapon offset table, not gltfjsx-generated bone refs

**Status:** Locked
**Date:** 2026-05-14

PA-MOD7's original framing was "wire gltfjsx so muzzle bones become addressable as named refs." Investigation showed the wired GLBs (`pistol.glb`, `chaingun.glb`, `shotgun.glb`, `melee_machete.glb`) ship with only generic node names like `Gun` / `Bullet` — no muzzle/barrel/tip bones to address. gltfjsx would have generated typed components over those generic names, but the muzzle position would still need to be specified out-of-band.

**Call:** add a `muzzleOffset: [x, y, z]` to `WeaponModel` in `src/models.ts` measured in weapon-local space (after the same `autoScale` + `rotation` the viewmodel applies). `WeaponViewmodel` renders an empty `<group ref={muzzleRef}>` at that offset. `ObjexoomScene` reads the world-position of the muzzle ref each frame instead of `camera.position` for `muzzleLightRef`.

**Why:**
- Solves the user-visible outcome (muzzle light at the barrel tip rather than camera center) without a codegen step, new devDep, or per-asset re-export.
- Per-weapon offsets live in the same `models.ts` table where rotation and offset already do — single source of truth.
- gltfjsx-generated components add a tracked codegen surface (re-run on every GLB swap, diff churn) for no marginal benefit when the bones don't exist.
- Future-proof: if a future GLB DOES ship with a muzzle bone, the viewmodel can detect that node by name in the loaded scene graph and `<group>`-attach the muzzleRef to it inside the cloned scene — no codegen required.

**Rejected:**
- *Adopting gltfjsx as authored* — generates typed components, but the GLBs lack muzzle bones, so the typed access doesn't deliver the outcome.
- *Adding muzzle bones in Blender to each GLB and re-exporting* — pulls 4+ external authoring passes per weapon swap; tracks externally-authored binaries; couples gameplay to manual asset surgery.
- *Hardcoding the world offset at the ObjexoomScene call site* — couples scene to the per-weapon barrel geometry; explodes if we ever swap weapons.

---

## D12 — Per-item feature branches off latest main, not one long-running branch

**Status:** Locked. **Supersedes D8.**
**Date:** 2026-05-14

`feat/objexoom-game-buildout`, the single-long-running branch policy from D8, was squash-merged as PR #12 on 2026-05-14 and deleted on the remote. New work ships as **one feature branch per directive item (or tight cluster of related items)**, opened off the latest pulled `origin/main`, PR'd and squash-merged.

**Why:**
- The long-running branch grew to ~50 commits and ~12k LOC of churn before review. Review feedback at that scale loops indefinitely.
- Per-item branches keep CI feedback tight and let reviews focus on one acceptance criterion.
- Squash-merging per-item keeps `main` log readable (one commit per item or cluster) without sacrificing per-branch atomic history.

**Branch naming:** `feat/<item-id>-<slug>` (e.g. `feat/pa-mod7-muzzle-offset`, `feat/e6-switches-secrets`).

**Rejected:**
- *Keeping the long-running branch and rebasing on main periodically* — review fatigue + merge-conflict surface only grows.
- *PR per commit* — too granular when one acceptance criterion legitimately spans 3-4 commits.

---

## Decisions log conventions

- One section per decision, with a short slug (`## D11 — short title`).
- `**Status:**` is one of: `Locked`, `Active`, `Superseded by D<n>`,
  `Reverted`.
- Lead with the call, then `**Why:**` and `**Rejected:**` if relevant.
- Date is the day the decision was MADE, not the day it was written
  down.
- Never delete a decision. Supersede it.
