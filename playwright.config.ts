import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: "http://localhost:5191",
		trace: "on-first-retry",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
				// CR-e2e-hooks — drive the gameplay specs on the SAME real GL
				// backend the screenshot specs already use (they launch their own
				// chromium with these flags because --use-angle is launch-only).
				// Default headless SwiftShader both deadlocks on the shadow-map
				// composite AND starves react-dom's HUD commit behind r3f's
				// useFrame loop (the HUD renders the new value but the DOM
				// mutation never flushes — see the CR-e2e-hooks investigation).
				// ANGLE-GL + the anti-throttling flags match real hardware, where
				// the starvation never occurs. This is the repo's standing GL
				// choice (CLAUDE.md: "never revert this fix"), now applied to the
				// gameplay specs too.
				launchOptions: {
					args: [
						"--no-sandbox",
						"--mute-audio",
						"--disable-background-timer-throttling",
						"--disable-backgrounding-occluded-windows",
						"--disable-renderer-backgrounding",
						"--use-angle=gl",
						"--enable-webgl",
						"--ignore-gpu-blocklist",
					],
				},
			},
		},
	],
	webServer: {
		// Pin OBJEXOOM to a unique port so it never collides with
		// other arcade dev servers in the same shell — `reuseExistingServer`
		// would happily attach to a totally different project on 5173
		// (Vite's default), which masquerades as a green dev server and
		// produces blank screenshots.
		command: "pnpm dev",
		url: "http://localhost:5191",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
