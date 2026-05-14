<!-- profile: arcade-game+nas-assets+mobile-android+standard-repo v1 -->
# objexoom

OBJEXOOM — a polished DOOM-flavored arcade FPS. Procedural sectors, real PSX monsters, and a flashlight you absolutely need.

## START HERE (any new agent, every session)

Read these in order, then pick the next item without asking:

1. This file (you're here).
2. [`.agent-state/directive.md`](.agent-state/directive.md) — the queue. Every `[ ]` line has a one-line acceptance criterion. **Pick the topmost unchecked item in this lane order: PARITY → ELEVATION Phase 2 → ELEVATION Phase 3 → ELEVATION Phase 4 → COV* → INFRA → standalone-hardening (B*, AO*, DS*).**
3. [`docs/PRD.md`](docs/PRD.md) — long-form spec per item (user story + acceptance + assets + deps).
4. [`docs/PARITY.md`](docs/PARITY.md) — reference-clone parity (100% reached). Don't regress.
5. [`docs/ELEVATION.md`](docs/ELEVATION.md) — historical catalogue of E1-E13.
6. `git status && git log --oneline -10`.

**Single source of truth chain when docs disagree:**
DESIGN > ARCHITECTURE > DECISIONS > PRD > directive > ROADMAP.

**Operating mandate (user verbatim, persistent):**
- "I want a FULLY POLISHED PLAYABLE GAME PORTED FROM THE REFERENCE DOOM CLONE"
- "I want as much possible value from ALL the PSX assets — anything that makes sense in a level"
- "ZERO ambiguity, ZERO deferments, ZERO chance the next agent doesn't understand what to do"

**Forbidden output phrases** (also enforced by directive §"Forbidden phrases"):
deferred, v2+, out of scope, future work, tracked separately, follow-up, TODO, FIXME, stub, placeholder, mock for now, pause point, fresh session, next session, stopping point, clean handoff.

**Run loop (no exceptions):**
```
while directive has [ ] items in priority order:
    pick the topmost
    read its acceptance criterion in the directive (and PRD if it links there)
    implement → pnpm verify → commit → push → flip [ ]→[x] in same/next commit
done
# the only legitimate stops: user halt | red CI on main blocking | NAS unmounted blocking a COV item (skip to next non-blocked item)
```

If `/Volumes/home/assets/3DPSX/` is detached, the COV* items are blocked but everything else is local-only. Skip COV* and pick the next non-blocked item.

## Profiles loaded

@/Users/jbogaty/.claude/profiles/arcade-game.md
@/Users/jbogaty/.claude/profiles/nas-assets.md
@/Users/jbogaty/.claude/profiles/mobile-android.md
@/Users/jbogaty/.claude/profiles/standard-repo.md

## Repo-specific

- **Run:** `pnpm dev` (Vite at http://localhost:5191 — pinned via `strictPort`)
- **Test:** `pnpm test` (vitest unit, 177 passing across 13 suites) + `pnpm test:browser` (real-Chromium browser-mode, 5 passing across 2 suites) + `pnpm test:e2e` (Playwright)
- **Verify:** `pnpm verify` runs lint + check + test + test:browser + assets:verify-runtime (the merge gate).
- **Build:** `pnpm build` (web), `pnpm build:native` (web + cap sync), `pnpm build:pages` (GH Pages base path)
- **Deploy:** GitHub Pages via `.github/workflows/cd.yml` on release-please tag (B2.4, not yet wired — see [`docs/PRD.md` § B2.4](docs/PRD.md#b24--github-pages-cd-on-release-tag)).

## Notes

- Extracted from `objexiv/objexiv@feat/objexoom-easter-egg` on 2026-05-13. The full per-commit history of the original work lives on that branch in the Objexiv repo; this repo starts with a clean initial commit.
- The easter-egg gate (`?objexoom` Objexiv query-string + `LazyObjexoom` wrapper + `next/navigation` integration) was dropped in extraction. The standalone Vite app mounts `<ObjexoomShell />` directly via `app/main.tsx`.
- `?objexoomDebug` STILL gates the `window.__objexoom` debug hooks contract used by all e2e tests. Pointer-lock + canvas input is hostile to Playwright otherwise — extend the hook contract instead of bypassing it.
- Screenshot tests (`tests/e2e/screenshots.spec.ts`) use a custom `chromium.launch({ args: [...] })` path with `--use-angle=gl` and CDP `Page.captureScreenshot`. Default headless SwiftShader deadlocks on the shadow-map composite — never revert this fix.
- Source asset pipeline: FBX/zips under `references/` (gitignored, local-only) get converted to GLBs under `public/assets/models/{enemies,weapons,props}/` via `pnpm assets:fbx-to-glb`. The GLBs ARE tracked. Every asset URL routes through the `A()` helper in `src/assetUrl.ts` so the BASE_URL prefix resolves correctly in dev, gh-pages, and Capacitor file:// origins.
- WASM artifacts (currently just `sql-wasm.wasm` for E9 run-history persistence) sync into `public/assets/wasm/` via `scripts/prepare-web-wasm.mjs` at postinstall + prebuild. The wasm dir is gitignored — source of truth is the npm package.
- 100% reference-parity reached (E12 closed PA16 in 57dd8fa). All remaining work is **elevation** per [`docs/PRD.md`](docs/PRD.md).
