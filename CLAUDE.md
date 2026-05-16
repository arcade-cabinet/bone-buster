<!-- profile: arcade-game+nas-assets+mobile-android+standard-repo v1 -->
# bone-buster

**Bone Buster** — a procedural arcade FPS in the PSX-jank tradition. They had it coming.

## START HERE (any new agent, every session)

Reading order:

1. This file — entry pointer only.
2. [`docs/PRD.md`](docs/PRD.md) — authoritative remaining-work spec (user stories, surfaces, acceptance bars per item).
3. [`.agent-state/directive.md`](.agent-state/directive.md) — lean queue; one line per `[ ]` item pointing back at its PRD section.
4. [`STANDARDS.md`](STANDARDS.md) — quality bar (modernized polished DOOM), slot architecture, no-end-of-turn, design tokens, audio, testing, mobile, git hygiene.
5. [`docs/DECISIONS.md`](docs/DECISIONS.md) — binding technical decisions.
6. [`docs/REBRAND.md`](docs/REBRAND.md) — locked Bone Buster identity.
7. `git status && git log --oneline -10`.

**Authority chain when docs disagree:**
DESIGN > ARCHITECTURE > DECISIONS > PRD > directive > ROADMAP.

**Operating loop:** drain the directive top-down — each item points at its PRD section for the acceptance bar. Single long-running overhaul branch holds every commit; reviewer trio runs locally per commit; fold findings forward; push + open one PR per coherent slice. Full operational rules live in `STANDARDS.md` and the global `~/.claude/CLAUDE.md`. Local repo stays at `~/src/objexiv/objexoom` regardless of remote rename — GitHub's git-protocol redirect handles the URL change.

**Asset sources:** `references/` (already on disk) + itch.io API (user owns 316 keys; fetch via `scripts/fetch-itch.mjs`). NAS is not consulted for the active overhaul.

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
- Deterministic PRNG: every procedural system uses the canonical `mulberry32(seed)` from `src/engine/prng.ts` with per-system XOR tags (LMP/PROP/FLRT/DEBR/decal-FNV/LARP/TRAP/KTCH/NATU/NPCS/ENMX) so sequences diverge cleanly. Canonical byte-stability: refLevel 0 = corridor by `seed%5` invariant — every per-archetype table's corridor entry preserves the pre-step literal so canonical screenshots stay stable forever.
- Per-archetype scatter inventory: COV8 traps (all 5 archetypes, density-biased), COV13 kitchen (library only, 20% sector opt-in), COV11 nature (courtyard only, 4-8/sector), COV14 NPCs (library only, 0-2/sector, no AI). COV12 loot is one-per-map at the farthest-sector centroid (any archetype).
- POL1 score: real `score: number` field on GameState (HUD shows `SCORE N` next to KILLS when score > 0). COV12 treasure-loot grants +50; bottles grants +5 HP; books grants +pickupAmmo on chaingun+shotgun.
