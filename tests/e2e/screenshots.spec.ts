/**
 * N1 — Regenerate `docs/assets/objexoom/` screenshots for the Phase 2
 * polish state. Captures 5 canonical poses:
 *
 *   1. landing.png             — DOOM-style menu
 *   2. ingame-flashlight-on.png — first-person, full lighting
 *   3. ingame-flashlight-off.png — first-person, dark-mode (J1)
 *   4. going-back-strobe.png   — going-back phase with light strobe (H8/J5)
 *   5. mission-complete.png    — MISSION COMPLETE overlay
 *
 * Implementation note: WebGL shadow maps + Playwright's default headless
 * SwiftShader backend deadlock on `page.screenshot`'s stability wait.
 * We mirror `tests/e2e/route-screenshots.spec.ts`: real ANGLE-GL backend,
 * offscreen window position, and CDP `Page.captureScreenshot` with an
 * explicit clip rect (which skips Playwright's stability gate).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page, test } from "@playwright/test";

type BoneBusterDebugHooks = {
	getState: () => unknown;
	start: () => void;
	teleport: (x: number, y: number, yawRad?: number) => void;
	fire: () => void;
	killAllEnemies: () => void;
	collectKey: () => void;
	collectAllPickups: () => void;
	triggerWin: () => void;
};

const DEBUG_URL = "/?bonebusterDebug&bonebusterSeed=12345";
const OUT_DIR = "test-results/objexoom-screenshots";
const VIEWPORT = { width: 1440, height: 900 } as const;

/**
 * T7 — wait N animation frames before screenshotting. More robust than
 * `page.waitForTimeout(ms)` because it scales with the actual frame
 * cadence (slow CI agents still get N real frames, fast agents don't
 * idle). Used to settle shadow-map composites + post-process passes
 * before a CDP screenshot capture. Replaces the prior
 * `page.waitForTimeout(900)` etc which were flake bait on contested
 * GH Actions runners.
 */
