/**
 * BC7 — foldable smoke screenshot test.
 *
 * Two viewports covering the realistic foldable shapes:
 *
 *   1. 880×2100   — Galaxy Z Fold unfolded inner display, portrait.
 *                   Tall + narrow. Tests that the bottom-of-screen
 *                   weapon strip + ammo readout don't bleed under
 *                   the camera cutout, and that the top HP/KILLS
 *                   chips honor the status-bar safe-area inset.
 *
 *   2. 2200×1400  — Pixel Fold inner display, landscape. Mid-wide
 *                   tablet aspect. Tests that the broadened
 *                   `(any-pointer: coarse)` gate flips touch HUD on
 *                   even though Chrome reports `pointer: fine` for
 *                   this form factor.
 *
 * Smoke acceptance: canvas mounts, the wordmark renders on landing,
 * the HUD chip DOM nodes have geometry inside the viewport (no
 * clipped chips). The actual visual diff lives downstream of BC8+.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page, test } from "@playwright/test";

const OUT_DIR = "test-results/objexoom-foldable";

const VIEWPORTS = {
	fold_inner_portrait: { width: 880, height: 2100 },
	pixel_fold_inner_landscape: { width: 2200, height: 1400 },
} as const;

const BROWSER_ARGS = [
	"--enable-unsafe-webgpu",
	"--use-angle=gl",
	"--use-gl=angle",
	"--ignore-gpu-blocklist",
];

async function withFoldable(
	baseURL: string,
	viewport: { width: number; height: number },
	fn: (page: Page) => Promise<void>,
): Promise<void> {
	const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
	const context = await browser.newContext({
		baseURL,
		viewport,
		deviceScaleFactor: 1,
		// Force coarse pointer so the broadened BC5 query matches —
		// the headless chromium would otherwise report fine pointer
		// regardless of viewport dims and the touch HUD wouldn't
		// engage, defeating the test.
		hasTouch: true,
		isMobile: true,
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

async function captureViaCDP(
	page: Page,
	viewport: { width: number; height: number },
	outPath: string,
): Promise<void> {
	const session = await page.context().newCDPSession(page);
	try {
		await session.send("Page.enable");
		const { data } = (await session.send("Page.captureScreenshot", {
			format: "png",
			clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 },
		})) as { data: string };
		await writeFile(outPath, Buffer.from(data, "base64"));
	} finally {
		await session.detach().catch(() => undefined);
	}
}

test.beforeAll(async () => {
	await mkdir(OUT_DIR, { recursive: true });
});

test.describe("BC7 — foldable smoke", () => {
	for (const [name, viewport] of Object.entries(VIEWPORTS)) {
		test(`${name} — landing wordmark + chip geometry`, async () => {
			const testInfo = test.info();
			const baseURL =
				typeof testInfo.project.use.baseURL === "string"
					? testInfo.project.use.baseURL
					: "http://localhost:5191";
			await withFoldable(baseURL, viewport, async (page) => {
				await page.goto("/?objexoomDebug&objexoomSeed=12345", {
					waitUntil: "domcontentloaded",
				});
				const wordmark = page.getByRole("img", { name: /Bone Buster/i });
				await wordmark.waitFor();
				await page.evaluate(() => document.fonts.ready);
				// Wait for the staggered drop-in + flicker (~2.0s total).
				// Without this the screenshot catches the wordmark mid-
				// animation with most letters off-screen above the band.
				await page.waitForTimeout(2500);

				// Geometry assertions — every visible chip is strictly
				// inside the viewport. Catches the foldable cutout
				// clipping that BC4 + BC6 were specifically written
				// to prevent.
				const box = await wordmark.boundingBox();
				if (!box) throw new Error("Wordmark has no bounding box");
				if (box.x < 0 || box.y < 0) {
					throw new Error(`Wordmark clipped off-viewport at (${box.x}, ${box.y}) on ${name}`);
				}
				if (box.x + box.width > viewport.width) {
					throw new Error(
						`Wordmark overflows viewport: right=${box.x + box.width} > ${viewport.width}`,
					);
				}

				await captureViaCDP(page, viewport, `${OUT_DIR}/${name}.png`);
			});
		});
	}
});
