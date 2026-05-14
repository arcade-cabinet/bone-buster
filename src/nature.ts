/**
 * COV11 step-1 — outdoor nature pack.
 *
 * Stages `Mega_Nature.glb` from `3DPSX/Fantasy/PSX MEGA Nature Pack/`.
 * This is a scene-aggregate GLB containing many individual nature
 * meshes (bushes / trees / grass tufts). Step-2 will SkeletonUtils-
 * clone individual children out for the courtyard-archetype seasonal
 * scatter pass per PRD §COV11.
 *
 * Step-1 ships only the asset URL — the picker shape can stay simple
 * since there's a single aggregate. The "5 seasons × ~40 bushes" +
 * "44 trees" + "12 grass tufts" claims in the directive refer to the
 * full nature collection; this lean step ships one MEGA pack that
 * covers the visual surface with low overhead (232 KB total).
 */

import { A } from "./assetUrl";

export const NATURE_MEGA_PACK_URL: string = A("/assets/models/props/nature/Mega_Nature.glb");
