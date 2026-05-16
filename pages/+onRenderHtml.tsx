/**
 * Server (build-time) render hook — emits the static HTML shell.
 *
 * This is THE optimization. Pre-Vike, `index.html` shipped as:
 *
 *     <head>...meta...</head>
 *     <body><div id="root"></div><script src="/app/main.tsx" /></body>
 *
 * First paint was a flat #0F0C12 background until ~600KB of JS
 * (react + r3f + three + drei + framer + howler) parsed and React
 * mounted, which took ~600-1200ms on mid-tier mobile. LCP was the
 * BoneBusterWordmark, which only painted AFTER the bundle loaded.
 *
 * Post-Vike, this hook bakes a fully-styled skeleton (wordmark,
 * tagline, menu cards, version chip) into the body. The same HTML
 * the user requests already has pixels in it. JS still loads + the
 * React tree still mounts at the same point, but the user sees the
 * brand identity inside ~100ms (FCP) instead of waiting for the
 * full bundle.
 *
 * Once React mounts and the SPA paints over `#page-view`,
 * `+onRenderClient.tsx` flips `<body class="bb-spa-hydrated">` from
 * inside the React tree (via useEffect on the Shell mount) which
 * hides the skeleton via CSS — the SPA's own React landing surface
 * (BoneBusterWordmark) paints in the same coords, so the visual
 * handoff is seamless. We can't use an inline `<script>` because
 * CSP `script-src 'self'` blocks inline scripts.
 *
 * The skeleton + the critical CSS are static strings: no React
 * renderToString at build time, no dependencies on the runtime
 * design-token modules. The few palette literals are mirrored from
 * BONE_PALETTE in app/styles/tokens/colors.ts; the
 * `bonebuster-prerenderCss` unit test asserts they stay in sync.
 *
 * `__BONEBUSTER_VERSION__` is injected by Vite from package.json so
 * the version chip + footer chip ride release-please bumps instead
 * of drifting from a hardcoded literal.
 */

import { A } from "@assets/assetUrl";
import { dangerouslySkipEscape, escapeInject } from "vike/server";
import type { OnRenderHtmlAsync } from "vike/types";

// PA2 — preload the woff2 subsets the prerender skeleton renders.
// "BONE BUSTER" is plain latin so the browser only needs the latin
// subset of Bungee 400. Space Grotesk 400/500 cover the tagline +
// footer chips. With @fontsource's `font-display: swap`, the woff2
// only fetches when CSS resolves + a glyph matches — these preload
// hints start the fetch in parallel with the CSS download, so the
// wordmark paints in its real face on the first frame instead of
// flashing the system fallback first.
import bungeeLatin400 from "@fontsource/bungee/files/bungee-latin-400-normal.woff2?url";
import spaceGrotesk400 from "@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url";
import spaceGrotesk500 from "@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2?url";

declare const __BONEBUSTER_VERSION__: string;

// PRERENDER-PALETTE-START
// Mirrored from app/styles/tokens/colors.ts BONE_PALETTE.
const SURFACE_BASE = "#0F0C12";
const SURFACE_ELEVATED = "#1A1620";
const TEXT_PRIMARY = "#F4ECDC";
const TEXT_SECONDARY = "#A89B85";
const TEXT_MUTED = "#6D6458";
const ACCENT_PRIMARY = "#FF6B35";
const BRAND_BONE1 = "#F4ECDC";
const BRAND_BONE2 = "#D9C5A0";
const BRAND_BONE3 = "#8B6F47";
const BRAND_BLOOD = "#9B2226";
// PRERENDER-PALETTE-END

