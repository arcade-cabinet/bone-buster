# Continuous Work Directive — objexoom

**Status:** ACTIVE
**Owner:** Claude
**Mandate:** "you are to treat NOTHING as pre-existing I WANT A FULLY POLISHED PLAYAABLE GAME PORTED FROM THE REFERENCE DOOM CLONE" — carried over from the original `objexiv/objexiv@feat/objexoom-easter-egg` directive.

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
- [ ] **B0.1** First commit on `main` capturing the extracted source + scaffolding.
- [ ] **B0.2** Create `objexiv/objexoom` GitHub repo (internal visibility).
- [ ] **B0.3** Push `main` to origin.

### B1 — Verify it actually runs
- [ ] **B1.1** `pnpm install` succeeds.
- [ ] **B1.2** `pnpm check` (tsc no-emit) green.
- [ ] **B1.3** `pnpm lint` (biome) green.
- [ ] **B1.4** `pnpm dev` boots Vite, root page mounts `<ObjexoomShell />` cleanly (no SSR / Next imports anywhere).
- [ ] **B1.5** `pnpm test` (vitest unit) green for all 13 OBJEXOOM unit suites.
- [ ] **B1.6** `pnpm test:e2e:screenshots` produces the 5 canonical PNGs.
- [ ] **B1.7** `pnpm assets:fbx-to-glb` regenerates GLBs from `references/` (locally — references/ is gitignored).

### B2 — Mobile + CI
- [ ] **B2.1** `cap add android` and verify `pnpm build:native` produces an APK.
- [ ] **B2.2** `.github/workflows/ci.yml` runs lint + check + test + build on PRs.
- [ ] **B2.3** `.github/workflows/release.yml` runs release-please on push to main.
- [ ] **B2.4** `.github/workflows/cd.yml` deploys `pnpm build:pages` to GitHub Pages on release tag.
- [ ] **B2.5** `.github/dependabot.yml` weekly group minor/patch.

### B3 — Cut OBJEXOOM out of Objexiv
- [ ] **B3.1** In `objexiv/objexiv` on `feat/objexoom-easter-egg`, delete `src/client/easter-eggs/objexoom/`, `public/objexoom/`, `references/`, `scripts/objexoom-*`, all `objexoom-*` tests, the easter-egg spec.
- [ ] **B3.2** Prune deps no longer needed (three, @react-three/*, postprocessing, tone, yuka, fbx2gltf, sharp).
- [ ] **B3.3** Open a PR titled "chore(objexoom): extract to standalone repo" referencing the new `objexiv/objexoom` repo.
- [ ] **B3.4** Merge once green.

### PARITY — carried over from the Objexiv directive
(Closes once each item is shipped + verified visually.)
- [ ] **PA-MOD2** Visually verify all 5 screenshot poses render cleanly post-extraction.
- [ ] **PA1** ManyEnemies spawner — verify already wired in `src/refLevel.ts` survives extraction.
- [ ] **PA9** Shell ejection on shotgun fire.
- [ ] **PA10** Weapon recoil offset on viewmodel.
- [ ] **PA-MOD7** Wire `gltfjsx` to auto-generate typed React components per GLB (so muzzle bones become addressable).
- [ ] **PA11** Body-part physics: gravity arc + spin on death.
- [ ] **PA16** Adaptive resolution via `gl.setPixelRatio` on low FPS.
