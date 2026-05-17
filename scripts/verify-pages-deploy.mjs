/**
 * One-shot Pages-deploy verification. Loads the live GitHub Pages URL
 * with the debug flag, advances past the landing screen via the
 * __bonebuster.start() hook, waits for the in-game HUD, captures a
 * screenshot, and reports console errors.
 *
 * The launch args mirror tests/e2e/screenshots.spec.ts so the real
 * ANGLE-GL backend is used (Playwright's default SwiftShader headless
 * deadlocks on shadow-map composites).
 *
 * Usage:
 *   node scripts/verify-pages-deploy.mjs
 *   PAGES_URL=https://example.com/path node scripts/verify-pages-deploy.mjs
 *   PAGES_SCREENSHOT=/tmp/foo.png node scripts/verify-pages-deploy.mjs
 */
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const URL =
	process.env.PAGES_URL ??
	"https://arcade-cabinet.github.io/bone-buster/?bonebusterDebug&bonebusterSeed=12345";
const LANDING_PATH = process.env.PAGES_LANDING ?? "/tmp/pages-landing.png";
const INGAME_PATH = process.env.PAGES_SCREENSHOT ?? "/tmp/pages-ingame.png";
const VIEWPORT = { width: 1440, height: 900 };

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

async function captureViaCDP(page, outPath) {
	const session = await page.context().newCDPSession(page);
	try {
		await session.send("Page.enable");
		const { data } = await session.send("Page.captureScreenshot", {
			format: "png",
			clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height, scale: 1 },
		});
		await writeFile(outPath, Buffer.from(data, "base64"));
	} finally {
		await session.detach().catch(() => undefined);
	}
}

const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const consoleMessages = [];
page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleMessages.push(`[pageerror] ${err.message}`));

await page.route(
	(url) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
	(route) => route.abort(),
);

const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
console.log("HTTP:", resp.status());

await page.getByRole("img", { name: /Bone Buster/i }).waitFor({ timeout: 20_000 });
console.log("Landing wordmark visible");
await page.evaluate(() => document.fonts.ready);
await captureViaCDP(page, LANDING_PATH);
console.log("Landing screenshot:", LANDING_PATH);

// Production build doesn't expose __bonebuster (gated behind NODE_ENV !== production).
// Advance through the menu by clicking NEW GAME, same path a human would take.
await page.getByRole("navigation", { name: /Bone Buster main menu/i }).waitFor({ timeout: 15_000 });
const newGame = page.getByRole("button", { name: /NEW GAME/i });
await newGame.waitFor({ timeout: 15_000 });
await newGame.click();
console.log("Clicked NEW GAME → skill-level picker");

const hurtMePlenty = page.getByRole("button", { name: /HURT ME PLENTY/i });
await hurtMePlenty.waitFor({ timeout: 10_000 });
await hurtMePlenty.click();
console.log("Clicked HURT ME PLENTY → level picker");

const randomBtn = page.getByRole("button", { name: /^RANDOM$/i });
await randomBtn.waitFor({ timeout: 10_000 });
await randomBtn.click();
console.log("Clicked RANDOM");

await page.locator("[data-testid='bonebuster-hp']").waitFor({ timeout: 30_000 });
console.log("In-game HUD mounted");

await page.evaluate(
	(n) =>
		new Promise((resolve) => {
			let remaining = n;
			const tick = () => {
				remaining -= 1;
				if (remaining <= 0) resolve();
				else requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}),
	60,
);

const gl = await page.evaluate(() => {
	const c = document.querySelector("canvas");
	if (!c) return { error: "no canvas" };
	const glctx = c.getContext("webgl2") || c.getContext("webgl");
	if (!glctx) return { error: "no webgl context" };
	const dbgExt = glctx.getExtension("WEBGL_debug_renderer_info");
	return {
		size: { w: c.width, h: c.height },
		vendor: dbgExt ? glctx.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL) : null,
		renderer: dbgExt ? glctx.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) : null,
	};
});
console.log("WebGL:", JSON.stringify(gl));

await captureViaCDP(page, INGAME_PATH);
console.log("In-game screenshot:", INGAME_PATH);
console.log("Title:", await page.title());
console.log("Final URL:", page.url());

const errorMessages = consoleMessages.filter(
	(m) => m.startsWith("[error]") || m.startsWith("[pageerror]"),
);
console.log("Console errors:", errorMessages.length);
for (const m of errorMessages) console.log("  ", m);

await browser.close();
