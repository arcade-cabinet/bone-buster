# `public/` — static asset layout

Anything served verbatim by Vite goes here. Files keep their original
names; Vite respects the directory tree as-is at the URL.

## Convention

Everything lives under `public/assets/` so the URL prefix is
predictable and a single CDN / hosting rule can cover the lot. Loaders
prefix every URL with `import.meta.env.BASE_URL` (see
`src/models.ts:A()`) so the same source code works in dev (base `/`)
and in the GitHub Pages build (base `/objexoom/`).

```text
public/
├── README.md                    # this file
└── assets/
    ├── fonts/                   # self-hosted webfonts (woff2)
    │   ├── black-ops-one-*.woff2     # display face (1 weight)
    │   └── rajdhani-*.woff2          # body face (5 weights × 2 subsets)
    └── models/                  # GLB asset bundles
        ├── enemies/             # enemy meshes — kind-named at the root
        │   ├── skeleton.glb     # primary skin per kind
        │   ├── imp.glb
        │   ├── wraith.glb
        │   └── horror/          # extended horror roster (per-kind picks
        │                        # cycled deterministically by enemy id)
        ├── weapons/             # viewmodel meshes
        │   ├── pistol.glb       # ranged
        │   ├── chaingun.glb
        │   ├── shotgun.glb
        │   └── melee_*.glb      # melee (currently unwired; staged for
        │                        # the future melee slot)
        └── props/               # static environment props
            ├── door.glb
            ├── door_locked.glb
            ├── lamp_on.glb
            └── lamp_off.glb
```

## Adding new GLBs

1. Drop the file under the appropriate `public/assets/models/<kind>/`
   subdir. Keep the filename lowercase + snake_case.
2. Register the URL in `src/models.ts` via the `A()` helper:
   `url: A("/assets/models/enemies/horror/new_creature.glb")`.
3. If it's an enemy skin, add the entry to the per-kind roster array
   so `pickEnemySkin(kind, id)` will surface it.
4. Run `pnpm dev` and confirm the GLB loads at the dev URL. If it
   404s, check the path matches the on-disk file exactly.

## What does NOT belong here

- Source code — under `src/` or `app/`.
- Build outputs — under `dist/` (gitignored).
- Local-only references — under `references/` (gitignored).
