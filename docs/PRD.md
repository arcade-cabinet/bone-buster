---
title: PRD — Bone Buster (remaining work)
updated: 2026-05-17
status: current
domain: product
---

# Bone Buster — Product Requirements (remaining work)

Authoritative spec for unshipped work-units. Every unshipped
item has a user story / motivation, the specific surfaces it
touches, an acceptance criterion `pnpm verify` (or a named
gate) can confirm, and the dependencies it carries.

`.agent-state/directive.md` is the lean queue mirror — one
line per item, pointing back here for the why and the
acceptance bar. Shipped history lives in `docs/ROADMAP.md`,
`git log`, `.agent-state/decisions.ndjson`, and `CHANGELOG.md`.

Authority chain (per `AGENTS.md`):
DESIGN > ARCHITECTURE > DECISIONS > **PRD (this doc)** >
directive > ROADMAP.

## Status — overhaul drained (2026-05-17)

The full overhaul backlog has shipped:

- **BUILD-CONFIG** (BC1–BC7), **RESTRUCTURE** (RS1–RS6) —
  foundations.
- **ITCH-FETCH** (IF1–IF7) — asset acquisition.
- **REBRAND** (R1–R10) — typography + palette + landing +
  Capacitor namespace + event-prefix rename.
- **AUDIO** (A11a–A11f) — Howler swap + spritesheet + ambient
  + music + verifier.
- **IDENTITY** (D1–D9) — HUD, 24-kind enemy roster,
  vulnerability tags, weapon-acquired beat, weapon variants,
  level-name generator.
- **ARCHETYPE INTERLEAVE** (D7-X + A1-X + A2-X) —
  corridor/arena/courtyard/sewer/library content audits +
  InstancedField/EphemeralPool perf refactor.
- **MIGRATE** — cut as non-applicable (GitHub repo-rename
  redirect handles the URL change durably).

The latest slice — **D19 dual-PRNG + R8 event-prefix follow-up**
— ships in PR #75 alongside the reference-asset drain (Lanes
C/D/E/F) and the InstancedField perf migration of the
remaining four scatter fields (PT1–PT6).

See `docs/DECISIONS.md` §D19 for the dual-PRNG architecture
rationale and `docs/ROADMAP.md` for the human-readable
shipped-milestone summary.

## Remaining work

### LANE: OVERHAUL2 — visual/feel/structure pass (2026-05-28, user-directed)

Captured live from playtest findings. Authority: direct user direction this
session. Theme: the game must read as a **dark, gritty, modernized-DOOM ×
Silent-Hill horror maze** built from the existing PSX asset library — readable,
atmospheric, and fully committed to procedural generation. Each item carries a
user story, surfaces, and an acceptance bar.

#### PREP (from the 2026-05-29 comprehensive-review run — land BEFORE the features)

The full review (`.full-review/05-final-report.md`) found prep-work that must
land first or the STRUCT/HUD features inherit + amplify existing debt. Tracked
in the directive's Step 2.5; acceptance bars:
- **PREP-C1/C2 layering:** `GameState`/`GameRef`/`WeaponState`/`LevelPhase`/
  `FadeKind` are defined in the UI god-component (`app/views/Shell.tsx`) and
  imported DOWN into the pure store/scene layers; `gameReducer` has a runtime
  value-dep on `@views/gameConstants`. *Acceptance:* domain types live in
  `src/store/gameState.ts`, constants in `src/store/gameConstants.ts`; no
  `src/` file imports a value from `app/`. Unblocks STRUCT4's pure unit tests.
- **PREP-DOC:** add DECISIONS D22 (VIS flood-lighting reversal of the J1 dark-
  reveal), D23 (STRUCT1 grid-vs-sector map-representation choice), extend D16
  (sceneTick); rewrite DESIGN.md (it currently states "procedural-AND-curated
  mix" + archetype-as-%5 — both CONTRADICT STRUCT1/2, and DESIGN>PRD in the
  authority chain); refresh ARCHITECTURE.md (missing the whole `src/scene/`
  subtree). *Acceptance:* DESIGN/ARCHITECTURE/DECISIONS match the OVERHAUL2
  direction; no doc an implementer reads contradicts the lane.
