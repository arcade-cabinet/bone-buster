/**
 * PT1 — playtest beat capture. Drives the game through a scripted
 * sequence via the `__objexoom` debug hooks + Playwright. Writes
 * screenshots at each beat to test-results/pt1-playtest/.
 */

import { chromium } from "@playwright/test";

const BASE = "http://localhost:5191";
const OUT = "test-results/pt1-playtest";

async function captureCDP(page, path) {
	const session = await page.context().newCDPSession(page);
	const { data } = await session.send("Page.captureScreenshot", {
		format: "png",
		clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 },
	});
	const { writeFile } = await import("node:fs/promises");
	await writeFile(path, Buffer.from(data, "base64"));
}

const browser = await chromium.launch({
	headless: true,
	args: ["--use-angle=gl", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log("PT1.1 — landing page");
await page.goto(`${BASE}/?objexoomDebug&objexoomSeed=12345`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await captureCDP(page, `${OUT}/01-landing.png`);

console.log("PT1.2 — engage + initial in-game pose (flashlight off)");
await page.waitForFunction(() => Boolean(window.__objexoom), { timeout: 5000 });
await page.evaluate(() => window.__objexoom.start());
await page.locator("[data-testid='objexoom-hp']").waitFor();
await page.waitForTimeout(600);
await captureCDP(page, `${OUT}/02-ingame-spawn.png`);

console.log("PT1.3 — collect flashlight + pickups, screenshot lit scene");
await page.evaluate(() => window.__objexoom.collectAllPickups());
await page.waitForTimeout(700);
await captureCDP(page, `${OUT}/03-ingame-flashlight.png`);

console.log("PT1.4 — fire current weapon");
await page.evaluate(() => window.__objexoom.fire());
await page.waitForTimeout(220);
await captureCDP(page, `${OUT}/04-fire.png`);

console.log("PT1.5 — kill all enemies (death gibs + score)");
await page.evaluate(() => window.__objexoom.killAllEnemies());
await page.waitForTimeout(450);
await captureCDP(page, `${OUT}/05-killall-debris.png`);

console.log("PT1.6 — collect key + capture POL22 ceremony");
await page.evaluate(() => window.__objexoom.collectKey());
await page.waitForTimeout(220);
await captureCDP(page, `${OUT}/06-key-acquired.png`);
await page.waitForTimeout(900);
await captureCDP(page, `${OUT}/07-key-aftermath.png`);

console.log("PT1.7 — trigger win → going_back phase");
await page.evaluate(() => {
	const hooks = window.__objexoom;
	const state = hooks.getState();
	const spawn = state.playerSpawn ?? { x: 4, y: 4 };
	const exit = state.exitPosition ?? { x: 12, y: 12 };
	const mx = (spawn.x + exit.x) / 2;
	const my = (spawn.y + exit.y) / 2;
	hooks.teleport(mx, my, 0);
	hooks.triggerWin();
});
await page.waitForTimeout(700);
await captureCDP(page, `${OUT}/08-going-back.png`);

console.log("PT1.8 — force mission-complete → capture PT1B ceremony");
// Short-circuit to status="won" via the dedicated debug hook so the
// PT1B MissionCompleteCeremony overlay renders. Grinding through
// RUN_LENGTH levels would require resolving a separate engine
// timing quirk (lastReachedSpawnAt persists across level
// transitions even though scene remounts — tracked under PT1E).
await page.evaluate(() => window.__objexoom.forceMissionComplete());
// Wait for: indigo vignette (0.6s), card spring (~0.6s), headline
// glow ramp (0.4 + 0.6 = 1.0s), 5x tick-up stagger (0.5 + 4*0.12 +
// 0.9 = 1.88s), CTA spring entry (1.1 + ~0.4 = 1.5s). 2200ms covers
// all animations to settled state.
await page.waitForTimeout(2200);
await captureCDP(page, `${OUT}/09-mission-complete.png`);

await browser.close();
console.log("\nCaptured 9 playtest screenshots in", OUT);
