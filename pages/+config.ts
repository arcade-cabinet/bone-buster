/**
 * Vike root config — Bone Buster SPA prerender.
 *
 * Single-purpose: tell Vike to emit a fully-painted HTML shell at
 * build time so first paint shows pixels before the JS evaluates.
 * The shell is authored in `/pages/+onRenderHtml.tsx`; client mount
 * lives in `/pages/+onRenderClient.tsx`.
 *
 * We own the renderer hooks directly — no vike-react, no extension.
 * That means we don't get vike-react's auto-declared `ssr`, `title`,
 * etc., but we also don't need them since onRenderHtml reads its
 * title/description/CSP/meta from this file via the `meta` declaration
 * below + Vike's pageContext.config.
 */

import type { Config } from "vike/types";

export default {
	prerender: true,
	// Custom config keys our hooks read off pageContext.config.
	// Vike rejects unknown keys at startup unless we declare them
	// here.
	meta: {
		title: {
			env: { server: true, client: true },
		},
		description: {
			env: { server: true, client: true },
		},
	},
	title: "Bone Buster — They Had It Coming",
	description:
		"Bone Buster — a procedural arcade FPS in the PSX-jank tradition. They had it coming.",
	// `title` + `description` are meta-extended keys (declared above) —
	// they sit outside the static Config type, so the cast is required.
} as Config;
