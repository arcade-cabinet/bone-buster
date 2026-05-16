---
title: Bone Buster rebrand spec
updated: 2026-05-15
status: current
domain: product
---

# Bone Buster — rebrand spec + overhaul plan

## Locked decisions (2026-05-15)

| Field | Value |
|---|---|
| Project name | **Bone Buster** |
| Tagline | **"They had it coming."** |
| Display font (Google Fonts) | `Bungee` — boxy urban-signage all-caps, perfect for "BONE BUSTER" marquee |
| Body font | `Space Grotesk` — geometric humanist, pairs with Bungee without competing |
| Mono font | `JetBrains Mono` — debug overlay + scores |
| Flair font | `Tilt Prism` — variable-axis 3D-rotatable, for MISSION COMPLETE / GAME OVER moments only |
| Font delivery | Self-hosted via `@fontsource/*` (honors the S2 CSP — no third-party DNS) |
| Logo treatment | Full SVG redesign: Bungee letters layered with Bungee Inline + Bungee Shade for letterpress depth, blood-stroke outline, bone-gradient fill, framer-motion stagger drop-in, Tilt Prism axis flicker on final letter |
| Landing screen | Replace `<ObjexoomLanding>` with `<BoneBusterLanding>` — SVG logo + Radix card-menu (tilted ticket-stub cards) + animated scuff-pattern canvas-shader background |
| Audio logo sting | 1.2s minor-key arpeggio + rim-shot on landing mount, via Tone.js |
| GitHub destination | `arcade-cabinet/bone-buster` (public) |
| Local dir | STAYS at `~/src/objexiv/objexoom` — GitHub redirects handle the URL change automatically |
| Branch strategy | ONE long-running `overhaul` branch holds every commit until the backlog drains. No phases. |
| Review cadence | Reviewer trio runs LOCALLY per commit. Fold findings forward. Push + open PR only when slice is fully done. |
| Asset source | `references/` (already on disk) + itch.io API (user owns 316 keys; ~290 unfetched). NAS not needed. |
| Enemy roster | 24 first-class kinds total (3 renames + 9 promotions of already-shipped variants + 12 new extracts) |

## Color scheme — Bone palette

| Token | Hex | Hue family | Use |
|---|---|---|---|
| `ROLE.surface.base` | `#0F0C12` | near-black with violet | Page bg, scene letterbox bars |
| `ROLE.surface.elevated` | `#1A1620` | charcoal-violet | HUD chip backgrounds, menu cards |
| `ROLE.surface.deep` | `#070509` | true-black | Modal overlays, fade peaks |
| `ROLE.text.primary` | `#F4ECDC` | bone-white | All body text, HUD numerals |
| `ROLE.text.secondary` | `#A89B85` | aged-bone-tan | Sub-labels, secondary HUD info |
| `ROLE.text.muted` | `#6D6458` | weathered-bone | Disabled state, footer chips |
| `ROLE.accent.primary` | `#FF6B35` | red-orange | Action chips, "NEW GAME" hover, weapon-acquired beat |
| `ROLE.accent.warning` | `#FFB347` | safety-amber | Low-HP warning, traps, secret-found flash |
| `ROLE.accent.danger` | `#E63946` | crimson | Damage fade overlay, boss HP, "GAME OVER" |
| `ROLE.accent.discovery` | `#9D4EDD` | violet | Key pickup ceremony, portal glow, secret-found |
| `ROLE.accent.gain` | `#06D6A0` | mint | Health pickup chip, "MISSION COMPLETE" |
| `ROLE.brand.bone1` | `#F4ECDC` | warm bone | Logo letter fill (light side of gradient) |
| `ROLE.brand.bone2` | `#D9C5A0` | aged bone | Logo letter fill (mid) |
| `ROLE.brand.bone3` | `#8B6F47` | weathered bone-wood | Logo letter fill (dark side) |
| `ROLE.brand.blood` | `#9B2226` | dried-blood | Logo accent — letter stroke |

Brand gradient on the logo: `bone1 → bone2 → bone3` diagonally (top-left to bottom-right), with `blood` as the stroke around the letters. The orange `accent.primary` is reserved for in-game UI states — keeps the logo (warm white-cream) and the gameplay UI (warm orange) visually distinct.