- **PREP-PERF1 (CRITICAL):** enemy LOS is `O(enemies×sectors×edges)` every
  frame with no cull/throttle — the depth-scaling (STRUCT3, more enemies) ×
  fog-horizon (VIS2b, more sectors) is a count×count blowup that breaches the
  30fps mobile floor. *Acceptance:* LOS throttled + distance/horizon-gated +
  sector-AABB broad-phase; `pnpm test:perf:mobile` holds the floor at the
  enemy-count A/B; aggro latency <150ms test.
- **PREP-PERF2/PERF3/BP1:** pickUvHidden O(n²) → single-fork; VIS1 directional
  shadow off on mobile (4-8ms Pixel 5a — introduced by VIS1); WaterSurface
  DataTexture disposed.
- **PREP-CI1..4 (gate hardening):** continuous-deploy on push:main (kills the
  deploy-staleness class); mobile-perf gate required + enemy-count/shadow A/B
  probes (catches PERF-1/PERF-3); CodeQL. *Acceptance:* a count-scaling perf
  regression fails CI; a user-facing main push can't silently fail to deploy.
- **STRUCT1↔STRUCT5 reconciliation (resolved):** the review flagged that
  STRUCT1's phrase→archetype hashing conflicts with STRUCT5's pressure-weighted
  selection. RESOLUTION (user-confirmed): biome is a generator INPUT chosen by
  `pickNextBiome(pressure, eventRng)`, NOT derived from the phrase. `buildMap`/
  the biome generator take `biome` + `depth` as params and stop hashing biome.

**VIS — visual presentation**

- **VIS1 (DONE this session) — flat-flood lighting, not dark-reveal.** PSX
  assets are washed-out + chunky BY DESIGN; they must be lit by a broad flood,
  not hidden behind a flashlight-reveal mechanic. Killed the 0.12-ambient
  dark-base; ambient 0.95 + directional 1.1 + hemisphere 0.7 flood regardless of
  flashlight. *Acceptance:* in-game screenshot on ANGLE-GL reads all wall/floor
  texture + model detail clearly (no near-black scenes). DONE — verified.
- **VIS2 (DONE this session) — Silent-Hill fog as mood + cull horizon.** Fog is
  a luminous mid-tone archetype-tinted haze (not [900] near-black) that distance
  fades INTO — gives mood AND a draw/cull horizon the engine can use to hot-load
  the next area as the player runs in. *Acceptance:* distant geometry fogs out
  to a tinted haze, not a hard black cutoff. DONE (fog colors → [500]/[600];
  near 8). *Follow-up VIS2b:* wire the fog far-plane to actual area streaming/cull.
- **VIS3 — artistic shadow, blended.** Shadow used ARTISTICALLY (Silent Hill
  model) — blended with the flood for depth/contrast, not flat-bright-everywhere
  and not pitch black. Tune directional shadow + contact/ambient-occlusion so
  the chunky PSX geometry has readable form. *Acceptance:* in-game shots show
  shape-defining shadow on walls/props without losing readability.
- **VIS4 — weapon hold transform.** User story: as a player I see my weapon held
  first-person, centered-bottom, aiming forward — not jammed in the corner. The
  viewmodel is currently bottom-RIGHT + angled off-screen. Re-anchor the
  viewmodel group to center-bottom, barrel forward, DOOM-style. *Acceptance:*
  in-game screenshot shows the weapon centered at screen bottom, pointing into
  the scene. *(Material emissive already lowered so metal reads under flood.)*
- **VIS5 — kill all placeholders + no procedural-where-a-model-exists.** Nothing
  should be procedural box-geometry where a PSX model exists (274 promoted GLBs +
  the NAS library). Audit every procedural primitive (ceiling planes, lava
  planes, any fallback box/color) and replace with PSX models or proper
  materials. *Acceptance:* no flat untextured primitive visible in-game; the
  no-stubs rule passes a fresh audit.

**HUD — dark/gritty/chrome framing**

- **HUD1 — frame the scene + show the RIGHT info.** User story: the HUD should
  FRAME the gritty scene and present tactical info in a dark/gritty/chrome look,
  not boxy buttons showing the wrong things. Redesign the HUD framing
  (vignette/border that reads as a helmet/console frame), dark chrome treatment.
  *Acceptance:* in-game screenshot reads as a cohesive framed HUD, not floating
  rounded panels.