const CRITICAL_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${SURFACE_BASE}; color: ${TEXT_PRIMARY}; font-family: -apple-system, "Space Grotesk", system-ui, sans-serif; overflow: hidden; }
body { min-height: 100dvh; }
#page-view { min-height: 100dvh; }
.bb-prerender { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0) env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0); background: radial-gradient(circle at center, ${SURFACE_ELEVATED} 0%, ${SURFACE_BASE} 70%); z-index: 0; }
.bb-prerender__version { font-size: 10px; letter-spacing: 0.2em; color: ${ACCENT_PRIMARY}; text-transform: uppercase; margin-bottom: 24px; font-weight: 600; }
.bb-prerender__wordmark { font-family: "Bungee", "Arial Black", sans-serif; font-size: clamp(48px, 12vw, 96px); letter-spacing: 0.08em; color: ${BRAND_BONE1}; -webkit-text-stroke: 2px ${BRAND_BLOOD}; text-shadow: 0 2px 0 ${BRAND_BONE2}, 0 4px 0 ${BRAND_BONE3}, 0 6px 12px rgba(0,0,0,0.6); margin: 0 0 12px 0; line-height: 1; }
.bb-prerender__hr { width: clamp(180px, 30vw, 280px); height: 2px; background: ${BRAND_BONE3}; border: 0; margin: 8px 0 24px 0; }
.bb-prerender__tagline { font-size: clamp(12px, 1.6vw, 16px); letter-spacing: 0.2em; color: ${TEXT_SECONDARY}; text-transform: uppercase; margin: 0 0 56px 0; }
.bb-prerender__menu { display: flex; flex-direction: column; gap: 12px; width: clamp(220px, 32vw, 320px); }
.bb-prerender__menu-item { display: flex; align-items: center; gap: 12px; background: ${SURFACE_ELEVATED}; border: 1px solid transparent; border-radius: 6px; padding: 12px 20px; font-family: "Bungee", "Arial Black", sans-serif; font-size: 16px; letter-spacing: 0.1em; color: ${TEXT_PRIMARY}; text-transform: uppercase; }
.bb-prerender__menu-item--active { border-color: ${ACCENT_PRIMARY}; color: ${ACCENT_PRIMARY}; }
.bb-prerender__menu-chevron { color: ${ACCENT_PRIMARY}; font-weight: 700; }
.bb-prerender__footer { position: fixed; bottom: env(safe-area-inset-bottom, 12px); left: 0; right: 0; text-align: center; font-size: 11px; letter-spacing: 0.1em; color: ${TEXT_MUTED}; padding: 12px; }
.bb-prerender__footer span { margin: 0 8px; }
body.bb-spa-hydrated .bb-prerender { display: none; }
@media (prefers-reduced-motion: no-preference) {
  .bb-prerender__wordmark { animation: bb-wordmark-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @keyframes bb-wordmark-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
}
`.trim();

const skeletonBody = (version: string) =>
	`
<div class="bb-prerender" aria-hidden="true">
  <div class="bb-prerender__version">VERSION ${version} · EARLY ACCESS</div>
  <h1 class="bb-prerender__wordmark">BONE BUSTER</h1>
  <hr class="bb-prerender__hr" />
  <p class="bb-prerender__tagline">THEY HAD IT COMING.</p>
  <nav class="bb-prerender__menu" aria-label="Bone Buster main menu">
    <div class="bb-prerender__menu-item bb-prerender__menu-item--active"><span class="bb-prerender__menu-chevron">›</span> NEW GAME</div>
    <div class="bb-prerender__menu-item"><span class="bb-prerender__menu-chevron">›</span> OPTIONS</div>
    <div class="bb-prerender__menu-item"><span class="bb-prerender__menu-chevron">›</span> HOW TO PLAY</div>
    <div class="bb-prerender__menu-item"><span class="bb-prerender__menu-chevron">›</span> QUIT</div>
  </nav>
  <div class="bb-prerender__footer">
    <span>Bone Buster v${version}</span><span>·</span><span>ESC → exit</span><span>·</span><span>Loading…</span>
  </div>
</div>
`.trim();

type AppConfig = { title?: string; description?: string };

// Vike's dev SSR pipeline injects an inline `<script>` for HMR + the
// pageContext hydration handoff and opens a websocket for HMR pushes.
// Prod (the prerendered static bundle) emits no inline scripts at all
// and never reaches for HMR, so we keep the tight production CSP exactly
// what it was pre-Vike. Dev opens the door with `'unsafe-inline'` +
// `ws:`/`wss:` only when `import.meta.env.DEV` is true.
const DEV_SCRIPT_SRC = "'self' 'wasm-unsafe-eval' 'unsafe-inline' 'unsafe-eval'";
const PROD_SCRIPT_SRC = "'self' 'wasm-unsafe-eval'";
const DEV_CONNECT_SRC = "'self' blob: data: ws: wss:";
const PROD_CONNECT_SRC = "'self' blob: data:";

const onRenderHtml: OnRenderHtmlAsync = async (pageContext) => {
	const config = pageContext.config as AppConfig;
	const title = config.title ?? "Bone Buster";
	const description = config.description ?? "Bone Buster";
	const scriptSrc = import.meta.env.DEV ? DEV_SCRIPT_SRC : PROD_SCRIPT_SRC;
	const connectSrc = import.meta.env.DEV ? DEV_CONNECT_SRC : PROD_CONNECT_SRC;
	const csp = `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src ${connectSrc}; object-src 'none'; base-uri 'none'; frame-ancestors 'none';`;

	const documentHtml = escapeInject`<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="theme-color" content="${SURFACE_BASE}" />
		<meta http-equiv="Content-Security-Policy" content="${csp}" />
		<title>${title}</title>
		<meta name="description" content="${description}" />
		<link rel="manifest" href="${A("manifest.webmanifest")}" />
		<link rel="icon" href="${A("favicon.ico")}" sizes="32x32" />
		<link rel="icon" type="image/png" sizes="32x32" href="${A("favicon-32.png")}" />
		<link rel="icon" type="image/png" sizes="192x192" href="${A("icons/icon-192.png")}" />
		<link rel="apple-touch-icon" sizes="180x180" href="${A("apple-touch-icon.png")}" />
		<link rel="preload" as="font" type="font/woff2" crossorigin href="${bungeeLatin400}" />
		<link rel="preload" as="font" type="font/woff2" crossorigin href="${spaceGrotesk400}" />
		<link rel="preload" as="font" type="font/woff2" crossorigin href="${spaceGrotesk500}" />
		<meta name="mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="apple-mobile-web-app-title" content="Bone Buster" />
		<style>${dangerouslySkipEscape(CRITICAL_CSS)}</style>
	</head>
	<body>
		${dangerouslySkipEscape(skeletonBody(__BONEBUSTER_VERSION__))}
		<div id="page-view"></div>
	</body>
</html>`;

	return {
		documentHtml,
		// Suppress Vike's auto-preload for font assets. With 12 fontsource
		// CSS imports + per-subset (latin / latin-ext / vietnamese / etc)
		// woff2 files, Vike preloads ~40 woff2s — ~150KB of network on
		// first paint, most of which the unicode-range will never even
		// resolve. We preload exactly the 3 woff2 subsets the prerender
		// skeleton uses via the explicit `<link rel=preload>` tags above;
		// fontsource's `font-display: swap` then handles the rest lazily
		// as glyphs actually render.
		injectFilter(assets) {
			for (const asset of assets) {
				if (asset.assetType === "font") {
					asset.inject = false;
				}
			}
		},
	};
};

export default onRenderHtml;