The 5 archetype lighting palettes (`archetypePalette.ts`) get a one-pass refresh to shift their accent tints toward this new palette.

## Visual identity — full redesign

| Element | Today | After |
|---|---|---|
| Logo | "OBJEXOOM" CSS stencil-gradient | **BONE BUSTER** in Bungee, inline-SVG `<text>`, layered Bungee Inline over Bungee Shade for 2-layer letterpress. Letters tilt -3°. `blood` outline + `bone1→bone3` gradient fill. Lock-in: each letter drops in from above by ~80px with framer-motion staggered springs, settles, then Tilt Prism axis-rotation flicker fires once on the final B's. |
| Tagline | "RIP AND TEAR · THE OBJEXIV CUT" | "They had it coming." in Space Grotesk Medium, `text.secondary`, drops in 200ms after the logo lock-in completes |
| Background | navy diagonal grid | Animated scuff-pattern shader on `<canvas>` — slowly-scrolling Perlin noise tinted `surface.elevated`, occasional `accent.primary` scratch flashes. Falls back to static SVG noise on AdaptiveResolution low-quality (A3 carryover). |
| Menu | terminal-style ">  NEW GAME" list | Radix `<NavigationMenu>` primitive styled as ticket-stub cards stacked with -2° rotation. Hover/focus rotates active card forward via framer-motion `whileHover` + lifts via shadow expansion. Keyboard nav unchanged. |
| Audio | none on landing | Logo sting: 1.2s on mount — minor-key arpeggio (A2-C3-E3) on Tone.js metallic synth + single rim-shot percussion hit on the final letter lock. Plays once per page load. |
| In-game HUD | navy chips with orange chevrons | Same compositional structure, re-tokened to new palette. Bungee for level names + status numerals (HEALTH 9, KILLS 3/7), Space Grotesk for sub-labels ("FIND THE KEY"), JetBrains Mono for debug overlay. |

### Component-level files affected

- `app/views/Landing.tsx` → `app/views/Landing.tsx` (new SVG logo + Radix nav + shader background)
- `app/styles/tokens/role.ts` — palette swap (names survive; values shift)
- `app/styles/tokens/typography.ts` — NEW: exports `TYPE.display`, `TYPE.body`, `TYPE.mono`, `TYPE.flair`
- `src/scene/shaders/scuffBackground.tsx` — NEW: `<canvas>` Perlin-noise shader
- `src/audio/logoSting.ts` — NEW: Tone.js arpeggio + rim-shot
- `src/ui/CardMenu.tsx` — NEW: Radix-based ticket-stub stack menu
- `package.json` — adds `@fontsource/{bungee,bungee-inline,bungee-shade,space-grotesk,jetbrains-mono,tilt-prism}`

## Enemy roster — 24 first-class kinds

Current: 3 kinds (`skeleton`, `wraith`, `imp`) with cosmetic skin variants. After overhaul: 24 distinct kinds with their own behaviors + vulnerabilities + spawn-mix weights.

### 3 renames (existing 3 kinds, kept mechanics)

| Old | New | Mechanic |
|---|---|---|
| `skeleton` | `rattler` | Slow melee. Vulnerable to BLADE (+50%). |
| `wraith` | `phaser` | Phases walls. Vulnerable to FLAMETHROWER. |
| `imp` | `bouncer` | Fast aggressive hit-and-run. Vulnerable to SHOTGUN. |

### 9 promotions (already-shipped skin variants → first-class kinds)

| GLB | New kind | Mechanic |
|---|---|---|
| `plague_doctor.glb` | `plaguebeak` | Imp-like, slower. Leaves slow-damage gas cloud on death. |
| `clown_1.glb` | `jester` | Imp-like, erratic. Fires 3 shots in a fan instead of 1. |
| `nun.glb` | `reverend` | Skeleton-like, ranged. Fires from a distance instead of charging. |
| `elk_demon.glb` | `stagged` | Imp-like, charging. Straight-line bull-rush, deadly head-on, easy to sidestep. |
| `sewerfiend.glb` | `grub` | Skeleton-like, low HP, fast. Spawns in groups of 3-5 in SEWER archetype only. |
| `alien.glb` | `signal` | Wraith-like, ranged. Only enemy that targets the player through walls. |
| `abomination.glb` | `heap` | Imp-tank variant. High HP, slow melee. Drops health pickup on death. |
| `abomination2.glb` | `heap2` | Heavier `heap` variant. Same mechanic, bigger HP pool. |
| `horned.glb` | `gorehead` | Skeleton-like, bigger. Charge-attack on line of sight. |

