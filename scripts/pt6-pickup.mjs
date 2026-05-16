/**
 * PT6 — pickup chip visual capture (POL30). Spawns into a map,
 * collects all pickups via the debug hook (which fires
 * onCollectPickup for each), and captures during the chip
 * animation window.
 */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const OUT = "test-results/pt6-pickup";
await mkdir(OUT, { recursive: true });

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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function captureCDP(path) {
	const session = await page.context().newCDPSession(page);
	const { data } = await session.send("Page.captureScreenshot", {
		format: "png",
		clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 },
	});
	const { writeFile } = await import("node:fs/promises");
	await writeFile(path, Buffer.from(data, "base64"));
}

await page.goto("http://localhost:5191/?bonebusterDebug&bonebusterSeed=12345", {
	waitUntil: "domcontentloaded",
});
await page.waitForFunction(() => Boolean(window.__bonebuster), { timeout: 8000 });
await page.evaluate(() => window.__bonebuster.start());
await page.locator("[data-testid='bonebuster-hp']").waitFor();

// collectAllPickups fires all in one tick, so only the last
// pickup's chip survives. Instead, dispatch a single pickup
// event directly to test the chip in isolation.
await page.evaluate(() => {
	const ev = new CustomEvent("objexoom:pickupCollected", { detail: { kind: "flashlight" } });
	window.dispatchEvent(ev);
});
await page.waitForTimeout(180);
await captureCDP(`${OUT}/01-flashlight.png`);

await page.waitForTimeout(800); // let it fade out
await page.evaluate(() => {
	const ev = new CustomEvent("objexoom:pickupCollected", { detail: { kind: "chaingunAmmo" } });
	window.dispatchEvent(ev);
});
await page.waitForTimeout(180);
await captureCDP(`${OUT}/02-chaingun.png`);

await page.waitForTimeout(800);
await page.evaluate(() => {
	const ev = new CustomEvent("objexoom:pickupCollected", { detail: { kind: "health" } });
	window.dispatchEvent(ev);
});
await page.waitForTimeout(180);
await captureCDP(`${OUT}/03-health.png`);

await browser.close();
console.log("\nCaptured PickupChip screenshot in", OUT);
