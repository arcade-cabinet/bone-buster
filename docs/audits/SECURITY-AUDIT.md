---
title: Security Audit
updated: 2026-05-15
status: current
domain: quality
---

# OBJEXOOM Security Audit

Auditor: security review pass (Opus 4.7).
Scope: web (Vite + Three.js), Android Capacitor wrapper, GitHub Actions CI/CD, dependency surface, client-side data handling.
Threat model: single-player offline FPS. No server, no auth, no PII, no payments. Game state fully client-owned.

## Executive summary

**Posture: STRONG.** No critical or high-severity findings. The codebase shows above-average hygiene for a TypeScript browser game shipped via Capacitor: zero direct `innerHTML` / `eval` / `Function` constructor usage in app code, zero outbound `fetch` / `XHR` / `WebSocket` (game is fully offline), strict typed-input validation on query-string flags, a working production gate on the e2e debug-hook surface, and a clean `pnpm audit --prod` (0 known advisories across 106 production dependencies). GitHub Actions are pinned to current major tags with minimum-necessary permissions and no `pull_request_target` foot-guns.

Two MEDIUM findings worth fixing this week (Android debug-build hardening and sourcemap public exposure). The remainder are LOW / INFO — defense-in-depth and forward-looking notes.

| # | Severity | Finding |
|---|----------|---------|
| 1 | MEDIUM | GitHub Pages serves full sourcemaps (~10MB) with absolute pnpm `node_modules/.pnpm/...` paths |
| 2 | MEDIUM | Android debug build defaults to `android:debuggable="true"` and `android:allowBackup="true"`; no `usesCleartextTraffic="false"` lock |
| 3 | LOW | No Content-Security-Policy meta tag in `index.html` / `dist/index.html` |
| 4 | LOW | No `network_security_config.xml` to forbid cleartext / pin certs on Android |
| 5 | LOW | Capacitor SQLite explicitly opens with `"no-encryption"` for run-history DB |
| 6 | LOW | `__objexoomJeepSqliteReady` global is attached unconditionally in prod web builds |
| 7 | INFO | iOS Capacitor scaffold not yet present (`ios/` empty) — when added, Info.plist needs review |
| 8 | INFO | `release-please-action@v5` and other actions pinned by major tag, not SHA |
| 9 | INFO | Build is unminified for `release: { minifyEnabled false }` in Android |
| 10 | INFO | No SRI on the single `<script type="module">` tag (Vite limitation) |

---

## Finding 1 — Sourcemap exposure on GitHub Pages
**Severity: MEDIUM** (information disclosure, not exploit-grade)

`vite.config.ts:13` sets `build: { sourcemap: true }`. The release.yml `build-pages` job uploads the entire `dist/` directory (including `.map` files) to GitHub Pages via `actions/upload-pages-artifact@v3` (release.yml line referencing `path: dist`).

Result: `dist/assets/index-Ce7km5p2.js.map` (9.4 MB) is publicly served and embeds the pnpm content-addressable `node_modules/.pnpm/<pkg>@<ver>_<deps>/...` paths of every module — i.e. an exact dependency-version SBOM is leaked, plus the full reconstructable TypeScript source.

Evidence:
- `vite.config.ts:13` — `sourcemap: true`
- `dist/assets/index-Ce7km5p2.js:1` — `sourceMappingURL=index-Ce7km5p2.js.map`
- `dist/assets/index-Ce7km5p2.js.map` includes references like `node_modules/.pnpm/framer-motion@12.38.0_react-dom@19.2.6_react@19.2.6__react@19.2.6/...` and `tone@15.1.22/...` — exact transitive versions exposed.
- `.github/workflows/release.yml` `build-pages` step uploads `path: dist` unconditionally.

Real-world risk:
- Repo is already public open-source (homepage: `github.com/objexiv/objexoom`, license `UNLICENSED` in package.json but source is on GitHub), so the source itself is not the leak. The leak is **dependency-version fingerprinting for future 0-days** — an attacker scanning Pages sites can match `framer-motion@12.38.0` against the next CVE and know this site is vulnerable before npm-audit catches up.
- 10 MB per page-load of `.map` files is also a bandwidth cost on slow connections; browsers only fetch them when DevTools is open, so it's not a perf issue.

Recommendation: drop sourcemaps from the gh-pages artifact. Either:
```ts
// vite.config.ts
build: {
  target: "es2022",
  sourcemap: mode === "github-pages" ? false : "hidden",
},
```
or strip `*.map` from `dist/` in `release.yml` before `upload-pages-artifact`:
```yaml
- run: find dist -name '*.map' -delete
```
Native (Capacitor) builds can keep sourcemaps — they're packaged inside the APK and not externally fetchable.