### 12 new extracts (FBX → GLB conversion pass from `references/_extracted/horror/`)

| GLB to extract | New kind | Mechanic |
|---|---|---|
| `bigabomination` | `bighoss` | Big slow tank. Drops loot pickup on death. |
| `bigfoot` | `stomper` | Heavy charge variant. Bull-rush with ground-shake. |
| `blackbutcher` | `butcher` | Melee with chainsaw animation. Loud — attracts other enemies. |
| `bloodwraith` | `bloodphaser` | Red phaser variant. Ranged blood-projectile. |
| `clown2` | (jester variant) | Same mechanic, skin-only variant of jester. |
| `devildemon` | `devil` | BOSS-TIER. 1-per-level rare spawn. Triggers boss music. |
| `doll1` | `dolly` | Tiny fast erratic. SEWER + LIBRARY archetypes. |
| `doll2` | (dolly variant) | Same mechanic, skin variant. |
| `eyehead` | `gawker` | Ranged with all-eyes-tracking visual rig. |
| `greencyclope` | `oneye` | Slow charge, melee. Vulnerable to PISTOL headshot. |
| `greengoliath` | `goliath` | Heavy tank variant of stomper. ARENA archetype. |
| `killerpig` | `swiney` | Fast aggressive (replaces some bouncer spawn slots). |
| `mrZ` | `mrZ` | Zombie — takes 3 shots regardless of weapon. Retro callback. |
| `werewolf` | `lupin` | Aggressive. COURTYARD archetype only. |

### Per-archetype mix tables (updates to `src/ai/enemyMix.ts`)

| Archetype | Headline kinds (heavy weight) | Tail kinds (lighter weight) |
|---|---|---|
| corridor | rattler, bouncer, mrZ, anomaly variants | reverend, stagged |
| arena | bighoss, goliath, stagged, gorehead | bouncer, heap |
| courtyard | lupin, stomper, swiney | rattler, jester, dolly |
| sewer | grub, dolly, swiney, butcher | phaser, plaguebeak |
| library | plaguebeak, gawker, reverend, dolly | devil (boss-room only), jester |

## itch.io library audit

User owns **316 itch.io keys**. Voxel-realms (`~/src/arcade-cabinet/voxel-realms`) has a working fetcher at `scripts/fetch-itch-audio.mjs` that we'll generalize past the audio bucket. Inspection of `voxel-realms/.itch-cache/all-keys.json` shows the library spans:

| Category | Count | Examples |
|---|---|---|
| 3D models | ~180 | "PSX Character Megapack", "Modular Mansion PSX Pack", "Retro PSX Style Mansion Assets", "PSX Mega Pack II", "Mutant 1/2/3/4 Voxel" |
| Characters / Creatures | ~100 | "Fantasy RPG Creatures & Monsters: Extended" |
| **PSX / Retro / Lo-Fi** (on-identity bucket) | **37** | every weapon, mansion, props, hands; see full list below |
| 2D / Pixel / Sprites | 31 | various sprite atlases |
| Audio | 26 | the bucket voxel-realms already enumerated |
| Tilesets / Tilemaps | 30 | top-down + side-on tilesheets |
| Weapons | 9 | distinct from 3D + audio buckets |
| Horror-tagged | 5 | 3 audio + 2 monster packs |

### PSX/retro bucket (37 keys)

