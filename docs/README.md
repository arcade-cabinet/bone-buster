---
title: Docs map
updated: 2026-05-14
status: current
domain: context
---

# Docs map — BONE BUSTER

Map of doc ownership for the standalone game repo. When two docs
disagree, this is the authority chain:

1. [`DESIGN.md`](./DESIGN.md) — product truth
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system truth
3. [`DECISIONS.md`](./DECISIONS.md) — binding technical decisions
4. [`PRD.md`](./PRD.md) — comprehensive remaining-work spec
5. [`ROADMAP.md`](./ROADMAP.md) — milestone-level summary

The `.agent-state/directive.md` is the executable checklist mirror of
the PRD. When PRD and directive disagree, PRD wins and the directive
gets updated.

This file is the **map**, not a source of truth.

## Root-level docs

| Doc | Domain | Purpose |
| --- | --- | --- |
| [`/README.md`](../README.md) | onboarding | What it is, how to run, how to contribute |
| [`/AGENTS.md`](../AGENTS.md) | operating | Per-session agent protocol (stack rules, what's in / out of scope) |
| [`/CLAUDE.md`](../CLAUDE.md) | operating | Profile includes + repo-specific commands |
| [`/STANDARDS.md`](../STANDARDS.md) | quality | Non-negotiable code + brand rules |
| [`/CHANGELOG.md`](../CHANGELOG.md) | history | Keep a Changelog 1.1.0, release-please driven |
| [`/public/README.md`](../public/README.md) | layout | Public asset directory convention |

## Domain docs (this directory)

| Doc | Domain | Purpose |
| --- | --- | --- |
| [`DESIGN.md`](./DESIGN.md) | product | Vision, identity, palette, references, what the game IS |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | technical | Engine, scene, HUD, SFX, AI architecture and data flow |
| [`DECISIONS.md`](./DECISIONS.md) | technical | ADRs — binding decisions + what was rejected |
| [`PRD.md`](./PRD.md) | product | Comprehensive remaining-work spec — user stories, acceptance criteria, asset paths, dependency DAG |
| [`PARITY.md`](./PARITY.md) | quality | DOOM reference clone parity audit — every mechanic ✅/🚀/⚠️/❌ |
| [`ELEVATION.md`](./ELEVATION.md) | product | Catalogue of features beyond reference parity (E1-E13); per-feature specs live in PRD.md |
| [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md) | media | What 3DPSX assets we have, use, and haven't tapped yet |
| [`ROADMAP.md`](./ROADMAP.md) | context | Active queue + completed milestones (mirrors `.agent-state/directive.md`) |
| [`TESTING.md`](./TESTING.md) | quality | Test strategy, how to run unit / browser / e2e suites |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | ops | Pages deploy, Capacitor mobile, env requirements |
| [`specs/`](./specs/) | history | Original design specs (pre-extraction reference) |
| [`assets/`](./assets/) | media | Screenshots, mockups, reference imagery |

## Frontmatter

Every `.md` in `docs/` and at the repo root carries:

```yaml
---
title: <short title>
updated: YYYY-MM-DD
status: current | draft | stale | archived
domain: technical | product | quality | ops | onboarding | history | context | operating | media | layout
---
```

Stale docs are bugs. If you touch a system and a doc no longer
reflects it, update the doc in the same commit.
