# Continuous Work Directive — objexoom

**Status:** ACTIVE
**Owner:** Claude
**Mandate:** "you are to treat NOTHING as pre-existing I WANT A FULLY POLISHED PLAYAABLE GAME PORTED FROM THE REFERENCE DOOM CLONE" — carried over from the original `objexiv/objexiv@feat/objexoom-easter-egg` directive.

**Branch strategy:** `feat/objexoom-game-buildout` is the single LONG-RUNNING branch until the game is FULLY done. No PR churn. All design tokens, all GLB wiring, all reference-clone parity, all polish ships through this one branch. (User directive 2026-05-13.)

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
- [ ] **B1.6** `pnpm test:e2e:screenshots` produces the 5 canonical PNGs (re-verify after polygonContains fix + token rollout).
- [ ] **B1.7** `pnpm assets:fbx-to-glb` regenerates GLBs from `references/` (locally — references/ is gitignored).

### B2 — Mobile + CI

- [ ] **B2.1** `cap add android` and verify `pnpm build:native` produces an APK.
- [x] **B2.2** `.github/workflows/ci.yml` runs lint + check + test + build on PRs.
- [x] **B2.3** `.github/workflows/release.yml` runs release-please on push to main.
- [ ] **B2.4** `.github/workflows/cd.yml` deploys `pnpm build:pages` to GitHub Pages on release tag.
- [x] **B2.5** `.github/dependabot.yml` weekly group non-major + major.

### B3 — Cut OBJEXOOM out of Objexiv

- [ ] **B3.1** In `objexiv/objexiv`, delete the OBJEXOOM easter-egg dir, public assets, references, scripts, tests, spec.
- [ ] **B3.2** Prune deps no longer needed (three, @react-three/*, postprocessing, tone, yuka, fbx2gltf, sharp).
- [ ] **B3.3** Open a PR titled "chore(objexoom): extract to standalone repo" referencing the new `objexiv/objexoom` repo.
- [ ] **B3.4** Merge once green.

### DS — Design system rollout (NEW)

- [x] **DS.1** Token sources: `src/design-tokens/{colors,typography,spacing,motion,index}.ts`.
- [x] **DS.2** CSS mirror: `app/tokens.css` with `--obx-*` custom properties.
- [x] **DS.3** Self-hosted horror-tactical fonts: Black Ops One (display) + Rajdhani (body), 12 woff2 files in `public/assets/fonts/`, declared in `app/fonts.css`.
- [x] **DS.4** Dependabot grouped non-major + major per ecosystem.
- [x] **DS.5** Wire tokens into `ObjexoomHUD` (replace hardcoded hex/rgba with `var(--obx-…)` or token imports).
- [x] **DS.6** Wire tokens into `ObjexoomShell` landing / mission-complete / game-over overlays.
- [ ] **DS.7** Wire tokens into scene materials where they cross the JS↔three boundary (lava, key glow, fire muzzle, key pickup tint).
- [x] **DS.8** Apply Black Ops One to all heading-class HUD elements (HP/AMMO numerics, MISSION COMPLETE/GAME OVER); Rajdhani to body labels (HP/AMMO labels, level select, difficulty descriptions).
- [ ] **DS.9** Re-shoot the 5 canonical screenshots with the new typography + tokens applied so `docs/assets/objexoom/` matches what ships.

### AO — Asset organization (NEW)

- [ ] **AO.1** Inventory current `public/` layout, document the convention in `public/README.md`.
- [ ] **AO.2** Move every existing GLB under `public/assets/models/{enemies,weapons,props}/` if not already there.
- [ ] **AO.3** Bundle horror enemy GLBs (sewerfiend, plague_doctor, elk_demon, abomination ×2, anomaly, horned, nun, alien, clown ×2) under `public/assets/models/enemies/horror/`.
- [ ] **AO.4** Bundle slasher weapon GLBs under `public/assets/models/weapons/slasher/`.
- [ ] **AO.5** Add PWA manifest + favicon set (apple-touch-icon, 192/512 maskable, theme-color from `--obx-bg-void`).
- [ ] **AO.6** Verify `index.html` head references the manifest + favicons.

### PARITY — carried over from the Objexiv directive

(Closes once each item is shipped + verified visually against `reference-codebases/js13k2019-yet-another-doom-clone/`.)

- [ ] **PA-MOD2** Visually verify all 5 screenshot poses render cleanly post-extraction.
- [ ] **PA1** ManyEnemies spawner — verify already wired in `src/refLevel.ts` survives extraction.
- [ ] **PA9** Shell ejection on shotgun fire.
- [ ] **PA10** Weapon recoil offset on viewmodel.
- [ ] **PA-MOD7** Wire `gltfjsx` to auto-generate typed React components per GLB (so muzzle bones become addressable).
- [ ] **PA11** Body-part physics: gravity arc + spin on death.
- [ ] **PA16** Adaptive resolution via `gl.setPixelRatio` on low FPS.
- [ ] **PA-FULL** End-to-end deep dive against the reference clone — log every mechanic the reference has and OBJEXOOM doesn't, then close the gap one commit at a time on this branch.
