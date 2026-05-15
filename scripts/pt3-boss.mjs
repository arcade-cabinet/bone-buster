/**
 * PT3 — boss encounter visual audit. Loads a procedural map (arena
 * archetype, seed 12345), finds the boss-tier enemy, teleports the
 * camera to face it from 3 tiles, captures a "boss in frame"
 * pre-kill pose, then triggers killAllEnemies and captures the
 * boss-death moment (POL12 150ms hitstop + POL19 100ms stagger +
 * POL10-v2 boss-death sting).
 *
 * Judges: does the boss read as a BOSS MOMENT (silhouette weight,
 * audio sting, hitstop+stagger combine), or just a "bigger enemy"?
 */

import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5191";
const OUT = "test-results/pt3-boss";

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

console.log("PT3.1 — load arena, find boss");
await page.goto(`${BASE}/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=arena`, {
	waitUntil: "domcontentloaded",
});
await page.waitForFunction(() => Boolean(window.__objexoom), { timeout: 8000 });
await page.evaluate(() => window.__objexoom.start());
await page.locator("[data-testid='objexoom-hp']").waitFor();
await page.evaluate(() => window.__objexoom.collectAllPickups());
await page.waitForTimeout(400);

// E2 boss-pick rule: farthest spawn from player.playerSpawn becomes
// the boss-tier enemy. Mirror that here to find the boss target.
const bossInfo = await page.evaluate(() => {
	const state = window.__objexoom.getState();
	const spawns = state.enemySpawns ?? [];
	const player = state.playerSpawn ?? { x: 4, y: 4 };
	if (spawns.length === 0) return null;
	let best = spawns[0].position;
	let bestD2 = -Infinity;
	for (const s of spawns) {
		const p = s.position;
		const d2 = (p.x - player.x) ** 2 + (p.y - player.y) ** 2;
		if (d2 > bestD2) {
			bestD2 = d2;
			best = p;
		}
	}
	return { target: best, player };
});

if (!bossInfo) {
	console.log("PT3 — no enemy spawns; bailing");
	await browser.close();
	process.exit(0);
}

const { target, player } = bossInfo;
console.log(
	`PT3.2 — teleport near nearest enemy at (${target.x.toFixed(1)}, ${target.y.toFixed(1)})`,
);
await page.evaluate(
	({ target, player }) => {
		const hooks = window.__objexoom;
		const dx = target.x - player.x;
		const dy = target.y - player.y;
		const len = Math.hypot(dx, dy) || 1;
		const ux = dx / len;
		const uy = dy / len;
		// 5 tiles back from target, facing it. Boss is 1.6x scale +
		// POL29 emissive rim — closer than 5 tiles fills the frame.
		hooks.teleport(target.x - ux * 5, target.y - uy * 5, Math.atan2(ux, -uy));
	},
	{ target, player },
);
await page.waitForTimeout(500);
await captureCDP(page, `${OUT}/01-pre-kill.png`);

console.log("PT3.3 — killBoss (isolated POL10-v2 boss-death sting + 150ms hitstop)");
await page.evaluate(() => window.__objexoom.killBoss());
// Mid-hitstop (boss=150ms) and mid-burst capture.
await page.waitForTimeout(120);
await captureCDP(page, `${OUT}/02-death-moment.png`);

// 400ms more — body parts settling, sting tail, while regular
// enemies remain alive (proves the boss kill was isolated).
await page.waitForTimeout(400);
await captureCDP(page, `${OUT}/03-post-death.png`);

const after = await page.evaluate(() => {
	const state = window.__objexoom.getState();
	const enemies = state.enemySpawns ?? [];
	return { totalEnemies: state.totalEnemies, kills: state.kills, enemyCount: enemies.length };
});
console.log(`PT3 — after killBoss: ${JSON.stringify(after)}`);

await browser.close();
console.log("\nCaptured 3 boss screenshots in", OUT);
