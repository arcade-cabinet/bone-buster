import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
 *     `vendor-tone` (tone — until AUDIO removes it), `vendor-sqlite`
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

export default defineConfig(({ mode }) => ({
	base,
	cacheDir: ".vite",
	plugins: [react()],
	build: {
		target: "es2022",
		// QW7 / SECURITY #1 — gh-pages builds drop sourcemaps entirely so
		// the public artifact doesn't leak the pnpm
		// `node_modules/.pnpm/<pkg>@<ver>_<deps>/...` dependency-version
		// fingerprint. Native (Capacitor) builds + dev keep sourcemaps —
		// the APK is local-only and dev sourcemaps are dev-only.
		sourcemap: mode !== "github-pages",
		chunkSizeWarningLimit: 1800,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (id.includes(`${path.sep}three${path.sep}`) || id.includes("three-stdlib")) {
							return "vendor-three";
						}
						if (
							id.includes(`${path.sep}react${path.sep}`) ||
							id.includes(`${path.sep}react-dom${path.sep}`) ||
							id.includes("scheduler")
						) {
							return "vendor-react";
						}
						if (id.includes("@react-three/fiber") || id.includes("@react-three/drei")) {
							return "vendor-r3f";
						}
						if (id.includes("postprocessing") || id.includes("@react-three/postprocessing")) {
							return "vendor-postprocessing";
						}
						if (id.includes(`${path.sep}tone${path.sep}`)) {
							return "vendor-tone";
						}
						if (id.includes(`${path.sep}howler${path.sep}`)) {
							return "vendor-howler";
						}
						if (
							id.includes("@capacitor-community/sqlite") ||
							id.includes("jeep-sqlite") ||
							id.includes("sql.js") ||
							id.includes("@stencil") ||
							id.includes("localforage")
						) {
							return "vendor-sqlite";
						}
						if (id.includes("@capacitor")) {
							return "vendor-capacitor";
						}
						if (id.includes("framer-motion") || id.includes("motion-utils")) {
							return "vendor-motion";
						}
						return "vendor-misc";
					}
					// Project-internal split: heavy sim/engine/scene chunks
					// stay together so a single React Suspense boundary
					// pulls them as one network request rather than waterfall.
					if (
						id.includes(`${path.sep}src${path.sep}engine`) ||
						id.includes(`${path.sep}src${path.sep}scene`) ||
						id.includes(`${path.sep}src${path.sep}buildMap`) ||
						id.includes(`${path.sep}src${path.sep}enemyAi`) ||
						id.includes(`${path.sep}src${path.sep}barrels`) ||
						id.includes(`${path.sep}src${path.sep}models`) ||
						id.includes(`${path.sep}src${path.sep}weapons`)
					) {
						return "game-engine";
					}
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
			// Dedupe-targets — pinned to the hoisted copy so r3f's
			// instanceof checks don't trip on parallel React copies.
			react: path.resolve(__dirname, "node_modules/react"),
			"react-dom": path.resolve(__dirname, "node_modules/react-dom"),
			"three/addons": path.resolve(__dirname, "node_modules/three/examples/jsm"),
			three: path.resolve(__dirname, "node_modules/three"),
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
			"tone",
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
