<!-- profile: arcade-game+nas-assets+mobile-android+standard-repo v1 -->
# bone-buster

**Bone Buster** — a procedural arcade FPS in the PSX-jank tradition. They had it coming.

## START HERE (any new agent, every session)

Read these in order, then pick the next item without asking:

1. This file (you're here).
2. [`.agent-state/directive.md`](.agent-state/directive.md) — the active overhaul backlog. ONE long-running branch holds every commit until the backlog drains. Pick the topmost unchecked item; lane order is `ITCH-FETCH → REBRAND → IDENTITY → ARCHETYPE INTERLEAVE → AUDIO → RESTRUCTURE → MIGRATE`.
3. [`docs/REBRAND.md`](docs/REBRAND.md) — locked Bone Buster identity (name, tagline, fonts, palette, 24-kind enemy roster).
4. [`docs/DESIGN.md`](docs/DESIGN.md) — product truth.
5. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system truth.
6. `git status && git log --oneline -10`.

**Single source of truth chain when docs disagree:**
DESIGN > ARCHITECTURE > DECISIONS > REBRAND > directive.

**Operating mandate (user verbatim, persistent):**
- "I want a FULLY POLISHED PLAYABLE GAME"
- "I want as much possible value from ALL the PSX assets — anything that makes sense in a level"
- "ZERO ambiguity, ZERO deferments, ZERO chance the next agent doesn't understand what to do"

**Forbidden output phrases** (also enforced by directive §"Forbidden phrases"):
deferred, v2+, out of scope, future work, tracked separately, follow-up, TODO, FIXME, stub, placeholder, mock for now, pause point, fresh session, next session, stopping point, clean handoff.

**Run loop (no exceptions):**

```text
while directive has [ ] items in priority order:
    pick the topmost
    read its acceptance criterion in the directive
    implement → pnpm verify → commit → dispatch reviewer trio LOCALLY → fold findings into next commit → flip [ ]→[x] in same/next commit
done
# Push + open PR only when a coherent slice is fully done (lane-sized).
# The only legitimate stops: user halt | red CI on main | a true external blocker.
```

**Workflow rules (user-directed):**

- ONE long-running feature branch holds every commit. No per-item branches.
- Reviewer trio (`comprehensive-review:full-review`, `feature-dev:code-reviewer`, `security-scanning:security-sast`, `code-simplifier`) runs LOCALLY on each commit. Fold findings forward. Never amend reviewed commits.
- NO `Phase N` numbering. The directive's overhaul backlog is a single un-phased queue.
- Local repo stays at `~/src/objexiv/objexoom` regardless of remote rename. GitHub redirects handle the URL change.
- Asset source = `references/` (already on disk) + itch.io API (user owns 316 keys; fetch via the voxel-realms-derived `scripts/fetch-itch.mjs`). NOT the NAS.

## Profiles loaded

@/Users/jbogaty/.claude/profiles/arcade-game.md
@/Users/jbogaty/.claude/profiles/nas-assets.md
@/Users/jbogaty/.claude/profiles/mobile-android.md
@/Users/jbogaty/.claude/profiles/standard-repo.md

## Repo-specific

- **Run:** `pnpm dev` (Vite at <http://localhost:5191> — pinned via `strictPort`)
- **Test:** `pnpm test` (vitest unit, ~700 passing) + `pnpm test:browser` (real Chromium, 6) + `pnpm test:e2e:screenshots` (5 canonical poses) + `pnpm test:e2e:archetype-screenshots` (5 per-archetype poses)
- **Verify:** `pnpm verify` runs lint + check + test + test:browser + assets:verify-runtime (merge gate)
- **Build:** `pnpm build` (web), `pnpm build:native` (web + cap sync), `pnpm build:pages` (GH Pages base path)
- **Deploy:** GitHub Pages via `.github/workflows/release.yml` on release-please tag
- **Mobile perf:** `pnpm test:perf:mobile` against a Pixel 5a-class emulator; CI-gated behind the `mobile-perf` label

## Notes

- URL flags: `?debug` exposes `window.__bonebuster` for e2e + dev hooks; `?seed=N` pins the run seed; `?archetype=<name>` forces the seed to land on a chosen archetype (`corridor` / `arena` / `courtyard` / `sewer` / `library`). Stacks: seed read first, archetype override applied on top via `applyArchetypeOverride`.
- Screenshot tests (`tests/e2e/screenshots.spec.ts`) use a custom `chromium.launch({ args: [...] })` path with `--use-angle=gl` and CDP `Page.captureScreenshot`. Default headless SwiftShader deadlocks on the shadow-map composite — never revert this fix.
- Source asset pipeline: FBX/zips under `references/` (gitignored, local-only) get converted to GLBs under `public/assets/models/{enemies,weapons,props}/` via `pnpm assets:fbx-to-glb`. The GLBs ARE tracked. Every asset URL routes through the `A()` helper so the BASE_URL prefix resolves correctly in dev, gh-pages, and Capacitor file:// origins.
- itch.io asset pipeline: `pnpm itch:fetch` downloads allow-listed packs to `raw-assets/archives/`, extracts to `raw-assets/extracted/`, then the fbx-to-glb pass converts into `references/_extracted/`. Production assets are hand-promoted into `public/assets/models/` per-archetype.
- WASM artifacts (currently `sql-wasm.wasm`) sync into `public/assets/wasm/` via `scripts/prepare-web-wasm.mjs` at postinstall + prebuild. wasm dir gitignored; source of truth is the npm package.
- Deterministic PRNG: every procedural system uses the canonical `mulberry32(seed)` from `src/prng.ts` with per-system XOR tags (LMP/PROP/FLRT/DEBR/decal-FNV/LARP/TRAP/KTCH/NATU/NPCS/ENMX) so sequences diverge cleanly. Canonical byte-stability: refLevel 0 = corridor by `seed%5` invariant — every per-archetype table's corridor entry preserves the pre-step literal so canonical screenshots stay stable forever.
- Per-archetype scatter inventory: COV8 traps (all 5 archetypes, density-biased), COV13 kitchen (library only, 20% sector opt-in), COV11 nature (courtyard only, 4-8/sector), COV14 NPCs (library only, 0-2/sector, no AI). COV12 loot is one-per-map at the farthest-sector centroid (any archetype).
- POL1 score: real `score: number` field on GameState (HUD shows `SCORE N` next to KILLS when score > 0). COV12 treasure-loot grants +50; bottles grants +5 HP; books grants +pickupAmmo on chaingun+shotgun.
