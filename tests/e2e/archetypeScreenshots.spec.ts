/**
 * INF4 — per-archetype canonical screenshots.
 *
 * The default canonical poses (`screenshots.spec.ts`) all use
 * seed 12345 which by `pickArchetype` lands on a single archetype.
 * E13 step-2's per-archetype lighting palettes and COV10 step-2's
 * courtyard wreck never appear in those defaults — so visual
 * regressions on the 4 non-canonical archetypes go uncaught.
 *
 * This spec uses the INF3 `?objexoomArchetype=<name>` flag to force
 * each of the 5 archetypes in turn, captures a single ingame
 * screenshot per archetype (flashlight ON so the palette tint is
 * easy to read), and writes to `test-results/objexoom-archetype-
 * screenshots/<archetype>.png`.
 *
 * Same browser-launch flags as the main screenshots spec — see
 * comments there for why ANGLE-GL is required.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page, test } from "@playwright/test";

type BoneBusterDebugHooks = {
	getState: () => unknown;
	start: () => void;
	teleport: (x: number, y: number, yawRad?: number) => void;
	collectAllPickups: () => void;
	fire: () => void;
};

const ARCHETYPES = ["corridor", "arena", "courtyard", "sewer", "library"] as const;
const OUT_DIR = "test-results/objexoom-archetype-screenshots";
const VIEWPORT = { width: 1440, height: 900 } as const;

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
		() => Boolean((window as unknown as { __objexoom?: unknown }).__objexoom),
		undefined,
		{ timeout: 15_000 },
	);
}

/**
 * T7-style frame-counted settle. Pumps N requestAnimationFrame ticks
 * in-page so slow CI agents get N REAL frames before capture, instead
 * of an arbitrary wall-time window.
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

async function withGame(baseURL: string, fn: (page: Page) => Promise<void>): Promise<void> {
	const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
	const context = await browser.newContext({
		baseURL,
		viewport: VIEWPORT,
		deviceScaleFactor: 1,
	});
	const page = await context.newPage();
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

test.describe("OBJEXOOM per-archetype screenshots (INF4)", () => {
	for (const archetype of ARCHETYPES) {
		test(`ingame — archetype: ${archetype}`, async () => {
			const testInfo = test.info();
			const baseURL =
				typeof testInfo.project.use.baseURL === "string"
					? testInfo.project.use.baseURL
					: "http://localhost:3000";
			await withGame(baseURL, async (page) => {
				await page.goto(`/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=${archetype}`, {
					waitUntil: "domcontentloaded",
				});
				await waitForHooks(page);
				await page.evaluate(() => {
					(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.start();
				});
				await page.locator("[data-testid='objexoom-hp']").waitFor();
				// Flashlight ON so the per-archetype palette tint reads
				// clearly. collectAllPickups grants the flashlight + all
				// weapons via the existing debug hook.
				await page.evaluate(() => {
					(
						window as unknown as { __objexoom: BoneBusterDebugHooks }
					).__objexoom.collectAllPickups();
				});
				// T7 — 45 frames (≈750ms @60fps) for SpotLight + shadow composite.
				await waitForFrames(page, 45);
				await captureViaCDP(page, `${OUT_DIR}/${archetype}.png`);
			});
		});
	}

	/**
	 * T3 — per-archetype surface poses. The base INF4 archetype tour
	 * captures each archetype at one wide pose; this block adds
	 * closer/oblique shots of each archetype's signature surface so
	 * regressions on (courtyard wreck, library kitchen, library NPCs,
	 * sewer water, corridor enemy-hit-flash) are caught at the visual
	 * gate instead of silently passing.
	 *
	 * Strategy: each test forces an archetype via INF3 + a seed picked
	 * to land near the signature surface in the procedural map; then
	 * teleports to a known-good vantage relative to the surface
	 * (read from getState()) and captures.
	 *
	 * Source: TEST audit §6.
	 */
	test("surface — courtyard COV10 wreck framing", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto("/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=courtyard", {
				waitUntil: "domcontentloaded",
			});
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.start();
			});
			await page.locator("[data-testid='objexoom-hp']").waitFor();
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.collectAllPickups();
			});
			// Teleport to the keyPosition vantage — courtyard wrecks scatter
			// near sector edges; centering on the key gives a typical
			// "player walks into the area" view.
			await page.evaluate(() => {
				const hooks = (window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom;
				const state = hooks.getState() as { keyPosition?: { x: number; y: number } };
				if (state.keyPosition) {
					hooks.teleport(state.keyPosition.x, state.keyPosition.y);
				}
			});
			await waitForFrames(page, 45);
			await captureViaCDP(page, `${OUT_DIR}/surface-courtyard-wreck.png`);
		});
	});

	test("surface — library COV13 kitchen scatter framing", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto("/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=library", {
				waitUntil: "domcontentloaded",
			});
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.start();
			});
			await page.locator("[data-testid='objexoom-hp']").waitFor();
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.collectAllPickups();
			});
			// Library exitPosition is in a far sector — that's where
			// COV13 kitchen sectors are likeliest to fire (20% per-sector
			// opt-in means a multi-sector tour to find one is typical).
			await page.evaluate(() => {
				const hooks = (window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom;
				const state = hooks.getState() as { exitPosition?: { x: number; y: number } };
				if (state.exitPosition) {
					hooks.teleport(state.exitPosition.x, state.exitPosition.y);
				}
			});
			await waitForFrames(page, 45);
			await captureViaCDP(page, `${OUT_DIR}/surface-library-kitchen.png`);
		});
	});

	test("surface — library COV14 NPC framing", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			// Different seed so the NPC scatter centroids land in a
			// different sector vs the kitchen pose.
			await page.goto("/?objexoomDebug&objexoomSeed=99&objexoomArchetype=library", {
				waitUntil: "domcontentloaded",
			});
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.start();
			});
			await page.locator("[data-testid='objexoom-hp']").waitFor();
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.collectAllPickups();
			});
			// Centroid of spawn + key = decent "indoor library" framing
			// where library NPCs (0-2/sector) are most likely to be in
			// frame.
			await page.evaluate(() => {
				const hooks = (window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom;
				const state = hooks.getState() as {
					playerSpawn?: { x: number; y: number };
					keyPosition?: { x: number; y: number };
				};
				if (state.playerSpawn && state.keyPosition) {
					hooks.teleport(
						(state.playerSpawn.x + state.keyPosition.x) / 2,
						(state.playerSpawn.y + state.keyPosition.y) / 2,
					);
				}
			});
			await waitForFrames(page, 45);
			await captureViaCDP(page, `${OUT_DIR}/surface-library-npcs.png`);
		});
	});

	test("surface — sewer water surface framing", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto("/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=sewer", {
				waitUntil: "domcontentloaded",
			});
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.start();
			});
			await page.locator("[data-testid='objexoom-hp']").waitFor();
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.collectAllPickups();
			});
			// Sewer water is a per-archetype surface tint; framing the
			// exit (typically in a deeper sector) reads the tint at
			// distance.
			await page.evaluate(() => {
				const hooks = (window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom;
				const state = hooks.getState() as { exitPosition?: { x: number; y: number } };
				if (state.exitPosition) {
					hooks.teleport(state.exitPosition.x, state.exitPosition.y);
				}
			});
			await waitForFrames(page, 45);
			await captureViaCDP(page, `${OUT_DIR}/surface-sewer-water.png`);
		});
	});

	test("surface — corridor enemy-hit-flash mid-burst (POL16)", async () => {
		const testInfo = test.info();
		const baseURL =
			typeof testInfo.project.use.baseURL === "string"
				? testInfo.project.use.baseURL
				: "http://localhost:3000";
		await withGame(baseURL, async (page) => {
			await page.goto("/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=corridor", {
				waitUntil: "domcontentloaded",
			});
			await waitForHooks(page);
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.start();
			});
			await page.locator("[data-testid='objexoom-hp']").waitFor();
			await page.evaluate(() => {
				(window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom.collectAllPickups();
			});
			// Teleport adjacent to the first enemy spawn, then fire to
			// trigger the POL16 layered damage burst (spark + smoke +
			// ember). Capture mid-burst.
			await page.evaluate(() => {
				const hooks = (window as unknown as { __objexoom: BoneBusterDebugHooks }).__objexoom;
				const state = hooks.getState() as {
					enemySpawns?: { position: { x: number; y: number } }[];
				};
				const target = state.enemySpawns?.[0]?.position;
				if (target) {
					hooks.teleport(target.x - 1.5, target.y);
				}
			});
			// Settle for facing, then fire.
			await waitForFrames(page, 15);
			await page.evaluate(() => {
				const hooks = (
					window as unknown as { __objexoom: BoneBusterDebugHooks & { fire: () => void } }
				).__objexoom;
				hooks.fire();
			});
			// Capture 5-10 frames into the burst so the particle wave
			// is mid-flight, not at peak (the wave gives the strongest
			// visual; POL16 is a layered burst so the mid-frame is
			// where the layering reads clearest).
			await waitForFrames(page, 8);
			await captureViaCDP(page, `${OUT_DIR}/surface-corridor-hit-flash.png`);
		});
	});
});
