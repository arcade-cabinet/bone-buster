import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	// `mode === "github-pages"` produces a build at /objexoom/ for the
	// objexiv-org gh-pages deploy; the default dev/build serves at /.
	base: mode === "github-pages" ? "/objexoom/" : "/",
	cacheDir: ".vite",
	build: {
		target: "es2022",
		// QW7 / SECURITY #1 — gh-pages builds drop sourcemaps entirely so
		// the public artifact doesn't leak the pnpm
		// `node_modules/.pnpm/<pkg>@<ver>_<deps>/...` dependency-version
		// fingerprint (a 10MB SBOM otherwise served to anyone with
		// DevTools open). Native (Capacitor) builds and dev keep
		// sourcemaps — they're packaged inside the APK / served only
		// from localhost.
		sourcemap: mode !== "github-pages",
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@app": path.resolve(__dirname, "./app"),
		},
	},
	server: {
		host: true,
		// Pinned away from Vite's default 5173 so OBJEXOOM doesn't
		// collide with other arcade dev servers running in parallel
		// (the playwright config pins to the same port).
		port: 5191,
		strictPort: true,
	},
	preview: {
		host: true,
		port: 8191,
		strictPort: true,
	},
}));
