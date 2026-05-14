import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { BrowserProviderOption } from "vitest/node";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@app": path.resolve(__dirname, "./app"),
		},
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
					browser: {
						enabled: true,
						provider: "playwright" as unknown as BrowserProviderOption,
						headless: true,
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
