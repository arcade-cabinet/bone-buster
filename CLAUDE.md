<!-- profile: arcade-game+nas-assets+mobile-android+standard-repo v1 -->
# objexoom

OBJEXOOM — a polished DOOM-flavored arcade FPS. Procedural sectors, real PSX monsters, and a flashlight you absolutely need.

## Profiles loaded

@/Users/jbogaty/.claude/profiles/arcade-game.md
@/Users/jbogaty/.claude/profiles/nas-assets.md
@/Users/jbogaty/.claude/profiles/mobile-android.md
@/Users/jbogaty/.claude/profiles/standard-repo.md

## Repo-specific

- **Run:** `pnpm dev` (Vite at http://localhost:5173)
- **Test:** `pnpm test` (vitest unit) + `pnpm test:e2e` (Playwright)
- **Build:** `pnpm build` (web), `pnpm build:native` (web + cap sync), `pnpm build:pages` (GH Pages base path)
- **Deploy:** GitHub Pages via `.github/workflows/cd.yml` on release-please tag.

## Notes

- Extracted from `objexiv/objexiv@feat/objexoom-easter-egg` on 2026-05-13. The full per-commit history of the original work lives on that branch in the Objexiv repo; this repo starts with a clean initial commit.
- The easter-egg gate (`?objexoom` Objexiv query-string + `LazyObjexoom` wrapper + `next/navigation` integration) was dropped in extraction. The standalone Vite app mounts `<ObjexoomShell />` directly via `app/main.tsx`.
- `?objexoomDebug` STILL gates the `window.__objexoom` debug hooks contract used by all e2e tests. Pointer-lock + canvas input is hostile to Playwright otherwise — extend the hook contract instead of bypassing it.
- Screenshot tests (`tests/e2e/screenshots.spec.ts`) use a custom `chromium.launch({ args: [...] })` path with `--use-angle=gl` and CDP `Page.captureScreenshot`. Default headless SwiftShader deadlocks on the shadow-map composite — never revert this fix.
- Source asset pipeline: FBX/zips under `references/` (gitignored, local-only) get converted to GLBs under `public/models/` via `pnpm assets:fbx-to-glb`. The GLBs ARE tracked.
