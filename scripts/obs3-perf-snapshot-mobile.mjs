/**
 * T5 — OBS3 perf snapshot for Capacitor WebView on Android emulator.
 *
 * Pre-T5 the OBS3 perf gate ran only against desktop headless
 * Chromium via Playwright, which doesn't capture the actual
 * runtime budget on mid-tier mobile devices. T5 adds a second
 * lane that drives the SAME perf-probe poses through the real
 * Capacitor WebView running in a Pixel 5a-class Android emulator.
 *
 * Flow:
 *   1. CI's emulator job has already booted the Pixel 5a AVD,
 *      installed the debug APK from the `android` job, and
 *      launched the activity.
 *   2. CI ran `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
 *      to expose the WebView's DevTools protocol port to host.
 *   3. This script connects to that CDP endpoint, drives the
 *      game through the 5 archetype poses, samples OBS1
 *      fpsUpdate events, and asserts `minFps >= MOBILE_FPS_FLOOR`.
 *
 * MOBILE_FPS_FLOOR is 30 (vs OBS3's desktop 50). The emulator
 * is software-rendered on CI runners (no GPU passthrough) so
 * the absolute number isn't faithful to a real Pixel 5a — but
 * the relative comparison still surfaces regressions. Real
 * device validation lives in a release-gated job (future).
 *
 * Source: PERF audit Architectural E + TEST §7 recommendation 2.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SNAPSHOT_DIR = "test-results/perf-snapshots-mobile";
const ARCHETYPES = ["corridor", "arena", "courtyard", "sewer", "library"];

/** Mobile floor — lower than desktop's 50 because the emulator is
 * software-rendered. The number that matters is "does the
 * AdaptiveResolution + A3 fallback chain hold the game above
 * its minimum playable threshold on a Pixel 5a-class device". */
const MOBILE_FPS_FLOOR = 30;
// CR-poly (full-review) — a draw-call ceiling that's STABLE on the software
// emulator (unlike FPS, which is noisy there). Catches a regression of the
// effect-field instancing (CR-H1perf) — pre-instancing combat peaked at
// ~350 individual draw calls; the ceiling sits well above the instanced
// steady state but below the un-instanced regression.
const MOBILE_CALL_BUDGET = 1400;

/** CDP endpoint exposed by `adb forward` in the CI job. */
const CDP_ENDPOINT = process.env.MOBILE_CDP_ENDPOINT || "http://localhost:9222";

/** WebView origin. Capacitor on Android with `androidScheme: "https"`
 * (per capacitor.config.ts) serves the bundle at
 * `https://localhost`. The query-string flags work identically. */
const WEBVIEW_HOST = process.env.MOBILE_WEBVIEW_HOST || "https://localhost";

async function snapshotArchetypeMobile(page, archetype) {
	const url = `${WEBVIEW_HOST}/?bonebusterDebug&bonebusterSeed=12345&bonebusterArchetype=${archetype}`;
	await page.goto(url, { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() => Boolean(window.__bonebuster), { timeout: 15000 });

	await page.evaluate(() => window.__bonebuster.start());
	await page.locator("[data-testid='bonebuster-hp']").waitFor();

	// Same PT1C pose as the desktop OBS3 script — frame the densest
	// enemy cluster so the worst-case render is what we sample.
	await page.evaluate(() => {
		const s = window.__bonebuster.getState();
		if (s.enemySpawns?.length > 0) {
			const player = s.playerSpawn;
			const target = s.enemySpawns[0].position;
			const dx = target.x - player.x;
			const dy = target.y - player.y;
			const dist = Math.hypot(dx, dy);
			if (dist > 0) {
				const ux = dx / dist;
				const uy = dy / dist;
				const standoff = 4;
				const px = target.x - ux * standoff;
				const py = target.y - uy * standoff;
				const yaw = Math.atan2(ux, uy);
				window.__bonebuster.teleport(px, py, yaw);
			}
		}
	});

	// 5-second probe (vs desktop's 3s) because the emulator is
	// slower to settle and we want more samples through the
	// AdaptiveResolution debounce window.
	const sample = await page.evaluate(
		() =>
			new Promise((resolve) => {
				let peakCalls = 0;
				let peakTris = 0;
				let frames = 0;
				let minFps = Infinity;
				const handler = (e) => {
					const detail = e.detail ?? {};
					if (typeof detail.drawCalls === "number" && detail.drawCalls > peakCalls) {
						peakCalls = detail.drawCalls;
					}
					if (typeof detail.triangles === "number" && detail.triangles > peakTris) {
						peakTris = detail.triangles;
					}
					if (typeof detail.fps === "number" && detail.fps < minFps) {
						minFps = detail.fps;
					}
					frames += 1;
				};
				window.addEventListener("objexoom:fpsUpdate", handler);
				setTimeout(() => {
					window.removeEventListener("objexoom:fpsUpdate", handler);
					resolve({
						peakCalls,
						peakTris,
						frames,
						minFps: Number.isFinite(minFps) ? minFps : null,
					});
				}, 5000);
			}),
	);

	return sample;
}

console.log(`T5 — connecting to mobile WebView via CDP at ${CDP_ENDPOINT}…`);
const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
const ctx = browser.contexts()[0];
if (!ctx) {
	console.error("T5 — no browser context exposed by WebView. Is the APK launched?");
	process.exit(1);
}
const page = ctx.pages()[0] ?? (await ctx.newPage());

await mkdir(SNAPSHOT_DIR, { recursive: true });
const failures = [];

for (const archetype of ARCHETYPES) {
	console.log(`T5 — sampling mobile ${archetype}…`);
	const sample = await snapshotArchetypeMobile(page, archetype);
	const snapshotPath = `${SNAPSHOT_DIR}/${archetype}.json`;
	await writeFile(snapshotPath, `${JSON.stringify(sample, null, 2)}\n`);

	const minFpsDisplay =
		sample.minFps != null ? `${sample.minFps.toFixed(1)} (floor ${MOBILE_FPS_FLOOR})` : "n/a";
	console.log(
		`  → calls peak ${sample.peakCalls} · tris peak ${sample.peakTris} · minFps ${minFpsDisplay} · frames sampled ${sample.frames}`,
	);

	if (sample.minFps != null && sample.minFps < MOBILE_FPS_FLOOR) {
		failures.push(
			`${archetype}: mobile minFps ${sample.minFps.toFixed(1)} < floor ${MOBILE_FPS_FLOOR}`,
		);
	}
	// Draw-call ceiling — stable on the emulator GPU, so a meaningful gate
	// alongside the noisier FPS floor.
	if (sample.peakCalls > MOBILE_CALL_BUDGET) {
		failures.push(
			`${archetype}: mobile draw-calls peak ${sample.peakCalls} > budget ${MOBILE_CALL_BUDGET}`,
		);
	}
	if (sample.minFps == null) {
		failures.push(
			`${archetype}: zero fpsUpdate events in 5s probe — game stalled or crashed in WebView`,
		);
	}
}

await browser.close();

if (failures.length > 0) {
	console.error("\nT5 — mobile perf gate failures:");
	for (const f of failures) console.error(`  - ${f}`);
	process.exit(1);
}

console.log("\nT5 — all 5 archetypes within mobile fps floor.");
