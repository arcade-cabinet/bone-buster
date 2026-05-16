/**
 * PT7 — mobile touch playtest. Emulates a Pixel-class viewport
 * (412×915) with touch + isMobile. Captures landing + in-game
 * to verify TouchControls visible at safe-area corners,
 * FireButton accessible, HUD readable, mission-complete CTA
 * tappable on small screen.
 */

import { mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

const OUT = "test-results/pt7-mobile";
await mkdir(OUT, { recursive: true });

async function captureCDP(page, path) {
	const session = await page.context().newCDPSession(page);
	const { data } = await session.send("Page.captureScreenshot", {
		format: "png",
		clip: { x: 0, y: 0, width: 412, height: 915, scale: 1 },
	});
	const { writeFile } = await import("node:fs/promises");
	await writeFile(path, Buffer.from(data, "base64"));
}

const browser = await chromium.launch({
	headless: true,
	args: [
		"--no-sandbox",
		"--mute-audio",
		"--use-angle=gl",
		"--enable-webgl",
		"--ignore-gpu-blocklist",
	],
});

const ctx = await browser.newContext({
	...devices["Pixel 5"],
	viewport: { width: 412, height: 915 },
});
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log(`  pageerror: ${err.message}`));

console.log("PT7.1 — landing on mobile");
await page.goto("http://localhost:5191/?bonebusterDebug&bonebusterSeed=12345", {
	waitUntil: "domcontentloaded",
});
await page.waitForTimeout(800);
await captureCDP(page, `${OUT}/01-landing.png`);

console.log("PT7.2 — ingame with touch controls");
await page.waitForFunction(() => Boolean(window.__bonebuster), { timeout: 8000 });
await page.evaluate(() => window.__bonebuster.start());
await page.locator("[data-testid='bonebuster-hp']").waitFor();
await page.evaluate(() => window.__bonebuster.collectAllPickups());
await page.waitForTimeout(800);
await captureCDP(page, `${OUT}/02-ingame.png`);

console.log("PT7.3 — mission complete ceremony on mobile (fresh ctx)");
await browser.close();
const browser2 = await chromium.launch({
	headless: true,
	args: [
		"--no-sandbox",
		"--mute-audio",
		"--use-angle=gl",
		"--enable-webgl",
		"--ignore-gpu-blocklist",
	],
});
const ctx2 = await browser2.newContext({
	...devices["Pixel 5"],
	viewport: { width: 412, height: 915 },
});
const page2 = await ctx2.newPage();
await page2.goto("http://localhost:5191/?bonebusterDebug&bonebusterSeed=12345", {
	waitUntil: "domcontentloaded",
});
await page2.waitForFunction(() => Boolean(window.__bonebuster), { timeout: 8000 });
await page2.evaluate(() => window.__bonebuster.start());
await page2.locator("[data-testid='bonebuster-hp']").waitFor();
await page2.evaluate(() => window.__bonebuster.forceMissionComplete());
await page2.waitForTimeout(2200);
await captureCDP(page2, `${OUT}/03-mission-complete.png`);
await browser2.close();
console.log("\nCaptured 3 mobile screenshots in", OUT);