async function waitForFrames(page: Page, frameCount: number): Promise<void> {
	await page.evaluate(
		(n) =>
			new Promise<void>((resolve) => {
				let remaining = n;
				const tick = () => {
					remaining -= 1;
					if (remaining <= 0) resolve();
					else requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			}),
		frameCount,
	);
}

// Flags lifted from tests/e2e/route-screenshots.spec.ts — these enable
// the real GL backend (not SwiftShader) and place the window offscreen
// so the developer's actual display stays free. Headless still applies,
// but headless+ANGLE+GL renders shadow maps correctly where headless
// SwiftShader does not.
const BROWSER_ARGS = [
	"--no-sandbox",
	"--mute-audio",
	"--window-position=9999,9999",
	"--disable-background-timer-throttling",
	"--disable-backgrounding-occluded-windows",
	"--disable-renderer-backgrounding",
	"--use-angle=gl",
	"--enable-webgl",
	"--ignore-gpu-blocklist",
];

async function captureViaCDP(page: Page, outPath: string): Promise<void> {
	const session = await page.context().newCDPSession(page);
	try {
		await session.send("Page.enable");
		const { data } = (await session.send("Page.captureScreenshot", {
			format: "png",
			clip: {
				x: 0,
				y: 0,
				width: VIEWPORT.width,
				height: VIEWPORT.height,
				scale: 1,
			},
		})) as { data: string };
		await writeFile(outPath, Buffer.from(data, "base64"));
	} finally {
		await session.detach().catch(() => undefined);
	}
}

async function waitForHooks(page: Page): Promise<void> {
	await page.waitForFunction(
		() => Boolean((window as unknown as { __bonebuster?: unknown }).__bonebuster),
		undefined,
		{ timeout: 15_000 },
	);
}

// Each shot opens its own browser+context the same way
// runIsolatedRouteScreenshot does — guarantees the GL backend flags
// take effect (Playwright's `chromium` project doesn't accept --use-angle
// per-context, only per-launch).
async function withGame(baseURL: string, fn: (page: Page) => Promise<void>): Promise<void> {
	const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
	const context = await browser.newContext({
		baseURL,
		viewport: VIEWPORT,
		deviceScaleFactor: 1,
	});
	const page = await context.newPage();
	// Block external font loads — they stall page.screenshot's font-wait.
	await page.route(
		(url) =>
			url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com"),
		(route) => route.abort(),
	);
	try {
		await fn(page);
	} finally {
		await context.close().catch(() => undefined);
		await browser.close().catch(() => undefined);
	}
}

test.beforeAll(async () => {
	await mkdir(OUT_DIR, { recursive: true });
});

test.describe("OBJEXOOM screenshots (N1)", () => {
	test("01 landing — DOOM menu", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto(DEBUG_URL, { waitUntil: "domcontentloaded" });
			// R3 — Bone Buster wordmark is an inline SVG with
			// `role="img" aria-label="Bone Buster"`. The legacy <h1>
			// was removed when the wordmark moved to SVG.
			await page.getByRole("img", { name: /Bone Buster/i }).waitFor();
			// Wait for Bungee/Bungee-Inline/Bungee-Shade woff2 to land
			// before settling — capturing mid-load shows the fallback
			// (system stencil) which reads as flipped letterforms.
			await page.evaluate(() => document.fonts.ready);
			// Settle the staggered drop-in + 600ms Tilt Prism flicker
			// (~2.0s total from mount). 130 frames ≈ 2.2s at 60fps.
			await waitForFrames(page, 130);
			await captureViaCDP(page, `${OUT_DIR}/landing.png`);
		});
	});

	test("02 ingame — flashlight ON (full lighting)", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto(DEBUG_URL, { waitUntil: "domcontentloaded" });
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __bonebuster: BoneBusterDebugHooks }).__bonebuster.start();
			});
			await page.locator("[data-testid='bonebuster-hp']").waitFor();
			await page.evaluate(() => {
				(
					window as unknown as { __bonebuster: BoneBusterDebugHooks }
				).__bonebuster.collectAllPickups();
			});
			// T7 — 45 frames (≈750ms @60fps) settles SpotLight + shadow map composite.
			await waitForFrames(page, 45);
			await captureViaCDP(page, `${OUT_DIR}/ingame-flashlight-on.png`);
		});
	});

	test("03 ingame — flashlight OFF (dark mode)", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto(DEBUG_URL, { waitUntil: "domcontentloaded" });
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __bonebuster: BoneBusterDebugHooks }).__bonebuster.start();
			});
			await page.locator("[data-testid='bonebuster-hp']").waitFor();
			// T7 — 30 frames (≈500ms @60fps) for the dark-mode pose.
			await waitForFrames(page, 30);
			await captureViaCDP(page, `${OUT_DIR}/ingame-flashlight-off.png`);
		});
	});

	test("04 going-back strobe — H8/J5", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto(DEBUG_URL, { waitUntil: "domcontentloaded" });
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __bonebuster: BoneBusterDebugHooks }).__bonebuster.start();
			});
			await page.locator("[data-testid='bonebuster-hp']").waitFor();
			// Teleport AWAY from spawn before flipping to going_back —
			// `onReachSpawn` fires automatically when phase=going_back AND
			// player is within ~0.4 tiles of spawn. The player starts AT
			// spawn, so without this teleport the very next frame would
			// trip onReachSpawn and the LEVEL COMPLETE overlay would
			// render instead of the strobing going_back walk back.
			await page.evaluate(() => {
				const hooks = (window as unknown as { __bonebuster: BoneBusterDebugHooks }).__bonebuster;
				const state = hooks.getState() as {
					playerSpawn?: { x: number; y: number };
					exitPosition?: { x: number; y: number };
				};
				// Teleport about halfway between spawn and exit, facing the
				// exit's general direction — gives us a clean view of the
				// strobed lighting on real geometry, not a corner.
				const spawn = state.playerSpawn ?? { x: 4, y: 4 };
				const exit = state.exitPosition ?? { x: 12, y: 12 };
				const mx = (spawn.x + exit.x) / 2;
				const my = (spawn.y + exit.y) / 2;
				const dx = exit.x - spawn.x;
				const dy = exit.y - spawn.y;
				const yaw = Math.atan2(dx, -dy);
				hooks.teleport(mx, my, yaw);
				hooks.collectAllPickups();
				hooks.collectKey();
				hooks.triggerWin();
			});
			// T7 — 54 frames (≈900ms @60fps). The 200-frame strobe cycles
			// every ~3.3s; waiting 54 frames lands mid-bright AND gives
			// shadows time to fully composite.
			await waitForFrames(page, 54);
			await captureViaCDP(page, `${OUT_DIR}/going-back-strobe.png`);
		});
	});

	test("05 mission complete — full run cleared", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto(DEBUG_URL, { waitUntil: "domcontentloaded" });
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __bonebuster: BoneBusterDebugHooks }).__bonebuster.start();
			});
			await page.locator("[data-testid='bonebuster-hp']").waitFor();
			// Clear N levels: each level needs killAllEnemies + collectKey
			// + triggerWin (flips phase to going_back) + teleport-to-spawn
			// (engine fires onReachSpawn → status="transitioning" →
			// next level mounts). One full cycle per iteration.
			for (let i = 0; i < 6; i += 1) {
				await page.evaluate(() => {
					const hooks = (window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster;
					if (!hooks) return;
					hooks.killAllEnemies();
					hooks.collectKey();
					hooks.triggerWin();
					const state = hooks.getState() as { playerSpawn?: { x: number; y: number } };
					if (state.playerSpawn) {
						hooks.teleport(state.playerSpawn.x, state.playerSpawn.y, 0);
					}
				});
				// T7 — 54 frames per level-clear cycle (matches the pre-T7
				// 900ms cadence). Inside the for-loop because each
				// iteration triggers a full kill→key→win→teleport state
				// machine pass.
				await waitForFrames(page, 54);
			}
			await captureViaCDP(page, `${OUT_DIR}/mission-complete.png`);
		});
	});
});
