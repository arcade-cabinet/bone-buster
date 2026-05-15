---
title: POL24 — flashlight battery decision
updated: 2026-05-14
status: current
domain: product
---

# POL24 — flashlight battery decision

## The use cases for the flashlight

Step 1 (per CLAUDE.md): enumerate use cases before architecture.

1. **Dark-mode navigation.** Player picks up flashlight (J1), turns it on, uses it to see in dim/dark sectors. Without it, dark zones are unreadable. This is the original spec intent.
2. **Combat lighting.** Some enemies (wraith) are only fully visible in the flashlight cone. Combat in dim spaces depends on it.
3. **Tonal "horror" mode.** Flashlight OFF reads as a different game — the dark mode is the canonical screenshot 03 "flashlight OFF (dark mode)" that pins the visual identity.
4. **Resource management gameplay.** A battery-limited flashlight introduces a meaningful choice — save juice for combat vs spend on navigation.

## The conflict

The mandate from CLAUDE.md is: *"a flashlight you absolutely need."*
Battery management — done badly — pushes the player into "carry a 
spare flashlight, juggle resources, route-plan for charges." That's
a survival-horror genre signal, not the polished-DOOM signal the
top-level mandate calls for.

DOOM Eternal does NOT manage flashlight battery. DOOM (2016) doesn't
either. Modern arena shooters keep the flashlight as a permanent
affordance and lean on the lighting design for the "tense dark
spaces" feeling.

## Decision: SKIP the flashlight battery feature.

The POL24 spec is removed from Phase 13.

**Why:**

- The mandate is "polished DOOM." Battery management is a horror-genre move, not a DOOM move.
- The existing flashlight ON/OFF toggle (player-controlled) already gives the moment-to-moment lighting choice — battery would just add a count to that toggle.
- Use case 4 (resource management) doesn't have a strong demand in this game. The kill counter + score + secrets are the existing resource axes.
- Use case 3 (dark mode) is preserved by keeping the flashlight always-toggleable; horror-mode is a player choice, not a system constraint.
- The "you absolutely need the flashlight" mandate is BETTER served by leaning into the dark-mode lighting design (Phase 13 future items can include darker sectors, more wraiths, atmospheric ambient sound) than by gating with battery.

## What replaces POL24 in the polish budget

The polish time freed by skipping POL24 goes to:

- **POL27 (new) — atmospheric darkness pass.** Push darker fog + lower ambient + more lit-lamp wraiths in sewer + corridor archetypes so flashlight-off mode reads as genuinely scary. Reinforces use cases 1 + 2 + 3.
- **POL28 (new) — flashlight click polish.** Add a small "click on / click off" audio sting + a 100ms brighten-then-decay on the muzzle-light when turning on (already partially implemented via the flashlight pickup state, just needs the polish pass).

These are listed in the directive Phase 13 as replacements for POL24.

## What still needs to change in code

Nothing — the existing flashlight behavior is preserved. This doc
records the decision so a future agent doesn't re-litigate it.
