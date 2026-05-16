import path from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Vitest config (PRD §BC2). Aliases mirror vite.config.ts so both
 * builds resolve `@scene`, `@audio`, `@engine`, `@views`, etc.
 * identically. The post-RESTRUCTURE bucket aliases point at the
 * future destination dirs; the legacy `@` and `@app` aliases stay
 * for the pre-RESTRUCTURE flat layout.
 */
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@app": path.resolve(__dirname, "./app"),
			// Post-RESTRUCTURE bucketed aliases — must match vite.config.ts.
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
		},
		// Match the arcade-cabinet/voxel-realms pattern — browser-mode
		// vitest can otherwise load react/three from two paths
		// simultaneously and trip "Cannot read properties of undefined"
		// errors deep in the r3f reconciler.
		dedupe: ["react", "react-dom", "three"],
	},
	test: {
		// Two-project setup keeps fast unit tests separate from heavy
		// browser-mode tests. Unit runs in jsdom; browser drives a real
		// Chromium via @vitest/browser-playwright.
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					environment: "jsdom",
					include: ["src/__tests__/unit/**/*.test.{ts,tsx}"],
					setupFiles: [],
					globals: true,
				},
			},
			{
				extends: true,
				test: {
					name: "browser",
					include: ["src/__tests__/browser/**/*.test.{ts,tsx}"],
					// Browser tests touch r3f / Tone.js / Three GLB loading
					// which needs a non-trivial moment to settle.
					testTimeout: 30_000,
					browser: {
						enabled: true,
						// Match the e2e screenshot suite's ANGLE-GL launch
						// args — default SwiftShader deadlocks on shadow-map
						// composite. Headless by default so CI works; flip
						// off via HEADED=1 for local debugging.
						provider: playwright({
							launchOptions: {
								args: [
									"--use-angle=gl",
									"--enable-webgl",
									"--ignore-gpu-blocklist",
									"--no-sandbox",
									"--mute-audio",
								],
							},
						}),
						instances: [{ browser: "chromium" }],
						headless: process.env.HEADED !== "1",
					},
				},
			},
		],
	},
});
