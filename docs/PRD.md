---
title: PRD — Bone Buster (remaining work)
updated: 2026-05-17
status: current
domain: product
---

# Bone Buster — Product Requirements (remaining work)

Authoritative spec for unshipped work-units. Every unshipped
item has a user story / motivation, the specific surfaces it
touches, an acceptance criterion `pnpm verify` (or a named
gate) can confirm, and the dependencies it carries.

`.agent-state/directive.md` is the lean queue mirror — one
line per item, pointing back here for the why and the
acceptance bar. Shipped history lives in `docs/ROADMAP.md`,
`git log`, `.agent-state/decisions.ndjson`, and `CHANGELOG.md`.

Authority chain (per `AGENTS.md`):
DESIGN > ARCHITECTURE > DECISIONS > **PRD (this doc)** >
directive > ROADMAP.

## Status — overhaul drained (2026-05-17)

The full overhaul backlog has shipped:

- **BUILD-CONFIG** (BC1–BC7), **RESTRUCTURE** (RS1–RS6) —
  foundations.
- **ITCH-FETCH** (IF1–IF7) — asset acquisition.
- **REBRAND** (R1–R10) — typography + palette + landing +
  Capacitor namespace + event-prefix rename.
- **AUDIO** (A11a–A11f) — Howler swap + spritesheet + ambient
  + music + verifier.
- **IDENTITY** (D1–D9) — HUD, 24-kind enemy roster,
  vulnerability tags, weapon-acquired beat, weapon variants,
  level-name generator.
- **ARCHETYPE INTERLEAVE** (D7-X + A1-X + A2-X) —
  corridor/arena/courtyard/sewer/library content audits +
  InstancedField/EphemeralPool perf refactor.
- **MIGRATE** — cut as non-applicable (GitHub repo-rename
  redirect handles the URL change durably).

The latest slice — **D19 dual-PRNG + R8 event-prefix follow-up**
— ships in PR #75 alongside the reference-asset drain (Lanes
C/D/E/F) and the InstancedField perf migration of the
remaining four scatter fields (PT1–PT6).

See `docs/DECISIONS.md` §D19 for the dual-PRNG architecture
rationale and `docs/ROADMAP.md` for the human-readable
shipped-milestone summary.

## Remaining work

(empty)

## Parked — out of scope until a new lane up-prioritizes

These are good ideas with no acceptance gate yet.

- Ghost Hunting Tools — `pickSpiritBoxPhoneme` + UV flashlight +
  EMF reader + placeable crucifix all shipped (PC1–PC4). Open
  follow-ups: tape-recorder cue capture, walkie-talkie squelch
  audio, ghost-trail particle layer.
- Bespoke commissioned logo — current SVG re-letter with
  Bungee/Inline/Shade is good enough for ship.
- Mobile-perf CI gate — currently label-gated; promote to
  required-status when the Pixel 5a-class baseline stabilizes.

---

## Shipped history

Per-release shipped-milestone summaries live in
`docs/ROADMAP.md`. Per-decision rationale lives in
`docs/DECISIONS.md`. Per-commit audit trail lives in
`git log` + `.agent-state/decisions.ndjson`. This PRD only
carries the **remaining** work — items that ship are deleted
from here in the same commit that closes them.
