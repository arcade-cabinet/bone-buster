/**
 * Headless WebGL probe — reproduces the e2e-screenshot harness in a
 * single process so console errors / asset-load failures / CSP
 * violations surface BEFORE they silently rot the canonical
 * screenshots. Was authored to catch a CSP regression where
 * `connect-src 'self'` blocked the `blob:` + `data:` URIs that
 * GLTFLoader uses to decode GLB-embedded textures, causing every
 * ingame screenshot to render a black canvas while the HUD overlay
 * (real DOM, not WebGL) painted fine.
 *
 * Usage:
 *   pnpm dev   # in another terminal
 *   node scripts/probe-headless.mjs
 *
 * Output: console JSON of canvas + GL backend + state, a list of
 * any errors / warnings, and a PNG at test-results/probe-headless.png.
 */

import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const URL = "http://localhost:5191/?bonebusterDebug&bonebusterSeed=12345";
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 3000;

const browser = await chromium.launch({
	headless: true,
	args: [
		"--no-sandbox",
		"--mute-audio",
		"--window-position=9999,9999",
		"--disable-background-timer-throttling",
		"--use-angle=gl",
		"--enable-webgl",
		"--ignore-gpu-blocklist",
	],
});
const page = await browser.newPage({ viewport: VIEWPORT });
const errors = [];
page.on("console", (msg) => {
	if (msg.type() === "error" || msg.type() === "warning") {
		errors.push(`[${msg.type()}] ${msg.text()}`);
	}
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__bonebuster), { timeout: 15000 });
await page.evaluate(() => window.__bonebuster.start());
await page.waitForSelector("[data-testid='bonebuster-hp']");
await new Promise((r) => setTimeout(r, SETTLE_MS));

const info = await page.evaluate(() => {
	const c = document.querySelector("canvas");
	const gl = c?.getContext("webgl2") ?? c?.getContext("webgl");
	const ext = gl?.getExtension("WEBGL_debug_renderer_info");
	return {
		canvasSize: c ? [c.width, c.height] : null,
		glRenderer: gl ? gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : "no-gl",
		glVendor: gl ? gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) : "no-gl",
		glLost: gl ? gl.isContextLost() : null,
		state: window.__bonebuster.getState(),
	};
});
console.log(JSON.stringify(info, null, 2));
console.log("---errors---");
for (const e of errors.slice(0, 20)) console.log(e);

const session = await page.context().newCDPSession(page);
await session.send("Page.enable");
const { data } = await session.send("Page.captureScreenshot", {
	format: "png",
	clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height, scale: 1 },
});
await writeFile("test-results/probe-headless.png", Buffer.from(data, "base64"));
console.log("wrote test-results/probe-headless.png");

await browser.close();
