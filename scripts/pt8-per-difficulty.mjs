/**
 * PT8 — per-difficulty playtest capture pass.
 *
 * Drives the game at each of the 5 difficulties via
 * `__objexoom.setDifficulty()` (POL31 debug hook) and captures 3
 * beats per difficulty:
 *
 *   01-landing    — landing menu before NEW GAME (validates the chip
 *                   doesn't show until start).
 *   02-ingame     — first frame in-game with the DifficultyChip
 *                   (POL31) live + initial HP bar.
 *   03-mid-run    — after collectAllPickups + killAllEnemies + the
 *                   teleport+frame trick from PT1C so the going-back
 *                   phase + low-HP warning state become visible.
 *
 * 15 captures total (5 × 3). Mirrors the PT7 fresh-browser-per-shot
 * pattern to avoid Tone-graph collisions; using a fresh browser per
 * difficulty also guarantees the persisted-settings hydration path
 * isn't leaking state across runs.
 *
 * Manual review: each difficulty's mid-run shot should READ as
 * different from the others — NIGHTMARE should look bloodier (more
 * enemies live + lower HP), TOO YOUNG TO DIE should look gentler.
 * If two adjacent difficulties produce visually identical mid-run
 * shots, that's a difficulty-curve regression: surface as PT8A+.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const OUT = "test-results/pt8-per-difficulty";
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

	// Clear any persisted STO1a settings blob BEFORE the shell hydrates
	// so the difficulty isn't pre-set by a prior run leaking through
	// Playwright's per-context storage. Capacitor Preferences's web
	// shim stores under the `CapacitorStorage.` prefix.
	await page.addInitScript(() => {
		try {
			localStorage.removeItem("CapacitorStorage.objexoom.settings");
		} catch {
			// ignore — clean profile is best-effort
		}
	});

	console.log(`PT8 — capturing ${difficulty}`);
	await page.goto("http://localhost:5191/?objexoomDebug&objexoomSeed=12345", {
		waitUntil: "domcontentloaded",
	});
	await page.waitForFunction(() => Boolean(window.__objexoom), { timeout: 8000 });
	// Wait one tick for the async settings hydration to settle BEFORE
	// applying the per-test override — otherwise the hydration race
	// can clobber our setDifficulty() call.
	await page.waitForTimeout(120);
	// Wait for the difficulty to actually propagate through React
	// state by polling settings.difficulty via the debug hook. Without
	// the poll the start() call races the setSettings flush and the
	// run boots with the OLD difficulty's tuning.
	await page.evaluate(async (diff) => {
		const before = window.__objexoom.getSettings().difficulty;
		window.__objexoom.setDifficulty(diff);
		const start = performance.now();
		while (performance.now() - start < 3000) {
			const current = window.__objexoom.getSettings().difficulty;
			if (current === diff) {
				await new Promise((r) => setTimeout(r, 50));
				return;
			}
			await new Promise((r) => setTimeout(r, 20));
		}
		const after = window.__objexoom.getSettings().difficulty;
		throw new Error(
			`setDifficulty(${diff}) did not propagate within 3s; before=${before} after=${after}`,
		);
	}, difficulty);

	// 01 — landing (chip not yet visible)
	await captureCDP(page, `${OUT}/${difficulty}-01-landing.png`);

	// 02 — ingame, fresh spawn pose. Wait past the 2-second
	// DifficultyChip window so the capture shows the steady-state
	// in-game HUD (HP bar at full, KILLS 0/N where N varies by
	// enemyCountMultiplier — this is the actual difficulty-feel
	// signal the playtest pass cares about).
	await page.evaluate(() => window.__objexoom.start());
	await page.locator("[data-testid='objexoom-hp']").waitFor();
	await page.waitForTimeout(2400);
	await captureCDP(page, `${OUT}/${difficulty}-02-ingame.png`);

	// 03 — mid-run state: collect pickups + kill all enemies, capture
	// the resulting going-back-phase or LOW HP warning. Mirrors PT1C
	// camera-framing trick: teleport to a vantage near the enemy
	// cluster centroid before triggering kills so the bursts land in
	// frame.
	await page.evaluate(async () => {
		const s = window.__objexoom.getState();
		if (s.enemySpawns?.length > 0) {
			// Approach the nearest enemy along the player→enemy vector,
			// stop 3 tiles back, rotate camera to face them.
			const player = s.playerSpawn;
			const target = s.enemySpawns[0].position;
			const dx = target.x - player.x;
			const dy = target.y - player.y;
			const dist = Math.hypot(dx, dy);
			if (dist > 0) {
				const ux = dx / dist;
				const uy = dy / dist;
				const standoff = 3;
				const px = target.x - ux * standoff;
				const py = target.y - uy * standoff;
				const yaw = Math.atan2(ux, uy);
				window.__objexoom.teleport(px, py, yaw);
			}
		}
		window.__objexoom.collectAllPickups();
		window.__objexoom.killAllEnemies();
	});
	await page.waitForTimeout(900); // past POL12 hitstop + POL16 burst peak
	await captureCDP(page, `${OUT}/${difficulty}-03-mid-run.png`);

	await browser.close();
}

console.log("\nCaptured", DIFFICULTIES.length * 3, "per-difficulty playtest screenshots in", OUT);
