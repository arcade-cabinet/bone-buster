/**
 * PC1 — Ghost Hunting Tools asset URL registry.
 *
 * Owns the URLs of the PSX Ghost Hunting Tools Release pack's
 * viewmodels. Step-1 (this commit) only wires the EMF reader, used
 * by the pickup mesh + the eventual viewmodel slot in a future
 * commit. PC2/PC3/PC4 extend this registry with spirit box / UV
 * flashlight / crucifix as those tools land.
 *
 * Kept separate from `src/assets/models.ts` (which carries weapon /
 * prop / door GLB urls) so the tool layer stays distinct from the
 * weapon-slot system — tools are passive readouts, not weapons.
 */

import { A } from "@assets/assetUrl";

export const TOOL_URLS = {
	emfReader: A("/assets/models/tools/emf_reader.glb"),
	spiritBox: A("/assets/models/tools/spirit_box.glb"),
	uvFlashlight: A("/assets/models/tools/uv_flashlight.glb"),
	crucifix: A("/assets/models/tools/crucifix.glb"),
} as const;

export type ToolUrlKey = keyof typeof TOOL_URLS;

/** Flat list for preloader iteration. */
export const TOOL_URL_LIST: readonly string[] = Object.values(TOOL_URLS);
