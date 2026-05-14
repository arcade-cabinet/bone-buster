---
title: Asset provenance — FBX → GLB pipeline
updated: 2026-05-14
status: current
domain: media
---

# Asset provenance — FBX → GLB pipeline

Every GLB under `public/assets/models/` is either:

1. **Pre-built GLB** shipped directly by the upstream pack (no conversion).
2. **Derived from an FBX** via `pnpm assets:fbx-to-glb` (`scripts/convert-fbx.mjs`, which calls `fbx2gltf` with `--khr-materials-unlit`).

This doc covers (2) — the FBX-derived subset that requires the conversion pipeline to be reproducible. For the full wired GLB inventory (including the pre-built ones) see [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md).

## Pipeline

```
references/                              (gitignored, repo-root directory)
├── _extracted/                          (manually unzipped source packs)
│   ├── horror_rigged/PSX Horror-Fantasy Megapack/
│   │   ├── abomination/final_rigged.fbx
│   │   ├── plague doctor/final_rigged.fbx
│   │   ├── elkdemon/final_rigged.fbx
│   │   └── clowns pack/{1,3}/final_rigged.fbx
│   └── slasher/{Axe,Chainsaw,Kitchen Knife,Machete,Meat Hook}/*.fbx
└── *.zip / *.glb                        (raw downloads, kept for re-extract)

       │ pnpm assets:fbx-to-glb
       ▼
public/assets/models/                    (tracked in git)
├── enemies/horror/{abomination_rigged,plague_doctor,elk_demon,clown_1,clown_3}.glb
└── weapons/slasher/{melee_axe,melee_chainsaw,melee_knife,melee_machete,melee_meathook}.glb
```

The script is **idempotent** — re-running it skips outputs newer than their FBX source. Used as a one-shot regen when an upstream pack updates.

## FBX → GLB jobs

| Source FBX (under `references/_extracted/`) | Target GLB (under `public/assets/models/`) | Pack origin | License notes |
| --- | --- | --- | --- |
| `horror_rigged/PSX Horror-Fantasy Megapack/abomination/final_rigged.fbx` | `enemies/horror/abomination_rigged.glb` | [PSX Horror-Fantasy Megapack](https://psxnoob.itch.io/) | itch.io commercial license; see pack's bundled `LICENSE.txt` |
| `horror_rigged/PSX Horror-Fantasy Megapack/plague doctor/final_rigged.fbx` | `enemies/horror/plague_doctor.glb` | same | same |
| `horror_rigged/PSX Horror-Fantasy Megapack/elkdemon/final_rigged.fbx` | `enemies/horror/elk_demon.glb` | same | same |
| `horror_rigged/PSX Horror-Fantasy Megapack/clowns pack/1/final_rigged.fbx` | `enemies/horror/clown_1.glb` | same | same |
| `horror_rigged/PSX Horror-Fantasy Megapack/clowns pack/3/final_rigged.fbx` | `enemies/horror/clown_3.glb` | same | same |
| `slasher/Axe/Axe.fbx` | `weapons/slasher/melee_axe.glb` | Slasher Weapon Pack (itch.io) | itch.io commercial; bundled `Read me.txt` |
| `slasher/Chainsaw/Chainsaw.fbx` | `weapons/slasher/melee_chainsaw.glb` | same | same |
| `slasher/Kitchen Knife/kitchenKnife.fbx` | `weapons/slasher/melee_knife.glb` | same | same |
| `slasher/Machete/Machete.fbx` | `weapons/slasher/melee_machete.glb` | same | same |
| `slasher/Meat Hook/MeatHook.fbx` | `weapons/slasher/melee_meathook.glb` | same | same |

10 conversion jobs; each output is referenced (directly or via the cycling roster) from `src/models.ts`.

## Re-extraction recipe (fresh checkout)

A teammate cloning the repo gets a working `public/assets/models/` tree out of the box (the GLBs are tracked). They only need to populate `references/` if they intend to re-run the conversion. Steps:

1. Download the source packs (links above) into `references/` as the original `.zip` files.
2. Unzip into `references/_extracted/` keeping the directory names this doc assumes (`horror_rigged/PSX Horror-Fantasy Megapack/...` and `slasher/<weapon>/...`).
3. Run `pnpm assets:fbx-to-glb`. Idempotent.
4. Confirm with `pnpm assets:verify-runtime` (asserts every GLB referenced by `src/models.ts` exists at the resolved path).

## Adding a new FBX source

1. Drop the FBX under `references/_extracted/<pack>/<asset>/<file>.fbx`.
2. Append a job to the `JOBS` array in `scripts/convert-fbx.mjs` with `{ fbx, glb, label }`.
3. Add a row to the table above.
4. Wire the resulting GLB into `src/models.ts` (skin roster, weapon model, or prop entry).
5. Run `pnpm assets:fbx-to-glb && pnpm assets:verify-runtime && pnpm verify`.

## Non-FBX sources

Pre-built GLBs (skeleton, imp, wraith, sewerfiend, horned, nun, abomination[2], anomaly, alien, pistol/chaingun/shotgun, doors, lamps, barrels) ship directly from their upstream packs — no conversion in this pipeline. Their provenance is in [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md).

### PSX Mega Pack II — direct copies (no conversion)

The 10 lamp GLBs (COV1) and 30 props GLBs (COV4) were copied verbatim
from `/Volumes/home/assets/3DPSX/PSX Mega Pack II v1.8/` (NAS-mounted
local asset library) — they ship pre-built. Recipe to re-extract from
a fresh checkout:

1. Mount the NAS at `/Volumes/home` (SMB to `192.168.1.200`).
2. `cp "/Volumes/home/assets/3DPSX/PSX Mega Pack II v1.8/Light Sources/lamp_mx_"*.glb public/assets/models/props/lamps/`
3. Copy each of the 30 props listed as keys of `PROP_CATALOGUE` in `src/scatter/propPool.ts` from `Props/` → `public/assets/models/props/scatter/`.
4. `pnpm assets:verify-runtime` (asserts every URL in `src/models.ts`, `src/lampScatter.ts`, `src/scatter/propPool.ts` resolves).

The pack license (PSX Mega Pack II v1.8) lives in the pack's bundled
`LICENSE.txt` on the NAS.