```text
PSX Animated FPS Hands         — viewmodel hand rig
PSX FPS Hands MEGA PACK        — bigger set
PSX Character Megapack         — ENEMIES (likely yields more first-class kinds)
Modular Mansion PSX Pack       — environment / wall kit
PSX Style Door & Window Textures
Retro PSX Style Mansion Assets — props
PSX-Cassettes                  — flavor pickups
PSX-Meats&Flesh                — gore decals / body parts
PSX-Shotgun                    — weapon
PSX-Sword                      — weapon
PSX-Machinery & Pipes          — corridor/sewer environment
PSX-Axe                        — weapon
PSX-Chainsaw + 2.0             — weapon
PSX-Handcannon                 — weapon
PSX-Cleaver                    — weapon
PSX-UZI                        — weapon
PSX-Knife + 2.0                — weapons
PSX-RV-Camper/Vans             — courtyard props
PSX-Traps                      — environment hazards
PSX-Misc Items                 — flavor
PSX-Allegiance(Mauser)         — weapon (handgun)
PSX-Katana                     — weapon
PSX-Machete                    — weapon
PSX-Flamethrower               — weapon
PSX-USP/USP-S                  — weapons (handguns)
PSX-Retribution(Revolver)      — weapon
PSX-Baseball-Bat               — weapon
PSX-Farm Pack                  — courtyard props
PSX Mega Pack II               — MASSIVE catch-all
```

### Audio bucket (15 packs to allow-list)

| Pack | Use |
|---|---|
| Horror Sound Effects Pack | Enemy attack stingers, death rattles, ambient creeps |
| Horror Dark Ambient Music Pack – 20 Creepy Tracks | Per-archetype music — corridor/sewer/library |
| Dark Ambient Game Music Pack – Mystery & Horror Loops | Alternate moods |
| Ultimate Ambient Sound Effects Pack | Environmental beds (corridor hum, sewer drip, library page-flip) |
| Weapon & Laser Sound Effects Pack | Gunfire upgrade — replace synth pistol/chaingun with samples |
| Impact & Hit Sound Effects Pack | Enemy hit reactions, damage thuds |
| Explosion Sound Effects Pack | Barrel explosions (currently synth boom) |
| Cinematic Whoosh SFX Pack | Level transitions, key-pickup whoosh, door slam |
| Retro PSX Footstep SFX Pack | Player movement (NEW — currently no per-step audio) |
| Retro Combat Music Pack | Combat-triggered music intensity bumps |
| Retro Boss Battle Music Pack | Devil boss-tier encounter music |
| Victory & Level Complete Music Pack | Mission complete sting |
| UI Sound Effects Pack | Menu hover/select/back, weapon-swap clicks |
| Music Box Music Pack - Toys in the Attic | Library archetype + dolly enemy thematic music |
| Kitchen Sound Effects | Library kitchen sub-scatter (COV13) flavor |

## Per-archetype content plan (D7 by archetype)

D7 discipline: per archetype, every asset audit produces TWO outputs — the slotted assignment AND a "ideas this asset gave me" list. Slot if obvious; brainstorm-capture if not. Outside-the-box mechanics get captured and either ship inside the slice or get added to the backlog.

### CORRIDOR

- Industrial fittings from PSX-Machinery & Pipes + Modular Mansion PSX Pack
- Enemies (heavy weight): rattler, bouncer, mrZ, anomaly variants
- Tail enemies: reverend, stagged
- Outside-the-box candidates: PSX-Traps assets → trap-room sub-layout where 80% of tiles are damaging (Phase 23 candidate or slice-inline)

### ARENA

- Coliseum pieces from PSX Mega Pack II + Retro PSX Style Mansion Assets
- Enemies (heavy weight): bighoss, goliath, stagged, gorehead
- Tail enemies: bouncer, heap
- Outside-the-box: arena boss-room becomes a goliath-vs-bighoss-vs-player triangle (no Phase 23 split — capture)

### COURTYARD

- Garden statuary from PSX Mega Pack II + PSX-Farm Pack
- Vehicle wrecks already shipped; expand via PSX-RV-Camper/Vans
- PSX-Ocean-Surface as fountain/pond prop
- Enemies (heavy weight): lupin, stomper, swiney
- Tail enemies: rattler, jester, dolly
- Outside-the-box: PSX-Ocean-Surface as wading mechanic (knee-deep slow tile + fish-grub spawns)

### SEWER

- Water surface from PSX-Ocean-Surface; ladders/pipes from PSX-Machinery & Pipes
- Enemies (heavy weight): grub, dolly, swiney, butcher
- Tail enemies: phaser, plaguebeak
- Outside-the-box: PSX-Cassettes as "evidence" pickups; tape recorder gameplay layer (parked)

### LIBRARY

