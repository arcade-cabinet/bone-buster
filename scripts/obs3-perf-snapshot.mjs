/**
 * OBS3 — automatic perf-budget snapshot per archetype.
 *
 * For each of the 5 archetypes (corridor / arena / courtyard / sewer
 * / library), launches a fresh browser, drives the game to a known
 * pose (in-game + flashlight on + the PT1C teleport-toward-cluster
 * vantage so the perf-heavy scene state is in frame), samples the
 * OBS1 fpsUpdate events over a 3-second window, captures the peak
 * drawCalls + peak triangles, and writes the result to
 * `test-results/perf-snapshots/{archetype}.json`.
 *
 * Compares against `tests/perf-baselines/{archetype}.json`
 * (gitignored test-results/ would lose these — baselines live under
 * tests/ specifically so they stay tracked, are reviewable in PRs,
 * and CI can compare against them). Fails with non-zero exit code if:
 *   - any archetype crosses the OBS3 thresholds (1000 calls / 100k tris
 *     — looser than OBS2's per-frame caps; see comment below)
 *   - any archetype regresses > 10% above its baseline
 *
 * The baseline JSONs are seeded on first run (any missing file is
 * written from the current snapshot + the run still passes). After
 * the first run, the baselines should be reviewed by a human +
 * committed.
 *
 * OBS4 — CI runs this as a separate `perf` job in .github/workflows/ci.yml.
 * To update a baseline intentionally (e.g. a new effect lifted the
 * triangle count by 12% in arena):
 *   1. Run locally: `pnpm test:perf` — it'll fail with the new value.
 *   2. Copy the new value from `test-results/perf-snapshots/{archetype}.json`
 *      into `tests/perf-baselines/{archetype}.json`.
 *   3. Commit both the source change AND the baseline bump in the same PR
 *      so the reviewer can see the cost.
 *   4. CI re-runs perf on the PR; passes with the new baseline.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const SNAPSHOT_DIR = "test-results/perf-snapshots";
// Baselines must be tracked in git (test-results/ is gitignored).
// Reviewed once per archetype + committed; the OBS3 regression check
// reads from here every run.
const BASELINE_DIR = "tests/perf-baselines";

const ARCHETYPES = ["corridor", "arena", "courtyard", "sewer", "library"];

// OBS3 budgets are intentionally LOOSER than OBS2's per-frame caps.
// OBS2 fires on per-frame draw-calls > 400 sustained across 3 windows
// (effectively a "panic, the render path is broken" alarm). OBS3
// samples peak-per-window across a 3-second budget window with the
// camera framing the densest enemy cluster (PT1C trick) — the
// pathological case. Measured shipped values: corridor 828 / arena
// 494 / courtyard 887 / sewer 651 / library 502 — all healthy frame
// rates in practice. The OBS3 budget is set to 1000 calls / 100k
// triangles, which is ~15-20% headroom above the worst measured
// archetype; baselines provide the per-archetype regression check
// for finer-grained tracking.
const OBS3_CALL_BUDGET = 1000;
const OBS3_TRI_BUDGET = 100_000;
const REGRESSION_RATIO = 1.1; // 10% above baseline = fail

const LAUNCH_ARGS = [
	"--no-sandbox",
	"--mute-audio",
	"--use-angle=gl",
	"--enable-webgl",
	"--ignore-gpu-blocklist",
];

async function readJsonIfExists(path) {
	try {
		const raw = await readFile(path, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

// OBS4 fix — host configurable via env so CI can hit `vite preview`
// (port 8191) instead of `vite dev` (port 5191). The previous hardcoded
// dev-port URL silently failed in CI because no dev server is started
// there; locally the assumption was that `pnpm dev` is already running.
const PREVIEW_HOST = process.env.OBS3_HOST || "http://localhost:5191";

async function snapshotArchetype(archetype) {
	const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await ctx.newPage();

	// Pin to the archetype via the INF3 URL override + a deterministic seed.
	const url = `${PREVIEW_HOST}/?objexoomDebug&objexoomSeed=12345&objexoomArchetype=${archetype}`;
	await page.goto(url, { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() => Boolean(window.__objexoom), { timeout: 8000 });

	// Boot the run.
	await page.evaluate(() => window.__objexoom.start());
	await page.locator("[data-testid='objexoom-hp']").waitFor();

	// Frame the densest enemy cluster (PT1C trick) so the scene's
	// worst-case render is what we sample.
	await page.evaluate(() => {
		const s = window.__objexoom.getState();
		if (s.enemySpawns?.length > 0) {
			const player = s.playerSpawn;
			const target = s.enemySpawns[0].position;
			const dx = target.x - player.x;
			const dy = target.y - player.y;
			const dist = Math.hypot(dx, dy);
			if (dist > 0) {
				const ux = dx / dist;
				const uy = dy / dist;
				const standoff = 4;
				const px = target.x - ux * standoff;
				const py = target.y - uy * standoff;
				const yaw = Math.atan2(ux, uy);
				window.__objexoom.teleport(px, py, yaw);
			}
		}
	});

	// Sample the OBS1 fpsUpdate stream for 3 seconds, tracking peak.
	const sample = await page.evaluate(
		() =>
			new Promise((resolve) => {
				let peakCalls = 0;
				let peakTris = 0;
				let frames = 0;
				const handler = (e) => {
					const detail = e.detail ?? {};
					if (typeof detail.drawCalls === "number" && detail.drawCalls > peakCalls) {
						peakCalls = detail.drawCalls;
					}
					if (typeof detail.triangles === "number" && detail.triangles > peakTris) {
						peakTris = detail.triangles;
					}
					frames += 1;
				};
				window.addEventListener("objexoom:fpsUpdate", handler);
				setTimeout(() => {
					window.removeEventListener("objexoom:fpsUpdate", handler);
					resolve({ peakCalls, peakTris, frames });
				}, 3000);
			}),
	);

	await browser.close();
	return sample;
}

await mkdir(SNAPSHOT_DIR, { recursive: true });
await mkdir(BASELINE_DIR, { recursive: true });

const failures = [];
const seedingBaselines = [];

for (const archetype of ARCHETYPES) {
	console.log(`OBS3 — sampling ${archetype}…`);
	const sample = await snapshotArchetype(archetype);
	const snapshotPath = `${SNAPSHOT_DIR}/${archetype}.json`;
	await writeFile(snapshotPath, `${JSON.stringify(sample, null, 2)}\n`);

	const baselinePath = `${BASELINE_DIR}/${archetype}.json`;
	const baseline = await readJsonIfExists(baselinePath);

	console.log(
		`  → calls peak ${sample.peakCalls} (budget ${OBS3_CALL_BUDGET}) · tris peak ${sample.peakTris} (budget ${OBS3_TRI_BUDGET}) · frames sampled ${sample.frames}`,
	);

	// OBS3 budget check.
	if (sample.peakCalls > OBS3_CALL_BUDGET) {
		failures.push(`${archetype}: calls peak ${sample.peakCalls} > OBS3 budget ${OBS3_CALL_BUDGET}`);
	}
	if (sample.peakTris > OBS3_TRI_BUDGET) {
		failures.push(
			`${archetype}: triangles peak ${sample.peakTris} > OBS3 budget ${OBS3_TRI_BUDGET}`,
		);
	}

	// Regression check against committed baseline.
	if (baseline) {
		const callsRatio = sample.peakCalls / Math.max(1, baseline.peakCalls);
		const trisRatio = sample.peakTris / Math.max(1, baseline.peakTris);
		if (callsRatio > REGRESSION_RATIO) {
			failures.push(
				`${archetype}: calls regressed ${(callsRatio * 100 - 100).toFixed(1)}% above baseline (${sample.peakCalls} vs ${baseline.peakCalls})`,
			);
		}
		if (trisRatio > REGRESSION_RATIO) {
			failures.push(
				`${archetype}: triangles regressed ${(trisRatio * 100 - 100).toFixed(1)}% above baseline (${sample.peakTris} vs ${baseline.peakTris})`,
			);
		}
	} else {
		// Seed the baseline on first run; surface for human review.
		await writeFile(baselinePath, `${JSON.stringify(sample, null, 2)}\n`);
		seedingBaselines.push(archetype);
	}
}

if (seedingBaselines.length > 0) {
	console.log(`\nOBS3 seeded baselines for: ${seedingBaselines.join(", ")}`);
	console.log("Review the JSONs under tests/perf-baselines/ and commit them.");
}

if (failures.length > 0) {
	console.error("\nOBS3 — perf budget / regression failures:");
	for (const f of failures) console.error(`  - ${f}`);
	process.exit(1);
}

console.log("\nOBS3 — all 5 archetypes within budget + baseline.");
