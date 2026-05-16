# Bone Buster — live work queue

**Status:** ACTIVE
**Branch:** one long-running perf/parked branch per slice. PRs squash-merge to main when their slice is fully verified + reviewers folded.
**Authority chain:** DESIGN > ARCHITECTURE > DECISIONS > **PRD** > this file > ROADMAP.
**Spec:** [`docs/PRD.md`](../docs/PRD.md) carries the user stories, surfaces, and acceptance bars. Each item below points at its PRD section for the why and the verifiable acceptance.
**Standards:** [`STANDARDS.md`](../STANDARDS.md) carries doctrine (quality bar, slot architecture, no-end-of-turn, design tokens, etc).
**Decisions:** [`docs/DECISIONS.md`](../docs/DECISIONS.md) carries binding technical decisions.
**Audit trail:** shipped items live in `git log` + `.agent-state/decisions.ndjson` + `CHANGELOG.md`. They are not preserved in this file.

## Operating loop (for the next directive)

1. Pick the topmost unchecked item.
2. Read its PRD section for the acceptance bar.
3. Implement, run `pnpm verify`, commit, dispatch reviewer trio locally.
4. Fold reviewer findings into the next forward commit.
5. Flip `[ ]` → `[x]` in the same commit; **delete the item from this file** in the next forward-going commit (per the prune-shipped-from-directive rule).
6. Push + open one PR per coherent slice (lane completion or larger), not per commit (per the no-pr-per-commit rule).

## Queue — Post-overhaul drain (user-directed 2026-05-16)

Mandate: drain everything — directive, PRD §Parked, residual perf wins surfaced by the Lighthouse gate now in CI. Each lane ships as its own squash-merged PR.

### Lane A — Perf follow-up (Vike/Lighthouse-adjacent)
- [ ] PA1 Split `vendor-misc` chunk (currently 1.7MB / 524KB gzip in `dist/client/assets/chunks/chunk-Ks4ok9G-.js`) — identify the biggest contributors, give them their own `vendor-*` chunks in `vite.config.ts` manualChunks, verify Lighthouse perf-score holds or improves.
- [ ] PA2 Title-screen preload — `<link rel="preload">` the critical Bungee/Space-Grotesk woff2s used by the prerender skeleton + warm a Howler instance for the title ambient so the brand identity (visual + audio) lands together. No Lighthouse delta expected; perceptual win.

### Lane B — PRD §Parked drain
- [ ] PB1 Type sweep: `Objexoom*Map` → `BoneBuster*Map` in `src/engine/engine.ts` + 17 dependent files. Mechanical (find/replace + `pnpm lint:fix`). Lowest blast radius — do first to clear the namespace.
- [ ] PB2 Per-variant kill-popup names — e.g. "You busted a Plaguebeak (Stained-Cassock variant)". Surface: kill-confirmation UI; data: per-enemy variant tag already on spawn record. Small UX slice.
- [ ] PB3 InstancedField migration — PropField + LargePropField + TrapField + NpcField + NatureField → InstancedGltfField, ~150 fewer arena draw calls per the PR #62 perf reviewer. Per-field notes in PRD §Parked: LampField needs split (per-lamp pointLight children); NpcField NOT a candidate (per-instance animation mixer); NatureField needs Mega_Nature.glb split into per-plant GLBs first. Use-case-enumeration pass required before opening code.
- [ ] PB4 Slasher melee weapons — chainsaw (loud-attract), meat-hook (pull), axe (heavy-slow) as distinct damage-profile variants. Gameplay-design slice.
- [ ] PB5 Ghost Hunting Tools layer — spirit box, EMF reader, UV flashlight, walkie-talkie, crucifix, tape recorder. Big gameplay-layer lift; brainstormed in `docs/REBRAND.md`. Last because biggest scope + needs design-doc pass before implementation.

### Ship rules
- One PR per lane item, squash-merged.
- Reviewer trio (code/security/simplification) dispatched locally per commit; findings folded forward.
- Lighthouse gate must stay green on every Lane A merge; perf snapshot must stay green on every Lane B item that touches scene/render.
- Prune from this file in the commit that closes the item.

## Closeout note (2026-05-16)

ARCHETYPE INTERLEAVE drained — see commits `a4daceb` through
`be4e4af` and the per-archetype audit docs under `docs/audits/`.

MIGRATE lane (M4 + M5) cut as non-applicable — GitHub's
repo-rename redirect handles all the durable substitutes;
there is no separate OLD repo with a Pages deployment to
manage. PRD §MIGRATE updated with the empirical findings.
