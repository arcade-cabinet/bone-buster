#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * AO.5 — PWA icon generator. Renders the OBJEXOOM brand wordmark to
 * 192/512/maskable-512 PNGs under `public/`, using Playwright's
 * bundled Chromium (already on the box for the e2e screenshot suite,
 * no extra dep).
 *
 * Idempotent: re-running overwrites the outputs. Run on demand when
 * the brand wordmark or palette tokens change.
 *
 * Usage:
 *   pnpm assets:pwa-icons
 */
import { chromium } from "@playwright/test";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

// Token values mirrored from src/design-tokens/colors.ts. Kept inline
// because this script ships pre-Vite — can't import the .ts module
// directly without a bundler step.
const TOKENS = {
	bgVoid: "#03050b", // SCALE.ink[950]
	primary: "#f28a3f", // amber primary (OBJEXOOM in the wordmark)
	accent: "#b06bf7", // violet accent (DOOM)
	gridLine: "rgba(176, 107, 247, 0.08)",
};

/**
 * Build the SVG payload at the target size.
 *
 * @param {number} size       Output dimensions (square).
 * @param {boolean} maskable  When true, leaves a ~10% padding ring of
 *                            solid bg so Android's adaptive-icon mask
 *                            doesn't clip the wordmark.
 */
function svgFor(size, maskable) {
	const pad = maskable ? size * 0.12 : size * 0.04;
	const inner = size - pad * 2;
	// Square icon → don't try to fit "OBJEXOOM" on one line; use stacked
	// "OBJE / XOOM" so the wordmark reads at small sizes without clipping.
	const fontPx = Math.round(inner * 0.32);
	const subFontPx = Math.round(inner * 0.075);
	const gridStep = size / 14;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${TOKENS.bgVoid}"/>
  ${
		maskable
			? ""
			: `<defs><pattern id="grid" x="0" y="0" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse">
            <path d="M ${gridStep} 0 L 0 0 0 ${gridStep}" fill="none" stroke="${TOKENS.gridLine}" stroke-width="1"/>
          </pattern></defs>
          <rect width="${size}" height="${size}" fill="url(#grid)"/>`
	}
  <g transform="translate(${size / 2}, ${pad + inner * 0.18})">
    <text text-anchor="middle"
          y="${fontPx * 0.85}"
          font-family="'Black Ops One', 'Impact', sans-serif"
          font-size="${fontPx}"
          font-weight="900"
          fill="${TOKENS.primary}">OBJE</text>
    <text text-anchor="middle"
          y="${fontPx * 1.95}"
          font-family="'Black Ops One', 'Impact', sans-serif"
          font-size="${fontPx}"
          font-weight="900"
          fill="${TOKENS.primary}">XOOM</text>
    <text text-anchor="middle"
          y="${fontPx * 2.6}"
          font-family="'Rajdhani', 'Trebuchet MS', sans-serif"
          font-size="${subFontPx}"
          font-weight="600"
          fill="${TOKENS.accent}"
          letter-spacing="${subFontPx * 0.3}">RIP &amp; TEAR</text>
  </g>
</svg>`;
}

// CodeRabbit nitpick fold (PR #16): reuse a single Chromium instance
// across all icon jobs. Launching the browser is ~1-2s; with 5 jobs
// that saves ~5-10s on every PWA-icon regeneration.
async function rasterize(browser, svg, outPath, size) {
	const ctx = await browser.newContext({
		viewport: { width: size, height: size },
		deviceScaleFactor: 1,
	});
	const page = await ctx.newPage();
	const html = `<!doctype html><html><head><style>
    @import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Rajdhani:wght@600&display=swap');
    html,body { margin:0; padding:0; background:transparent; width:${size}px; height:${size}px; }
    svg { display:block; width:${size}px; height:${size}px; }
  </style></head><body>${svg}</body></html>`;
	await page.setContent(html, { waitUntil: "networkidle" });
	// Give the Google Fonts CSS a moment after networkidle to apply.
	await page.waitForTimeout(400);
	const png = await page.screenshot({ omitBackground: true, type: "png" });
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, png);
	await ctx.close();
	return png.length;
}

const JOBS = [
	{ size: 192, maskable: false, out: "public/icons/icon-192.png" },
	{ size: 512, maskable: false, out: "public/icons/icon-512.png" },
	{ size: 512, maskable: true, out: "public/icons/icon-maskable-512.png" },
	// Apple touch icon — 180x180 PNG, same composition as 192.
	{ size: 180, maskable: false, out: "public/apple-touch-icon.png" },
	// 32x32 favicon — bg+OBJ initials, dropped sub-line at this size.
	{ size: 32, maskable: false, out: "public/favicon-32.png", initialsOnly: true },
];

const browser = await chromium.launch();
try {
	for (const job of JOBS) {
		const svg = job.initialsOnly
			? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <rect width="32" height="32" fill="${TOKENS.bgVoid}"/>
          <text x="50%" y="62%" text-anchor="middle"
                font-family="'Black Ops One', Impact, sans-serif"
                font-size="14" font-weight="900" fill="${TOKENS.primary}">O</text>
        </svg>`
			: svgFor(job.size, job.maskable);
		const outPath = resolve(ROOT, job.out);
		process.stdout.write(
			`Rendering ${job.out} (${job.size}px${job.maskable ? " maskable" : ""}) ... `,
		);
		const bytes = await rasterize(browser, svg, outPath, job.size);
		console.log(`${(bytes / 1024).toFixed(1)} KB`);
	}
} finally {
	await browser.close();
}

console.log("\nDone. Icons written to public/icons/ and public/favicon-32.png.");