---

## Finding 2 — Android debug-build attack surface
**Severity: MEDIUM** (device-local; only matters if attacker has ADB or a malicious app on the device)

`android/app/src/main/AndroidManifest.xml` does not set `android:debuggable`, but the merged manifest in `android/app/build/intermediates/.../AndroidManifest.xml` shows `android:debuggable="true"` (debug variant). This is normal for a debug APK, but the build pipeline only ever publishes the **debug APK** as a CI artifact (`.github/workflows/ci.yml` android job `path: android/app/build/outputs/apk/debug/*.apk`).

`android:allowBackup="true"` is the manifest default and means `adb backup` can extract the app sandbox (including the Capacitor SQLite run-history DB) without root.

Evidence:
- `android/app/src/main/AndroidManifest.xml:5` — `android:allowBackup="true"` (defaulted by Capacitor scaffold)
- `android/app/build.gradle:21` — `release { minifyEnabled false }` (no R8/Proguard)
- `.github/workflows/ci.yml` — only publishes `android/app/build/outputs/apk/debug/*.apk`; no release/signed artifact path.

Real-world risk:
- Single-player game with no PII. The "sensitive" data is run history (scores, secrets-found counts) — already documented as non-sensitive (`capacitor.config.ts:13` `iosIsEncryption: false` with the explicit reasoning that run-history is not sensitive).
- The actual risk is a malicious app on the same device using a debug-tagged APK as a privilege-escalation chain, or `adb backup` exfiltrating the IndexedDB blob. For a single-player game distributed via app stores, the production-signed APK (when added) would not be debuggable. The risk window is "the only publicly available APK is the debug build."

Recommendation:
- Add a release-signed APK build to `release.yml` once a Play Store / sideload distribution channel is decided; until then, document in README that the CI artifact is debug-only and not for end-user installation.
- Add to `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <application
      android:allowBackup="false"
      android:fullBackupContent="false"
      android:dataExtractionRules="@xml/data_extraction_rules"
      ...>
  ```
- Enable R8 + Proguard on the release variant (`minifyEnabled true`, `shrinkResources true`). This is also a perf win.

---

## Finding 3 — Missing Content-Security-Policy
**Severity: LOW** (defense-in-depth; no current injection vector)

Neither `index.html` nor `dist/index.html` defines a `Content-Security-Policy` meta tag. Three.js + R3F can be made to work with a `'wasm-unsafe-eval'`-only CSP (no `'unsafe-eval'`, no `'unsafe-inline'`) because Vite preloads all scripts via `<script type="module" crossorigin>`. Tone.js uses AudioWorklets which need `'wasm-unsafe-eval'`. The jeep-sqlite custom element loads sql-wasm at runtime — same.

Evidence:
- `index.html:1-22` — no CSP meta tag.
- `dist/index.html` — same.
- `grep -rn 'innerHTML|eval(|new Function|dangerouslySetInnerHTML' src/ app/` returned **zero hits** — so the current attack surface for XSS is genuinely empty, but a CSP would lock that in against future regressions.

Why this is LOW not MEDIUM: no current sink for an injection payload. Query-string flags (`?objexoomSeed`, `?objexoomArchetype`) flow through validators (`^[0-9]+$` for seed at `app/views/Shell.tsx:178`, an indexOf-against-allowlist for archetype at `app/views/Shell.tsx:208`) and end up as numeric / enum values that drive procedural generation — no DOM injection path.

Recommendation: add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  worker-src 'self' blob:;
  connect-src 'self';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