- Reading tables / chandeliers / globes from PSX Mega Pack II
- Bookshelves already shipped (COV13 step-1)
- Enemies (heavy weight): plaguebeak, gawker, reverend, dolly
- Tail enemies: devil (boss-room only), jester
- Outside-the-box: PSX Mega Pack II likely contains "scribe" assets — could become an NPC variant pool

## Migration plan

**The remote rename has been completed (2026-05-15).** The repo
now lives at `arcade-cabinet/bone-buster`; GitHub's git-protocol
redirect routes the old `objexiv/objexoom` origin URL
transparently. The local working tree stays at
`~/src/objexiv/objexoom`; no `mv` is required and no
`git remote set-url` is required.

Residual cleanup tracked in `docs/PRD.md` §MIGRATE:

- **M4** — OLD repo's GitHub Pages `index.html` redirects to
  `arcade-cabinet.github.io/bone-buster/` via
  `<meta http-equiv="refresh">`; OLD README points at the new
  home.
- **M5** — 30-day traffic grace, then `gh repo archive
  objexiv/objexoom` (redirect survives archival).

Historical "what the migration originally entailed" (now done,
preserved for audit):

1. ~~Land the rebrand on the active feature branch in
   `objexiv/objexoom`.~~ — done; the rebrand work then split
   across PR #60 (docs) and the subsequent overhaul work.
2. ~~`gh repo create arcade-cabinet/bone-buster --public`.~~ — done.
3. ~~`git push --mirror` to preserve every branch/tag/history.~~ — done.
4. ~~`git remote set-url origin …`.~~ — **not** done; GitHub's
   redirect handles the old URL automatically, so the local
   `origin` still points at the old name and works fine.

## Parked for after the overhaul drains

These were brainstormed inline but won't slot until the overhaul backlog ships.

- **Ghost-hunting tools layer** — `references/PSX Ghost Hunting Tools Release.zip` has spirit box, EMF reader, UV flashlight, walkie-talkie, crucifix, tape recorder. Whole new gameplay-mechanic layer. Either slice-inline opportunistically (if a sewer audit surfaces a natural EMF mechanic) or batch separately.
- **Per-enemy-variant flavor names in kill-confirmation popup** — e.g. "You busted a Plaguebeak (Stained-Cassock variant)." Polish item.
- **Bespoke commissioned logo** — the SVG re-letter using Bungee/Bungee Inline/Bungee Shade is good enough for early-access; commission later for a hand-crafted brand mark.
- **Slasher melee weapons as damage-profile variants** — chainsaw (loud, attracts), meat hook (pulls enemies), axe (heavy slow). Currently melee is one weapon with skin variants. Could become real mechanical differentiation.

## Appendix — naming brainstorm history (superseded)

Earlier in the brainstorm conversation I cycled through two-word alliterative candidates (`Boom Bazaar`, `Glyph Grinder`, `Tomb Tumble`, `Skull Slammer`, `Pixel Purgatory`, `Crypt Crawl`, `Doom Doodle`) and then one-word DOOM-shape candidates (`RUST`, `GRIND`, `GULCH`, `SLAB`, `CHURN`, `HUSK`, `GAUNT`, `CLANG`, `PYRE`, `KILN`, `THRESH`, `MAUL`, `GUNK`, `BRAZE`, `CLEAVE`, `GUILD`, `OSSUARY`, `CRYPT`, `SCRAP`, `HEW`, `JAW`, `VOID`). User picked **Bone Buster** from the early two-word list. The single-word constraint framing was discarded; Bone Buster's two-word B+B alliterative shape is the final identity.

## Appendix — locked decision history

| 2026-05-15 | Name | "Bone Buster" |
| 2026-05-15 | Tagline | "They had it coming." |
| 2026-05-15 | Phase structure | Dropped. Single un-phased overhaul backlog. |
| 2026-05-15 | Branch | One long-running `overhaul` branch. |
| 2026-05-15 | PR cadence | Local reviewer trio per commit. Push + PR per slice only. |
| 2026-05-15 | Asset source | references/ + itch.io API. NOT the NAS. |
| 2026-05-15 | Local move | DON'T move local dir. Keep at ~/src/objexiv/objexoom. GH redirects handle URL changes. |
