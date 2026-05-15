/**
 * POL31 — capture the difficulty-acknowledgment HUD chip for each of
 * the 5 difficulties. Validates the visual reads against design intent:
 * cool indigo at the easy end, hot blood-red at NIGHTMARE.
 *
 * Mirrors the PT2A/PT7 pattern of fresh browser-per-shot to avoid
 * Tone-graph collisions between successive starts.
 *
 * The difficulty is set via the `window.__objexoom.setDifficulty()`
 * debug hook (POL31), which mutates the React Settings state directly.
 * That's intentionally simpler than driving the landing Settings panel:
 * the panel is touch-hostile in Playwright and the chip rendering path
 * is identical regardless of which setter wrote the value.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const OUT = "test-results/pol31-difficulty-chip";
await mkdir(OUT, { recursive: true });

const DIFFICULTIES = ["tooYoung", "notTooRough", "hurtMePlenty", "ultraViolence", "nightmare"];

const LAUNCH_ARGS = [
	"--no-sandbox",
	"--mute-audio",
	"--use-angle=gl",
	"--enable-webgl",
	"--ignore-gpu-blocklist",
];

async function captureCDP(page, path) {
	const session = await page.context().newCDPSession(page);
	const { data } = await session.send("Page.captureScreenshot", {
		format: "png",
		clip: { x: 0, y: 0, width: 1280, height: 720, scale: 1 },
	});
	await writeFile(path, Buffer.from(data, "base64"));
}

for (const difficulty of DIFFICULTIES) {
	const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await ctx.newPage();
	page.on("pageerror", (err) => console.log(`  ${difficulty} pageerror: ${err.message}`));

	console.log(`POL31 — capturing ${difficulty}`);
	await page.goto("http://localhost:5191/?objexoomDebug&objexoomSeed=12345", {
		waitUntil: "domcontentloaded",
	});
	await page.waitForFunction(() => Boolean(window.__objexoom), { timeout: 8000 });
	await page.evaluate((diff) => window.__objexoom.setDifficulty(diff), difficulty);
	// Settings React state update flushes via setState — give it one
	// tick before starting so the next mount of HUDOverlays reads the
	// new settings.difficulty.
	await page.waitForTimeout(50);
	await page.evaluate(() => window.__objexoom.start());
	// Chip is shown for 2s — capture at ~700ms after start so we catch
	// the steady-state of the spring animation (post-settle).
	await page.waitForTimeout(700);
	await captureCDP(page, `${OUT}/${difficulty}.png`);
	await browser.close();
}

console.log("\nCaptured", DIFFICULTIES.length, "difficulty-chip screenshots in", OUT);
