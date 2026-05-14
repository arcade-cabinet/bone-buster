---
title: Deployment
updated: 2026-05-13
status: current
domain: ops
---

# OBJEXOOM — deployment

## Targets

OBJEXOOM ships to three surfaces from the same Vite codebase:

| Target | How | Status |
| --- | --- | --- |
| Web (GitHub Pages) | `pnpm build:pages` → `dist/` → `cd.yml` workflow | wired, not yet release-gated |
| Android | `pnpm build:native` → `cap sync` → Android Studio | wired locally, CI APK pending |
| iOS | `pnpm build:native` → `cap sync` → Xcode | scaffolded, untested on real device |

## Web — GitHub Pages

```bash
pnpm build:pages    # writes dist/ with base=/objexoom/
```

The build sets Vite's `base: "/objexoom/"` so every asset URL resolves
under the org-pages prefix. Source URLs in `models.ts` flow through
`A()` which prefixes `import.meta.env.BASE_URL` — both base modes
work identically downstream.

`.github/workflows/cd.yml` runs on every push to `main`, builds with
the pages target, and uploads the artifact via
`actions/upload-pages-artifact@v3`. The deploy step uses
`actions/deploy-pages@v4`.

## Android — Capacitor

Initial setup (one-time per dev machine):

```bash
pnpm install
pnpm exec cap add android   # creates android/ in repo (gitignored)
```

Build cycle:

```bash
pnpm build:native           # vite build + cap sync
pnpm exec cap open android  # launches Android Studio
```

In Android Studio, Build → Generate Signed Bundle / APK.

CI APK build is wired into `.github/workflows/ci.yml` per the
[mobile-android profile](../CLAUDE.md) — every PR uploads
`app-debug.apk` as a build artifact for manual install testing.

## iOS — Capacitor

```bash
pnpm exec cap add ios       # creates ios/ in repo (gitignored)
pnpm build:native
pnpm exec cap open ios      # launches Xcode
```

Untested on real device. Track via [ROADMAP](./ROADMAP.md) → mobile +
CI section.

## Secrets

None at the moment. OBJEXOOM is single-player web-app + native shell;
there are no API keys, no backend, no analytics yet. When that
changes, this section gets updated and the secrets-handling decision
lands in [DECISIONS](./DECISIONS.md).

## Domains

- **Web**: served at `https://objexiv.github.io/objexoom/` (org Pages
  subdir, set by `base: "/objexoom/"`).
- **Mobile**: no public listing yet — internal-track APK only.

## Local dev parity

| Concern | Local | CI | Production |
| --- | --- | --- | --- |
| Node version | per `package.json#engines` (currently 20+) | actions/setup-node @v4 with same | Pages build env tracks Node 20 |
| pnpm version | locked via `packageManager` field | actions/setup-pnpm same | same |
| Vite base | `/` (dev) or `/` (regular build) | `/` for CI artifacts | `/objexoom/` for Pages |
| Asset URLs | resolve via `A()` helper | same | same |

## Rollback

The deploy artifact is keyed by commit SHA. `cd.yml` re-runs against
any previous SHA produce a clean rollback. There is no DB to migrate.
Capacitor app rollback is a Play Store / App Store flow — version
management via release-please tags and the Capacitor `versionCode`
auto-increments off the package version.