- **HUD2 — own-only weapon display (DOOM model).** Show only weapons the player
  has actually picked up — NOT the always-5 boxy button row. Weapons enter the
  arsenal via in-world pickups/chests. *Acceptance:* a fresh run shows only
  blade+pistol; the bar grows as weapons are collected; no greyed always-present
  slots. *(User decision: own-only, no boxy bar.)*
- **HUD3 — weapon/loot pickups + chests in-world.** Not all weapons available
  from the start; they're found as world pickups + chests (DOOM model). Wire the
  pickup/chest spawn + collect → arsenal flow to feed HUD2. *Acceptance:* a
  weapon pickup model spawns in the maze, collecting it adds the weapon to the
  HUD + arsenal.

**STRUCT — fully procedural, BIOME generators, scaling**

Architecture (user-directed 2026-05-28): the 5 archetypes are **BIOMES**, not
replayable reference levels — each is a distinct *kind of place* (e.g. sewer,
cathedral, underwater, library, arena). The clean design is a **base procedural
maze generator at the lowest layer**, with **each biome as its OWN generator
built on top of it** (a `MazeGenerator` core + a per-biome generator that layers
that biome's structure, scatter, hazards, AND custom triggers/traps/code). This
beats a "pick a refLevel template" approach because each biome generator can own
bespoke logic (biome-specific traps, triggers, set-pieces, win/hazard rules).
The hand-authored refLevels remain only as STYLE/scale MODELS that inform each
biome generator's parameters — not playable levels.

This composes naturally with the family seed model (SEED1-5): the maze core +
each biome generator fork their OWN deterministic `forkStream(phrase, tag)`
streams, so a seed phrase fully reproduces the same maze in the same biome at
the same depth — fun, scalable (add a biome = add a generator module), and
seeding-native (no special-casing; every layer just forks a tagged stream).

**Extensibility is the headline win:** to add a new area, write a new biome
generator + wire in its assets — done. Suddenly there are 6 (or N) level types
and, because each is an infinite seeded procedural maze, a player can play for
HOURS regardless of how many biomes exist. The biome count is content breadth;
the procedural maze + seeding is the endless-replay depth. This is the target:
endless, varied, reproducible runs from a small set of well-built generators.

- **STRUCT1 — base maze generator + commit fully to procedural.** Extract a
  reusable `MazeGenerator` core (the lowest layer: carve a connected maze of
  rooms/corridors at a given size/seed). Remove the 1-5 fixed-level picker + the
  `LevelChoice = "procedural"|1..5` union; every run is procedural. Landing flow
  becomes NEW GAME → seed → BEGIN (no level pane). *Acceptance:* no level picker;
  every run generates via the maze core; `LevelChoice` union is gone.
- **STRUCT2 — one generator PER BIOME, built on the maze core, boss-capped.**
  Each of the 5 biomes is its own generator composing `MazeGenerator` + biome
  structure/scatter/hazards + **custom triggers/traps/code**, modeled on its
  refLevel's style/scale. Level N selects a biome + generates a maze in it,
  ending in a boss. *Acceptance:* each biome generator is a distinct module
  (e.g. `src/world/biomes/<biome>.ts`) over a shared maze core; consecutive
  levels visibly differ in biome + each ends with a boss gate; a biome can
  inject bespoke triggers/traps the others don't have.
- **STRUCT3 — logarithmic difficulty + fun scaling.** Difficulty (enemy count /
  tier / density / maze size) scales logarithmically with level depth so early
  levels are approachable and depth ramps without becoming impossible.
  *Acceptance:* a documented scaling curve + a unit test pinning
  monotonic-but-logarithmic growth.
- **STRUCT4 — log-scaled weapon UPGRADE progression (endless-play depth).** User
  story (user-directed 2026-05-28): as I play deeper I first unlock a base
  weapon, then FIND + unlock context-appropriate UPGRADES to it (fire rate,
  multi-shot, spread, damage, reload, etc.) that drop on a logarithmic cadence —
  so progression keeps feeling fresh for hours, not "got all 5 weapons, done."
  Upgrades are weapon-type-contextual (a chaingun upgrade ≠ a shotgun upgrade)
  and drop as seeded world pickups whose tier scales with depth. *Surfaces:*
  weapon spec → an upgrade-modifier stack; pickup/chest spawn (STRUCT2 biome
  hazards + HUD3); HUD shows the active upgrade tier per owned weapon.
  *Acceptance:* a unit-tested upgrade model where applying N upgrades to a weapon
  composes deterministically (seeded), the drop cadence is logarithmic in depth,
  and the HUD reflects acquired upgrades. Composes with the seed forks (same
  phrase → same upgrade drops).
- **STRUCT5 — weighted biome-selection pressure system (no rote cycling).** User
  story (user-directed 2026-05-28): the next biome should NEVER be a predictable
  1→2→3→4→5 cycle, but stale biomes should be favored. Track per-biome
  **pressure** in the save = how many levels since that biome was last played
  (pressure rises the longer unused, resets to 0 when chosen). On each
  exit/level-complete, rank biomes by pressure and pick the next with a weighted
  roll: **50% highest-pressure, 30% 2nd, 15% 3rd, 5% 4th** (the just-used /
  lowest-pressure biome is effectively never immediately repeated). The roll uses
  the EVENT PRNG (the buried per-run stream), so it's reproducible per run but
  unknowable to the player. *Surfaces:* a `biomePressure` map persisted in the
  save (Capacitor Preferences, alongside the event seed); a `pickNextBiome(pressure, eventRng)`
  pure fn; the level-transition flow (`useLevelTransition`) calls it + persists the
  updated pressures. *Acceptance:* a unit-tested `pickNextBiome` with the
  documented 50/30/15/5 weights over pressure rank; pressure rises for unused
  biomes + resets on selection; a run never rote-cycles. Composes with STRUCT2/3.

**ERR — failure surfacing (arcade-cabinet parity)**

- **ERR1 — asset-load error modal overlay.** User story: when an asset (GLB /
  wasm / font / texture) fails to load, surface it as an ERROR MODAL OVERLAY like
  the other ~/src/arcade-cabinet games — never a silent failure / blank render.
  Wire a React `<ErrorBoundary>` above the scene `<Suspense>` (review BP-6: the
  Suspense exists but no ErrorBoundary → GLB failures are uncaught) + an
  asset-load error channel → visible modal, using a discriminated-union error
  state (`{status:"error",reason}|{status:"ok"}`). ALSO (review CI-10): emit a
  `bonebuster:assetError` event `{url,type,phase}` so `verify-pages-deploy.mjs`
  can assert zero asset errors — turning the smoke test into a real
  asset-integrity gate (today a 404'd enemy GLB passes smoke at 60fps with a
  missing mesh). Error message rendering must be text-only (no
  dangerouslySetInnerHTML — review CI-8). *Acceptance:* forcing an asset 404
  shows the error modal (browser-tier test, route.abort), the game loop doesn't
  freeze, and verify-pages-deploy fails on a `bonebuster:assetError`.

**Sequencing:** VIS1/VIS2 done. The rest runs as an OVERHAUL2 lane in the
directive; ERR1 first (it surfaces problems the other work will hit), then
VIS4/VIS3/VIS5, HUD1-3, STRUCT1-3. Difficulty/HUD/level changes get reducer +
unit tests; visual changes get ANGLE-GL screenshot verification read by the agent.

## Parked — out of scope until a new lane up-prioritizes

These are good ideas with no acceptance gate yet.

- Ghost Hunting Tools — `pickSpiritBoxPhoneme` + UV flashlight +
  EMF reader + placeable crucifix all shipped (PC1–PC4). Open
  follow-ups: tape-recorder cue capture, walkie-talkie squelch
  audio, ghost-trail particle layer.
- Bespoke commissioned logo — current SVG re-letter with
  Bungee/Inline/Shade is good enough for ship.
- Mobile-perf CI gate — currently label-gated; promote to
  required-status when the Pixel 5a-class baseline stabilizes.

---

## Shipped history

Per-release shipped-milestone summaries live in
`docs/ROADMAP.md`. Per-decision rationale lives in
`docs/DECISIONS.md`. Per-commit audit trail lives in
`git log` + `.agent-state/decisions.ndjson`. This PRD only
carries the **remaining** work — items that ship are deleted
from here in the same commit that closes them.
