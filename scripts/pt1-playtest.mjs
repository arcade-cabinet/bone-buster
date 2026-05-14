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
// PT1C — teleport NEAR the closest enemy (3 tiles back along the
// player→enemy vector) and face it, so the killAllEnemies fan of
// POL16 burst + POL25 body-parts + POL14 chromatic-aberration
// lands directly inside the flashlight cone. Enemy spawn coords
// are state.enemySpawns[i].position (nested), not state.enemySpawns[i].
await page.evaluate(() => {
	const hooks = window.__objexoom;
	const state = hooks.getState();
	const spawns = state.enemySpawns ?? [];
	const player = state.playerSpawn ?? { x: 4, y: 4 };
	if (spawns.length === 0) return;
	let best = spawns[0].position;
	let bestD2 = Infinity;
	for (const s of spawns) {
		const p = s.position;
		const d2 = (p.x - player.x) ** 2 + (p.y - player.y) ** 2;
		if (d2 < bestD2) {
			bestD2 = d2;
			best = p;
		}
	}
	const dx = best.x - player.x;
	const dy = best.y - player.y;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	// Vantage 3 tiles back from the enemy along the player→enemy
	// vector. Enemy is forward and inside flashlight cone (which
	// reaches ~6 tiles).
	const vx = best.x - ux * 3;
	const vy = best.y - uy * 3;
	const yaw = Math.atan2(ux, -uy);
	hooks.teleport(vx, vy, yaw);
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__objexoom.killAllEnemies());
// Hitstop pauses sim for 80ms (POL12) / 150ms boss; lighting
// updates can hesitate during that window. 300ms catches burst at
// peak (POL16 lifetime is 600ms) with sim fully running and
// shadows recomposited.
await page.waitForTimeout(300);
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

console.log("PT1.8 — clear remaining levels → mission complete");
// PT1E fixed: when settings.level is the final refLevel, the
// transition handler now routes to status="won" instead of
// bouncing back to "playing". Each onReachSpawn fires
// automatically when the player is at spawn + phase=going_back,
// so all we need to do is keep teleporting the player to spawn
// after each level mounts. Poll status until "won".
const start = Date.now();
while (Date.now() - start < 12000) {
	const s = await page.evaluate(() => {
		const hooks = window.__objexoom;
		const st = hooks.getState();
		if (st.status === "playing" && st.phase === "going_back") {
			const spawn = st.playerSpawn ?? { x: 4, y: 4 };
			hooks.teleport(spawn.x, spawn.y, 0);
		}
		return st.status;
	});
	if (s === "won") break;
	await page.waitForTimeout(200);
}
// Wait for ceremony animations to settle (PT1B timeline: 2.2s).
await page.waitForTimeout(2200);
await captureCDP(page, `${OUT}/09-mission-complete.png`);

await browser.close();
console.log("\nCaptured 9 playtest screenshots in", OUT);
