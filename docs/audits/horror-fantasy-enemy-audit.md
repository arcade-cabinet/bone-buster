---
title: PSX Horror-Fantasy Megapack enemy audit
updated: 2026-05-16
status: current
domain: technical
---

# PSX Horror-Fantasy Megapack — enemy audit (PF1)

The horror-fantasy extraction under `references/_extracted/psx/psx-horror-fantasy-megapack/`
provided most of the existing 24-kind enemy roster (D5 promotion).
The directive originally framed Lane F as "wire 23 unwired enemies"
— that count is **stale**. Audit reality follows.

## What's already wired (24 EnemyKinds, 25 GLBs)

`src/engine/engine.ts` declares 24 `EnemyKind` variants. `src/assets/models.ts`
wires each to one or more `EnemyModel` skins under
`public/assets/models/enemies/horror/`:

| EnemyKind | GLB | Source pack |
|---|---|---|
| plaguebeak | plague_doctor.glb | plague doctor/final_rigged.glb |
| jester | clown_1.glb | clowns pack/1/final_rigged.glb |
| reverend | nun.glb | (separate pack — not horror-fantasy) |
| stagged | elk_demon.glb | elkdemon/final_rigged.glb |
| grub | sewerfiend.glb | (separate pack) |
| signal | alien.glb | alieninvader/alienfbx.glb |
| heap | abomination.glb | abomination/final_rigged.glb |
| heap2 | abomination2.glb | !NEW Abomination2/abomination2.glb |
| gorehead | horned.glb | (separate pack) |
| bighoss | bighoss.glb | bigabomination/bigabominationfbx.glb |
| stomper | stomper.glb | (separate pack — assumed) |
| butcher | butcher.glb | black butcher/blackbutcherfbx.glb |
| bloodphaser | bloodphaser.glb | bloodwraith/bloodwraithfbx.glb |
| devil | devil.glb | Devil Demon/devildemonfbx.glb |
| dolly + dolly2 | dolly.glb / dolly2.glb | horror dolls pack/1 + 2 |
| gawker | gawker.glb | (separate pack) |
| oneye | oneye.glb | green cyclope/green cyclope.glb |
| goliath | goliath.glb | greengoliath/greengoliathfbx.glb |
| swiney | swiney.glb | killer pig/killerpigfbx.glb |
| mrZ | mrZ.glb | mrZ/mrZ.glb |
| lupin | lupin.glb | werewolf/werewolffbx.glb |
| (clown variants in jester roster) | clown_1.glb, clown_3.glb | clowns pack/1, 3 |
| rattler | (skeleton pack, base kind) | — |
| phaser + bouncer | (base kinds) | — |

## What's actually unwired in the horror-fantasy pack

Comparing the available GLBs to wired:

| Unwired asset | Source | Verdict |
|---|---|---|
| `bigfoot/bigfootfbx.glb` | bigfoot pack | **Novel.** Reads as ape-like brawler. Distinct silhouette vs existing tier-large kinds (bighoss is humanoid-mass, goliath is reptilian). Candidate for a new EnemyKind. |
| `eyehead/eyenoid_rigged.glb` | eyehead pack | Similar to existing oneye (green cyclope) — different model, but same one-eye-stalker silhouette. Could be a per-archetype skin variant on the existing `oneye` kind, not a new EnemyKind. |
| `clowns pack/2/cloaked_rigged.glb` | clowns pack | A third clown variant. Same case as eyehead — skin variant on `jester` rather than new kind. |
| `muscular abomination/final.glb` | muscular abomination | Variant of abomination silhouette. Skin variant on `heap` or `heap2`. |
| `plague doctor/final_rigged.glb` | plague doctor | Already wired (plaguebeak.glb is sourced from it). |

## Recommendation (PF2 scope)

Add **ONE** new `EnemyKind`:

- `bigfoot` — large fur-clad biped brawler. Rattler-archetype FSM
  (close-range bite/swipe melee, no ranged). HP between rattler and
  bighoss; faster than bighoss but slower than rattler. Visually
  distinctive enough to be its own kind.

The other unwired candidates (eyenoid, cloaked clown, muscular
abomination) belong as **skin variants** on existing kinds rather
than new EnemyKinds. They extend the multi-skin roster pattern
already used by `rattler` / `bouncer` / `phaser`, NOT the EnemyKind
enum.

## Recommendation (PF2 scope — skin variants)

Per-existing-kind skin additions:

| Existing kind | New skin GLB | Pack |
|---|---|---|
| jester | clown_2.glb (from clowns pack/2/cloaked_rigged.glb) | clowns pack |
| oneye | eyenoid.glb (from eyehead/eyenoid_rigged.glb) | eyehead |
| heap (or heap2) | abomination_muscular.glb (from muscular abomination/final.glb) | muscular abomination |

These extend the existing `roster: EnemySkin[]` for those kinds with
no FSM / mechanics changes — pure visual variety per spawn.

## Recommendation (PF3 scope — spawn-table integration)

After PF2 ships, `src/ai/enemyMix.ts` needs the new `bigfoot` kind
added to whichever archetypes it fits best — likely `courtyard`
(outdoor "creature lurking in the trees" identity) and as a low-
weight option in `arena`. The new skin variants on existing kinds
need NO spawn-table change because the existing kinds keep their
weights and the renderer picks from `roster` per spawn.

## What this audit deliberately doesn't do

- Pre-tune HP / damage / cooldown numbers for the new bigfoot kind.
  That happens in PF2 step-1 against `MELEE_HP_TIERS` (`src/shared/constants.ts`)
  and the FSM behavior in `src/ai/enemyAi.ts`.
- Touch the renderer or `EnemyMesh.tsx`. The existing skin-roster
  pattern already handles per-kind multi-skin rosters; adding
  bigfoot uses `singleSkinModel(...)` (the standard helper) and
  adding skin variants extends an existing `EnemyModel.roster`.
- Reopen the "13 unwired" framing from the original directive. The
  directive's count was stale; this audit replaces it with the
  factual "1 new kind + 3 skin variants" scope.
