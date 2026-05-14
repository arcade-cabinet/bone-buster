/**
 * PT2 — per-archetype playtest capture. Drives the game into each of
 * the 5 archetypes (corridor / arena / courtyard / sewer / library)
 * via `?objexoomArchetype=...`, starts the game (which engages
 * pointer-lock-less via PT1A's debug bypass), grants flashlight +
 * weapons via collectAllPickups, and captures a clean in-game pose
 * at 1440×900 per archetype.
 *
 * Goal: verify per-archetype identity (POL3-v2 floors, POL27
 * darkness palette, brick wall textures) actually reads at runtime
 * across all 5, not just in canonical bytes (which use seed 0 =
 * corridor).
 */

import { chromium } from "@playwright/test";

const BASE = "http://localhost:5191";
const OUT = "test-results/pt2-archetypes";
const ARCHETYPES = ["corridor", "arena", "courtyard", "sewer", "library"];

async function captureCDP(page, path) {
	const work = (async () => {
		const session = await page.context().newCDPSession(page);
		const { data } = await session.send("Page.captureScreenshot", {
			format: "png",
			clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 },
		});
		const { writeFile } = await import("node:fs/promises");
		await writeFile(path, Buffer.from(data, "base64"));
	})();
	const timeout = new Promise((_, rej) =>
		setTimeout(() => rej(new Error("captureCDP timeout 8s")), 8000),
	);
	await Promise.race([work, timeout]);
}

const { mkdir } = await import("node:fs/promises");
await mkdir(OUT, { recursive: true });

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

for (const archetype of ARCHETYPES) {
	console.log(`PT2 — ${archetype}`);
	const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.on("pageerror", (err) => console.log(`  pageerror[${archetype}]: ${err.message}`));
	try {
		await page.goto(`${BASE}/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=${archetype}`, {
			waitUntil: "domcontentloaded",
		});
		await page.waitForFunction(() => Boolean(window.__objexoom), { timeout: 8000 });
		await page.evaluate(() => window.__objexoom.start());
		await page.locator("[data-testid='objexoom-hp']").waitFor({ timeout: 8000 });
		await page.evaluate(() => window.__objexoom.collectAllPickups());
		await page.waitForTimeout(800);
		await captureCDP(page, `${OUT}/${archetype}.png`);
	} catch (err) {
		console.log(`  FAILED[${archetype}]: ${err.message}`);
	}
	await browser.close().catch(() => {});
}
console.log(`\nCaptured ${ARCHETYPES.length} archetype screenshots in`, OUT);
