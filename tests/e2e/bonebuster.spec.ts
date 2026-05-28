/**
 * Bone Buster end-to-end smoke. Drives the game in a real Chromium
 * via Playwright. Tests cover:
 *   - landing page renders + screenshots
 *   - NEW GAME → difficulty → level → game start
 *   - real enemy-vs-player damage tick (debug-teleport an enemy within
 *     LOS and confirm HP drops in the HUD)
 *   - player kills enemy via the fire event
 *   - key pickup + portal interaction (debug hooks)
 * The debug hooks (`?bonebusterDebug`) are required because pointer-lock
 * + canvas-keyed input are hostile to scripted automation. The hooks
 * are gated to non-production builds.
 */

import { expect, test } from "@playwright/test";

type BoneBusterDebugHooks = {
	getState: () => unknown;
	start: () => void;
	teleport: (x: number, y: number, yawRad?: number) => void;
	fire: () => void;
	killAllEnemies: () => void;
	collectKey: () => void;
	collectAllPickups: () => void;
	triggerWin: () => void;
};

const DEBUG_URL = "/?bonebusterDebug&bonebusterSeed=12345";

const PLAYER_HUD = "[data-testid='bonebuster-hp']";
const KILLS_HUD = "[data-testid='bonebuster-kills']";
const KEY_HUD = "[data-testid='bonebuster-key']";

