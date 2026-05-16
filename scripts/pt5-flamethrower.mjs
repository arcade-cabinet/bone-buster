/**
 * PT5 — flamethrower stream visual capture (E8 step-2). Selects
 * the flamethrower via the new debug hook, fires once toward the
 * densest enemy cluster, captures mid-stream (60ms) and tail
 * (220ms after the trigger pull).
 */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5191";
const OUT = "test-results/pt5-flamethrower";
await mkdir(OUT, { recursive: true });

async function captureCDP(page, path) {
	const session = await page.context().newCDPSession(page);
	const { data } = await session.send("Page.captureScreenshot", {
		format: "png",
		clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 },
	});
	const { writeFile } = await import("node:fs/promises");
	await writeFile(path, Buffer.from(data, "base64"));
}

const BROWSER_ARGS = [
	"--no-sandbox",
	"--mute-audio",
	"--window-position=9999,9999",
	"--use-angle=gl",
	"--enable-webgl",
	"--ignore-gpu-blocklist",
];

const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log(`  pageerror: ${err.message}`));

await page.goto(`${BASE}/?bonebusterDebug&bonebusterSeed=12345`, {
	waitUntil: "domcontentloaded",
});
await page.waitForFunction(() => Boolean(window.__bonebuster), { timeout: 8000 });
await page.evaluate(() => window.__bonebuster.start());
await page.locator("[data-testid='bonebuster-hp']").waitFor();
await page.evaluate(() => window.__bonebuster.collectAllPickups());
await page.evaluate(() => window.__bonebuster.selectWeapon("flamethrower"));
await page.waitForTimeout(300);

console.log("PT5.1 — fire flamethrower (frame 1: 60ms post-trigger, core stream)");
await page.evaluate(() => window.__bonebuster.fire());
await page.waitForTimeout(60);
await captureCDP(page, `${OUT}/01-flame-core.png`);

await page.waitForTimeout(160); // total 220ms
console.log("PT5.2 — frame 2: 220ms post-trigger, tail visible");
await captureCDP(page, `${OUT}/02-flame-tail.png`);

await page.evaluate(() => window.__bonebuster.fire());
await page.waitForTimeout(60);
await page.evaluate(() => window.__bonebuster.fire());
await page.waitForTimeout(60);
await page.evaluate(() => window.__bonebuster.fire());
await page.waitForTimeout(60);
console.log("PT5.3 — frame 3: sustained stream after 3 trigger pulls");
await captureCDP(page, `${OUT}/03-flame-sustained.png`);

await browser.close();
console.log("\nCaptured 3 flamethrower screenshots in", OUT);
