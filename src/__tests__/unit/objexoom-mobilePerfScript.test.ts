/**
 * T5 — mobile perf snapshot script API-surface pin.
 *
 * The actual perf probe is impossible to unit-test (requires a
 * live Android emulator + Capacitor WebView + CDP endpoint). What
 * we CAN pin is that the script file exists, declares the right
 * floor constant, and routes via env vars the CI job sets.
 *
 * Pinning by source-text inspection so any rename / typo /
 * accidental edit of `MOBILE_FPS_FLOOR = 30` is caught here before
 * the CI job runs and silently passes with the wrong threshold.
 *
 * Source: TEST §7 recommendation 2.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = resolve(import.meta.dirname, "../../../scripts/obs3-perf-snapshot-mobile.mjs");

describe("T5 — obs3-perf-snapshot-mobile.mjs source pin", () => {
	const source = readFileSync(SCRIPT_PATH, "utf8");

	it("declares MOBILE_FPS_FLOOR = 30 (lower than desktop's 50)", () => {
		expect(source).toMatch(/MOBILE_FPS_FLOOR\s*=\s*30/);
	});

	it("reads CDP endpoint from MOBILE_CDP_ENDPOINT env var", () => {
		expect(source).toMatch(/process\.env\.MOBILE_CDP_ENDPOINT/);
	});

	it("reads WebView host from MOBILE_WEBVIEW_HOST env var, defaulting to https://localhost", () => {
		expect(source).toMatch(/process\.env\.MOBILE_WEBVIEW_HOST/);
		expect(source).toMatch(/https:\/\/localhost/);
	});

	it("probes the same 5 archetypes as desktop OBS3", () => {
		expect(source).toMatch(/\["corridor",\s*"arena",\s*"courtyard",\s*"sewer",\s*"library"\]/);
	});

	it("uses chromium.connectOverCDP (not launch) — drives a remote WebView", () => {
		expect(source).toMatch(/chromium\.connectOverCDP/);
		expect(source).not.toMatch(/chromium\.launch/);
	});

	it("samples for 5 seconds (longer than desktop's 3s to account for emulator warmup)", () => {
		expect(source).toMatch(/5000\s*\)/);
	});

	it("fails if minFps < floor OR if zero fpsUpdate events fired (stall detection)", () => {
		expect(source).toMatch(/sample\.minFps\s*<\s*MOBILE_FPS_FLOOR/);
		expect(source).toMatch(/sample\.minFps\s*==\s*null/);
	});

	it("uses the same PT1C teleport pose as the desktop OBS3 probe (worst-case framing)", () => {
		expect(source).toMatch(/__objexoom\.teleport/);
		expect(source).toMatch(/standoff\s*=\s*4/);
	});
});
