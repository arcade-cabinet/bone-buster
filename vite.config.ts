import { readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

const PKG_VERSION = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8"))
	.version as string;

/**
 * Bone Buster Vite config (PRD §BC1). Aligned with the canonical
 * arcade-cabinet/voxel-realms shape so `pnpm dev`, `pnpm build`,
 * and `pnpm test` resolve identically across sibling projects.
 *
 * Key changes versus the pre-BC1 config:
 *
 *   - `base` reads from `VITE_BASE_PATH` (BC3-driven) instead of
 *     a hardcoded mode→path map. Pages CI sets
 *     `VITE_BASE_PATH=/bone-buster/`; dev + native builds default to `/`.
 *   - `manualChunks` splits vendor bundles for smaller HTTP/2 fetches:
 *     `vendor-three` (three + three-stdlib), `vendor-react`
 *     (react + scheduler + react-dom), `vendor-postprocessing`
 *     (postprocessing + @react-three/postprocessing),
 *     `vendor-r3f` (@react-three/fiber, @react-three/drei),
 *     `vendor-howler` (howler — A11c-onwards), `vendor-sqlite`
 *     (@capacitor-community/sqlite, jeep-sqlite, sql.js, @stencil/core
 *     family), and `vendor-misc` for everything else.
 *   - `resolve.alias` matches the post-RESTRUCTURE `app/` + `src/`
 *     layout (`@scene`, `@audio`, `@engine`, `@views`, `@components`,
 *     `@atoms`, `@hooks`, etc.). The aliases survive both the
 *     pre-RESTRUCTURE flat `src/*` and the post-RESTRUCTURE bucketed
 *     layout because each `@x` points at the future destination dir;
 *     the existing `@` alias still resolves to `src/` so flat imports
 *     keep working during the transition.
 *   - `dedupe` keeps a single copy of react/react-dom/three so r3f's
 *     instanceof checks don't trip on the duplicate copies pnpm
 *     hoisting can create.
 *   - `optimizeDeps.include` pre-bundles the big CommonJS deps so
 *     the first dev-load doesn't show a flash-of-uncompiled-modules.
 */

function normalizeBasePath(value?: string): string {
	if (!value) return "/";
	const trimmed = value.trim();
	if (!trimmed || trimmed === "/") return "/";
	if (/^https?:\/\//.test(trimmed)) {
		return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
	}
	return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

const base = normalizeBasePath(process.env.VITE_BASE_PATH);

// Post-Vike: `vite build --mode github-pages` is rejected by Vike's CAC
// parser, so the "drop sourcemaps for pages deploys" gate moved from
// `mode` to an env var. CI sets PAGES_BUILD=1 alongside VITE_BASE_PATH.
const isPagesBuild = process.env.PAGES_BUILD === "1";

export default defineConfig(() => ({
	base,
	cacheDir: ".vite",
	plugins: [react(), vike()],
	define: {
		// Surfaced to client + prerender hooks so the version chip in the
		// landing skeleton stays in sync with release-please bumps instead
		// of drifting from a hardcoded literal.
		__BONEBUSTER_VERSION__: JSON.stringify(PKG_VERSION),
	},
	build: {
		target: "es2022",
		// QW7 / SECURITY #1 — gh-pages builds drop sourcemaps entirely so
		// the public artifact doesn't leak the pnpm
		// `node_modules/.pnpm/<pkg>@<ver>_<deps>/...` dependency-version
		// fingerprint. Native (Capacitor) builds + dev keep sourcemaps —
		// the APK is local-only and dev sourcemaps are dev-only.
		sourcemap: !isPagesBuild,
		chunkSizeWarningLimit: 1800,
		rollupOptions: {
			output: {
				chunkFileNames: "assets/chunks/[name]-[hash].js",
				// Vite 8 ships Rolldown, whose chunk-merge heuristic collapses
				// `manualChunks` returns back into the calling chunk whenever
				// the split would be "wasted" (single consumer). The result
				// was a 1.7MB monster `game-engine` chunk holding three +
				// r3f + postprocessing + yuka + howler + n8ao + troika.
				//
				// `advancedChunks.groups` is Rolldown's first-class split API.
				// Groups always materialise, regardless of consumer count, and
				// each `test` regex independently captures matching module ids.
				// The order matters: first matching group wins.
				advancedChunks: {
					groups: [
						{
							name: "vendor-three",
							test: /[\\/]node_modules[\\/](\.pnpm[\\/])?(three(@[^\\/]+)?[\\/]node_modules[\\/])?three[\\/]/,
						},
						{
							name: "vendor-three-stdlib",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?three-stdlib[\\/]/,
						},
						{
							name: "vendor-r3f",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?@react-three[\\/](fiber|drei)[\\/]/,
						},
						{
							name: "vendor-postprocessing",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?(postprocessing|@react-three[\\/]postprocessing|n8ao)[\\/]/,
						},
						{
							name: "vendor-troika",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?troika-/,
						},
						{
							name: "vendor-yuka",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?yuka[\\/]/,
						},
						{
							name: "vendor-howler",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?howler[\\/]/,
						},
						{
							name: "vendor-react",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?(react|react-dom|scheduler)[\\/]/,
						},
						{
							name: "vendor-motion",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?(framer-motion|motion-dom|motion-utils)[\\/]/,
						},
						{
							name: "vendor-sqlite",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?(@capacitor-community[\\/]sqlite|jeep-sqlite|sql\.js|@stencil|localforage)[\\/]/,
						},
						{
							name: "vendor-capacitor",
							test: /[\\/]node_modules[\\/]([^\\/]+[\\/])?@capacitor[\\/]/,
						},
						{
							name: "vendor-misc",
							test: /[\\/]node_modules[\\/]/,
						},
					],
				},
			},
		},
	},
	resolve: {
		alias: {
			// Legacy flat alias — survives the pre-RESTRUCTURE codebase.
			"@": path.resolve(__dirname, "./src"),
			"@app": path.resolve(__dirname, "./app"),
			// Post-RESTRUCTURE bucketed aliases. These point at the
			// FUTURE destination directories per PRD §RS1; the buckets
			// don't exist yet but the aliases survive the eventual
			// `git mv` because they target paths, not files.
			"@scene": path.resolve(__dirname, "src/scene"),
			"@audio": path.resolve(__dirname, "src/audio"),
			"@engine": path.resolve(__dirname, "src/engine"),
			"@ai": path.resolve(__dirname, "src/ai"),
			"@assets": path.resolve(__dirname, "src/assets"),
			"@store": path.resolve(__dirname, "src/store"),
			"@platform": path.resolve(__dirname, "src/platform"),
			"@shared": path.resolve(__dirname, "src/shared"),
			"@world": path.resolve(__dirname, "src/world"),
			"@views": path.resolve(__dirname, "app/views"),
			"@components": path.resolve(__dirname, "app/components"),
			"@atoms": path.resolve(__dirname, "app/atoms"),
			"@hooks": path.resolve(__dirname, "app/hooks"),
			"@styles": path.resolve(__dirname, "app/styles"),
			// Subpath alias kept — the addons mapping has no analogue in
			// dedupe + we do want all `three/addons` imports to land in
			// the official examples dir.
			"three/addons": path.resolve(__dirname, "node_modules/three/examples/jsm"),
			// Note: we used to alias react/react-dom/three to their
			// node_modules package roots, but that forced Vite to load
			// CommonJS index.js files directly — which Vike's SSR
			// module-runner can't evaluate (it ESM-only and chokes on
			// the bare `module.exports = ...`). `dedupe` below already
			// gives us the "single hoisted copy" guarantee r3f needs
			// for its instanceof checks.
		},
		dedupe: ["react", "react-dom", "three"],
	},
	optimizeDeps: {
		include: [
			"react",
			"react-dom",
			"react-dom/client",
			"three",
			"@react-three/fiber",
			"@react-three/drei",
			"@react-three/postprocessing",
			"postprocessing",
			"framer-motion",
			"howler",
		],
	},
	server: {
		host: true,
		// Pinned away from Vite's default 5173 so Bone Buster doesn't
		// collide with sibling arcade-cabinet dev servers (Playwright
		// config pins to the same port).
		port: 5191,
		strictPort: true,
	},
	preview: {
		host: true,
		port: 8191,
		strictPort: true,
	},
}));