test.describe("Bone Buster — headed Chromium", () => {
	test("landing page renders the DOOM menu", async ({ page }) => {
		await page.goto(DEBUG_URL);

		// R8 rebrand — the wordmark is an SVG with role="img" aria-label="Bone
		// Buster" (no text heading). Was a stale `/OBJEXOOM/` heading assertion.
		await expect(page.getByRole("img", { name: /Bone Buster/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /NEW GAME/ })).toBeVisible();
		await expect(page.getByRole("button", { name: /OPTIONS/ })).toBeVisible();
		await expect(page.getByRole("button", { name: /HOW TO PLAY/ })).toBeVisible();
		await expect(page.getByRole("button", { name: /QUIT/ })).toBeVisible();

		await page.screenshot({
			path: "test-results/bonebuster-landing.png",
			fullPage: true,
			animations: "disabled",
			caret: "hide",
			timeout: 45_000,
		});
	});

	test("NEW GAME → difficulty → level → game starts via debug hook", async ({ page }) => {
		await page.goto(DEBUG_URL);

		// Walk the menu UI like a real player.
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await expect(page.getByRole("button", { name: /HURT ME PLENTY/ })).toBeVisible();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await expect(page.getByRole("button", { name: /^RANDOM$/ })).toBeVisible();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();

		// Game should be playing — HUD elements appear.
		await expect(page.locator(PLAYER_HUD)).toBeVisible({ timeout: 5_000 });
		await expect(page.locator(KILLS_HUD)).toBeVisible();
		await expect(page.locator(KEY_HUD)).toBeVisible();

		// Sanity: getState() exposes the right snapshot.
		const state = await page.evaluate(() =>
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.getState(),
		);
		expect(state).toBeDefined();
		expect((state as { status: string }).status).toBe("playing");

		await page.screenshot({
			path: "test-results/bonebuster-ingame.png",
			fullPage: true,
			animations: "disabled",
			caret: "hide",
			timeout: 45_000,
		});
	});

	test("enemy damage ticks player HP down when in range", async ({ page }) => {
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(PLAYER_HUD)).toBeVisible({ timeout: 5_000 });

		const initialHp = await page.locator(PLAYER_HUD).innerText();
		const initialHpPart = initialHp.split("/")[0];
		if (initialHpPart === undefined) throw new Error("HP text has no '/' separator");
		const initialHpNum = Number.parseInt(initialHpPart.trim(), 10);

		// Teleport the player on top of the first enemy spawn so the AI is
		// guaranteed to land hits within the next few seconds.
		await page.evaluate(() => {
			const state = (
				window as unknown as { __bonebuster?: BoneBusterDebugHooks }
			).__bonebuster?.getState() as
				| { enemySpawns: { position: { x: number; y: number } }[] }
				| undefined;
			const target = state?.enemySpawns[0]?.position;
			if (!target) throw new Error("no enemy spawn");
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.teleport(
				target.x + 1.2,
				target.y + 1.2,
			);
		});

		// Wait up to 20s for HP to drop. Rattler cooldown is 900ms so one hit
		// should land within ~2s once LOS settles — but headed Chromium with
		// postprocessing pegged can stretch that significantly.
		await expect
			.poll(
				async () => {
					const text = await page.locator(PLAYER_HUD).innerText();
					const part = text.split("/")[0];
					if (part === undefined) throw new Error("HP text has no '/' separator");
					return Number.parseInt(part.trim(), 10);
				},
				{
					timeout: 20_000,
					intervals: [400, 800, 1200, 1600, 2000, 2500, 3000],
				},
			)
			.toBeLessThan(initialHpNum);
	});

	test("player kills all enemies via debug hook → kill counter saturates", async ({ page }) => {
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(KILLS_HUD)).toBeVisible({ timeout: 5_000 });

		const before = await page.locator(KILLS_HUD).innerText();
		const [killsBefore, total] = before.split("/").map((s) => Number(s.trim()));
		expect(killsBefore).toBe(0);
		expect(total).toBeGreaterThan(0);

		// Wait for the AnimatePresence transition + Scene useEffect to register
		// the debug listeners.
		await page.waitForFunction(
			() => {
				const hooks = (window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster;
				const s = hooks?.getState() as { status?: string } | undefined;
				return s?.status === "playing";
			},
			{ timeout: 5_000 },
		);
		await page.waitForTimeout(500);

		// Retry kill-all up to 6 s — listener registration is on a useEffect
		// and may race the first dispatch.
		await expect
			.poll(
				async () => {
					await page.evaluate(() => {
						(
							window as unknown as { __bonebuster?: BoneBusterDebugHooks }
						).__bonebuster?.killAllEnemies();
					});
					return (await page.locator(KILLS_HUD).innerText()).trim();
				},
				{ timeout: 6_000, intervals: [250, 500, 1000, 1500, 1500] },
			)
			.toContain(`${total} / ${total}`);
	});

	test("key pickup flips the HUD to KEY ACQUIRED", async ({ page }) => {
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(KEY_HUD)).toContainText(/FIND THE KEY/, {
			timeout: 5_000,
		});

		await page.evaluate(() => {
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.collectKey();
		});

		await expect(page.locator(KEY_HUD)).toContainText(/KEY ACQUIRED/, {
			timeout: 3_000,
		});
	});

	test("portal interaction triggers LEVEL COMPLETE on first clear", async ({ page }) => {
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(PLAYER_HUD)).toBeVisible({ timeout: 5_000 });

		await page.evaluate(() => {
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.triggerWin();
		});

		// First win in a run flips status to "transitioning" — overlay renders
		// the LEVEL COMPLETE card before the next-level fade. Full MISSION
		// COMPLETE (5 levels cleared) is exercised by the B5 chained-run test.
		await expect(page.getByRole("heading", { name: /LEVEL COMPLETE/ })).toBeVisible({
			timeout: 3_000,
		});

		await page.screenshot({
			path: "test-results/bonebuster-level-complete.png",
			animations: "disabled",
			caret: "hide",
			timeout: 45_000,
		});
	});

	test("B5 — chained run advances 5 levels via triggerWin", async ({ page }) => {
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(PLAYER_HUD)).toBeVisible({ timeout: 5_000 });

		// Drive 5 wins. Each onWin() flips status to transitioning, holds 800ms,
		// then flips back to playing. After the 5th, status flips to "won" and
		// the MISSION COMPLETE overlay renders with run stats.
		for (let i = 0; i < 5; i += 1) {
			await page.evaluate(() => {
				(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.triggerWin();
			});
			// 1s > 800ms transition hold + a margin
			await page.waitForTimeout(1100);
		}

		await expect(page.getByRole("heading", { name: /MISSION COMPLETE/ })).toBeVisible({
			timeout: 3_000,
		});
		// Verify run stats string is in the overlay body.
		await expect(page.getByText(/LEVELS? CLEARED/)).toBeVisible();
		await expect(page.getByText(/TIME \d+:\d{2}/)).toBeVisible();
	});

	test("B5 — level 2 reachable via real exit-portal win on level 1", async ({ page }) => {
		// Regression for the level-transition Scene-state bug: prior to the
		// `key={settings.level}-${seed}` fix, lastWonAt latched true on level
		// 1's natural win and level 2's exit collision could never re-fire.
		// This test exercises the real win path (collect key + teleport to
		// exit) twice to prove the rebuilt Scene picks up the new map.
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(PLAYER_HUD)).toBeVisible({ timeout: 5_000 });

		for (let level = 0; level < 2; level += 1) {
			// Collect the key first so the door opens.
			await page.evaluate(() => {
				(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.collectKey();
			});
			await expect(page.locator(KEY_HUD)).toContainText(/KEY ACQUIRED/, {
				timeout: 3_000,
			});

			// H8 — hitting the exit flips phase to "going_back", not
			// LEVEL COMPLETE. To clear the level we must then walk back
			// to spawn (onReachSpawn fires the actual win). Capture
			// both before the teleports because the second teleport
			// will dispatch through the same hook.
			const positions = await page.evaluate(() => {
				const state = (
					window as unknown as { __bonebuster?: BoneBusterDebugHooks }
				).__bonebuster?.getState() as
					| {
							exitPosition: { x: number; y: number };
							playerSpawn: { x: number; y: number };
					  }
					| undefined;
				if (!state) throw new Error("no debug state");
				return { exit: state.exitPosition, spawn: state.playerSpawn };
			});

			// Step 1: teleport to exit, flips phase → going_back.
			await page.evaluate((exit) => {
				(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.teleport(
					exit.x,
					exit.y,
				);
			}, positions.exit);
			// Poll for the phase flip rather than sleeping a fixed window —
			// the Scene's proximity check runs once per useFrame tick.
			await page.waitForFunction(
				() => {
					const s = (
						window as unknown as { __bonebuster?: BoneBusterDebugHooks }
					).__bonebuster?.getState() as { phase?: string } | undefined;
					return s?.phase === "going_back";
				},
				{ timeout: 4_000 },
			);

			// Step 2: teleport back to spawn, fires onReachSpawn →
			// LEVEL COMPLETE.
			await page.evaluate((spawn) => {
				(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.teleport(
					spawn.x,
					spawn.y,
				);
			}, positions.spawn);

			await expect(page.getByRole("heading", { name: /LEVEL COMPLETE/ })).toBeVisible({
				timeout: 4_000,
			});

			// Wait past the 800ms transition for the next level to mount.
			await page.waitForTimeout(1100);
			await expect(page.locator(KEY_HUD)).toContainText(/FIND THE KEY/, {
				timeout: 4_000,
			});
		}
	});

	// N5 — full Lv1 reference-grade playthrough without the triggerWin
	// shortcut. Exercises the entire pipeline from a player's seat:
	// start → collect key (natural pickup hook) → walk to exit
	// (teleport waypoint) → cross threshold (phase flips to going_back
	// via Scene's own win check, NOT triggerWin) → walk back to spawn
	// (teleport waypoint) → onReachSpawn fires → LEVEL COMPLETE overlay.
	// Proves the goal/going-back/reach-spawn loop fires from real
	// geometry-driven proximity, not the debug shortcut.
	test("N5 — full Lv1 playthrough (no triggerWin shortcut)", async ({ page }) => {
		await page.goto(DEBUG_URL);
		await page.getByRole("button", { name: /NEW GAME/ }).click();
		await page.getByRole("button", { name: /HURT ME PLENTY/ }).click();
		await page.getByRole("button", { name: /^RANDOM$/ }).click();
		// SEED3 — the procedural ("RANDOM") level now routes through the seed
		// pane; BEGIN starts the run on the suggested phrase.
		await expect(page.getByRole("button", { name: /^BEGIN$/ })).toBeVisible();
		await page.getByRole("button", { name: /^BEGIN$/ }).click();
		await expect(page.locator(PLAYER_HUD)).toBeVisible({ timeout: 5_000 });

		// Capture starting positions for the round-trip teleport.
		const positions = await page.evaluate(() => {
			const hooks = (window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster;
			if (!hooks) throw new Error("no debug hooks");
			const s = hooks.getState() as {
				playerSpawn: { x: number; y: number };
				exitPosition: { x: number; y: number };
			};
			return { spawn: s.playerSpawn, exit: s.exitPosition };
		});
		expect(positions.spawn.x).toBeGreaterThan(0);
		expect(positions.exit.x).toBeGreaterThan(0);

		// Phase 1 — out. Grab the key (natural pickup hook, not
		// triggerWin), then teleport onto the exit so the Scene's own
		// proximity-check flips phase → going_back.
		await page.evaluate(() => {
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.collectKey();
		});
		await expect(page.locator(KEY_HUD)).toContainText(/KEY ACQUIRED/);

		await page.evaluate((exit) => {
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.teleport(
				exit.x,
				exit.y,
			);
		}, positions.exit);

		// Phase 2 — going_back. Poll for phase=going_back rather than
		// sleeping a fixed window — the Scene's exit-proximity check
		// runs once per useFrame tick and a flaky 300ms sleep on cold
		// Vite-dev pages can pre-empt it. Once phase flips, teleport
		// away from the exit so we don't immediately satisfy reach-spawn.
		await page.waitForFunction(
			() => {
				const s = (
					window as unknown as { __bonebuster?: BoneBusterDebugHooks }
				).__bonebuster?.getState() as { phase?: string } | undefined;
				return s?.phase === "going_back";
			},
			{ timeout: 4_000 },
		);
		const midpoint = {
			x: (positions.spawn.x + positions.exit.x) / 2,
			y: (positions.spawn.y + positions.exit.y) / 2,
		};
		await page.evaluate((mid) => {
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.teleport(
				mid.x,
				mid.y,
			);
		}, midpoint);
		await expect(page.locator(KEY_HUD)).toContainText(/KEY ACQUIRED/);

		// Phase 3 — reach spawn. Teleport back to the original spawn so
		// the Scene's proximity-check fires onReachSpawn → LEVEL COMPLETE.
		await page.evaluate((spawn) => {
			(window as unknown as { __bonebuster?: BoneBusterDebugHooks }).__bonebuster?.teleport(
				spawn.x,
				spawn.y,
			);
		}, positions.spawn);

		await expect(page.getByRole("heading", { name: /LEVEL COMPLETE/ })).toBeVisible({
			timeout: 4_000,
		});
	});
});
