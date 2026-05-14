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
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
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