">
```
Verify Tone.js / postprocessing / R3F still load (they should — none use `eval`). The `connect-src 'self'` is honest given there are zero outbound fetches in the codebase.

For Capacitor builds, CSP needs `capacitor:` and `ionic:` scheme allowances — see Capacitor docs.

---

## Finding 4 — No Android `network_security_config.xml`
**Severity: LOW**

`grep -rn 'cleartextTraffic|networkSecurityConfig' android/app/src/` returns no hits. Android's default since SDK 28 is cleartext-disabled-by-default, and the merged manifest shows `targetSdkVersion="36"` so the default applies — but explicit is better than implicit.

Recommendation: add `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```
And reference it in the manifest: `android:networkSecurityConfig="@xml/network_security_config"`.

Effectively zero-impact since the game is offline, but it's a one-line hardening and makes intent explicit.

---

## Finding 5 — Run-history SQLite uses `"no-encryption"`
**Severity: LOW** (intentional, documented; flagged for completeness)

`src/platform/persistence/database.ts` `CapacitorDatabase.open()` calls `createConnection(this.#dbName, false, "no-encryption", 1, false)`.

`capacitor.config.ts:13-17` explicitly disables iOS/Android SQLite encryption with the rationale "run history is not sensitive data and encryption would add a passphrase-management surface we don't need for a single-player game."

This is the right call. Documenting because: if scope ever expands (player accounts, server-synced scores, cross-device save), revisit. For the current single-player threat model this is correct.

---

## Finding 6 — `__objexoomJeepSqliteReady` global on prod
**Severity: LOW** (information disclosure, no exploit value)

`src/platform/persistence/initJeepSqlite.ts:31, 49, 77, 81, 95` sets `window.__objexoomJeepSqliteReady = boolean` unconditionally on every web build (not gated by `?objexoomDebug`). The `window.__objexoom` debug-hook surface IS correctly gated — confirmed by reading the minified bundle:

```
dist/assets/index-Ce7km5p2.js:  function v6(){return!1}   // the compiled debugHooksEnabled()
```

i.e. Vite tree-shook `process.env.NODE_ENV === "production"` → `true` → `return false` → the entire `window.__objexoom = {...}` block is dead code in prod. **Good — the e2e debug gate works.**

But `__objexoomJeepSqliteReady` is a plain boolean and reveals to any page-running JS (extensions, paste-into-console attacker) whether the SQLite shim initialized. Not exploitable, but namespace pollution.

Recommendation: low priority. If you want it clean, move it to a closure-scoped module variable and expose `isJeepSqliteReady()` from the module instead of touching `window`.

---

## Finding 7 — iOS scaffold not present
**Severity: INFO**

`ls ios/` returns nothing (no `ios/` directory in repo). `capacitor.config.ts` declares iOS plugin config but `cap add ios` has not been run. When iOS is added:
- Check `Info.plist` for `NSAppTransportSecurity` (forbid arbitrary loads).
- Check `Info.plist` for `LSApplicationQueriesSchemes` (don't add any unless needed).
- iOS Capacitor SQLite path is `Library/CapacitorDatabase` — not iCloud-backed by default (correct for a non-sensitive local-only DB).

No action needed today; revisit when iOS lands.

---

## Finding 8 — GitHub Actions pinned by major tag, not SHA
**Severity: INFO** (industry norm; trade-off favors maintainability)

`release.yml` and `ci.yml` use `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v6`, `actions/setup-java@v5`, `android-actions/setup-android@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, `googleapis/release-please-action@v5`, `actions/upload-artifact@v7`.

All are major-tag pins (mutable). SHA-pinning would prevent a supply-chain attack where an action's maintainer's account is compromised and a malicious commit is pushed to the v5 tag. Trade-off: SHA pins require manual updates and dependabot has to be configured to bump them.

This repo's dependabot config (`.github/dependabot.yml`) already covers `github-actions`. Major-tag pinning is fine for a hobby-scale repo. Flag for awareness only.

Recommendation (optional, if paranoia warranted): switch to SHA pins, e.g.
```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v6.x.x
```
Dependabot supports updating SHA pins with comments.

---

## Finding 9 — Android release variant has `minifyEnabled false`
**Severity: INFO** (deployment-readiness, not security per se)

`android/app/build.gradle:21` — `release { minifyEnabled false }`. Without R8/Proguard, release APKs are reverse-engineerable without effort. For a game with no server-side authority, IP protection is the only concern (cheating is moot — no leaderboard). Capacitor scaffold default; flag for when a real release build is wired.

---

## Finding 10 — No SRI on script tag
**Severity: INFO**

`dist/index.html:18` — `<script type="module" crossorigin src="/assets/index-Ce7km5p2.js"></script>`. No `integrity="sha384-..."` attribute. Vite does not emit SRI by default. Since the script and HTML are same-origin (both served from GH Pages), an SRI mismatch can only happen if GH Pages itself is compromised — at which point SRI on the entry script doesn't help (attacker could rewrite both HTML and script). Defense-in-depth only.

A Vite plugin like `vite-plugin-sri3` could add this. Low priority.

---

## What was checked and is CLEAN

- `pnpm audit --prod` — **0 advisories** across 106 production dependencies (info: 0, low: 0, moderate: 0, high: 0, critical: 0).
- `grep -rn 'innerHTML|outerHTML|document.write|eval(|new Function|dangerouslySetInnerHTML|location.href.*='` across `src/` and `app/` — **zero hits**.
- `grep -rn 'fetch(|XMLHttpRequest|axios|sendBeacon|WebSocket|EventSource'` — **zero hits**. The game has no network surface at all.
- Query-string flag parsing:
  - `?objexoomSeed=N` — validated with `/^[0-9]+$/` regex then `Number.parseInt` masked to `& 0xffffffff` (`app/views/Shell.tsx:177-181`). Cannot inject NaN/Infinity/non-numeric.
  - `?objexoomArchetype=name` — `ARCHETYPE_NAMES.indexOf(archetype as ...)` validates against a hardcoded enum allowlist (`app/views/Shell.tsx:208-212`); unknown values return seed unchanged. No way for the value to escape this validator.
  - `?objexoomDebug` — only `URL.searchParams.has()`; value is never read.
- Production debug-gate verified at bytecode level: `dist/assets/index-Ce7km5p2.js` contains `function v6(){return!1}` for the `debugHooksEnabled` function, and the `window.__objexoom = {...}` assignment is wrapped in `if(v6())return ...` — confirmed dead-code in prod bundle.
- CI workflow secrets surface: `grep -rEn 'secrets\.' .github/` returns no app-defined secrets. Only `GITHUB_TOKEN`-equivalent permissions used. `release.yml` permissions are scoped to `contents: write, pull-requests: write, issues: write, pages: write, id-token: write` — appropriate for release-please + GH Pages OIDC deploy. No PAT, no SSH key, no signing key in workflows.
- No `pull_request_target` trigger anywhere. No untrusted-input → script-injection in workflow YAML.
- Dependabot is configured (`.github/dependabot.yml`) with weekly cadence for both `npm` and `github-actions`, grouped into major/non-major PRs.
- Capacitor config (`capacitor.config.ts`) — `androidScheme: "https"` (correct, avoids `http://localhost` MITM on Android), no `allowNavigation` whitelist (good — no external URLs), no `cleartext`, no `iosScheme: "http"`.
- Android `INTERNET` permission is the only listed user permission (zero-trust starting point); no `WRITE_EXTERNAL_STORAGE`, no `READ_*`, no `CAMERA`, no `LOCATION`, no `RECORD_AUDIO`.
- TypeScript `strict: true`, `noImplicitAny: true` (`tsconfig.json:7-8`) — narrows the unsafe-cast attack surface.
- `localStorage` access is limited to a legacy-migration code path in `src/runHistory.ts:80-102` which reads and immediately removes the legacy `objexoom.runHistory` key on first boot. New code goes through `Capacitor.Preferences` (`src/platform/persistence/preferences.ts`) which is `localStorage`-backed on web. No PII stored.
- No `.env*` files in repo, none referenced by code. `import.meta.env.BASE_URL` is the only env access (`src/assetUrl.ts:13`) and is a Vite build-time constant.
- Build artifacts: `dist/index.html` has no inline scripts (just one module script tag pointing to a hashed asset URL). No `data:` URIs of script. Asset paths use content-hashed filenames preventing cache-poison via stale asset.

---

## Recommended fix-ordering

1. **This week:** Strip sourcemaps from gh-pages artifact (Finding 1) — one-line fix, removes the dependency-version fingerprint.
2. **Before first real Play Store / sideload release:** Add release-signing + R8 minification + `android:allowBackup="false"` (Finding 2). Add `network_security_config.xml` (Finding 4).
3. **Defense-in-depth pass when convenient:** Add CSP meta tag (Finding 3). Test that Tone.js + postprocessing + jeep-sqlite still load.
4. **Optional / future:** SHA-pin actions (Finding 8) — only if a downstream concern materializes. SRI on script tag (Finding 10) — wait for a Vite-native solution.

---

## Methodology

Tools used:
- `pnpm audit --prod --json` — npm advisory database check.
- `grep -rn` for known sink patterns (`eval`, `innerHTML`, `Function`, `dangerouslySetInnerHTML`, `fetch`, etc.) across `src/` and `app/`.
- Bytecode inspection of `dist/assets/index-Ce7km5p2.js` to verify the `process.env.NODE_ENV` debug-gate compiled to `return false` in production.
- Manual review of `capacitor.config.ts`, `vite.config.ts`, `tsconfig.json`, all `.github/workflows/*.yml`, `.github/dependabot.yml`, `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`, `index.html`, `dist/index.html`.
- Cross-reference of all `window.location.search` / `searchParams.get` call sites against value-validator code paths.

Out of scope per the engagement brief: theoretical WebGL/Three.js attack surface without a specific exploit path; GDPR/HIPAA/SOC2 compliance (single-player offline game with no PII); supply-chain SLSA attestation (overkill for this scale).
