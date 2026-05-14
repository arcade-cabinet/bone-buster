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

type ObjexoomDebugHooks = {
	getState: () => unknown;
	start: () => void;
	teleport: (x: number, y: number, yawRad?: number) => void;
	collectAllPickups: () => void;
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
					(window as unknown as { __objexoom: ObjexoomDebugHooks }).__objexoom.start();
				});
				await page.locator("[data-testid='objexoom-hp']").waitFor();
				// Flashlight ON so the per-archetype palette tint reads
				// clearly. collectAllPickups grants the flashlight + all
				// weapons via the existing debug hook.
				await page.evaluate(() => {
					(window as unknown as { __objexoom: ObjexoomDebugHooks }).__objexoom.collectAllPickups();
				});
				// Settle frames for SpotLight + shadow map composite.
				await page.waitForTimeout(750);
				await captureViaCDP(page, `${OUT_DIR}/${archetype}.png`);
			});
		});
	}
});
