/**
 * Client (browser) render hook — mounts the React tree into the
 * prerendered HTML shell.
 *
 * The +onRenderHtml hook bakes the skeleton into `<body>` and an
 * empty `<div id="page-view">` next to it. This hook fires on first
 * load, replaces page-view's contents with the React tree, and lets
 * the inline `SKELETON_HIDE_SCRIPT` (also in +onRenderHtml) flip
 * `<body class="bb-spa-hydrated">` to hide the skeleton.
 *
 * vike-react would normally own this hook. We write it ourselves so
 * we get exact control over the mount + the bootstrap (jeep-sqlite)
 * sequence that used to live in `app/main.tsx`.
 */

import { ensureJeepSqliteReady } from "@platform/persistence/initJeepSqlite";
import type { OnRenderClientAsync, PageContextClient } from "vike/types";
import { type ComponentType, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

// Bone Buster fonts (PRD §R1). Self-hosted via @fontsource/*; no CDN.
// Each import is byte-for-byte the woff2 from the font package. Order
// is display-first so the wordmark paints without FOIT on landing.
import "@fontsource/bungee/400.css";
import "@fontsource/bungee-inline/400.css";
import "@fontsource/bungee-shade/400.css";
import "@fontsource/space-grotesk/300.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/tilt-prism/400.css";
import "../app/global.css";

// Module-scope root so re-renders during HMR / client-routing reuse
// the same React root instead of creating a new one each time.
let root: Root | null = null;

const onRenderClient: OnRenderClientAsync = async (pageContext) => {
	const ctx = pageContext as PageContextClient & { Page?: ComponentType };
	const Page = ctx.Page;
	if (!Page) {
		throw new Error("onRenderClient: no Page component in pageContext");
	}

	const container = document.getElementById("page-view");
	if (!container) {
		throw new Error("onRenderClient: missing #page-view mount point");
	}

	if (!root) {
		root = createRoot(container);
		// STO1b — fire-and-forget WASM bridge bootstrap. Was in
		// app/main.tsx; now lives at the post-Vike mount point.
		void ensureJeepSqliteReady();
	}

	root.render(
		<StrictMode>
			<Page />
		</StrictMode>,
	);

	// Hide the prerendered skeleton once React has had a chance to
	// paint. We can't use an inline <script> in the HTML because CSP
	// `script-src 'self'` blocks inline. Setting the class here keeps
	// the same CSS rule (`body.bb-spa-hydrated .bb-prerender { display: none }`)
	// in charge of the swap. requestAnimationFrame gives the React
	// commit one frame to paint into #page-view first so we don't
	// flash an empty page-view above an already-hidden skeleton.
	if (typeof window !== "undefined") {
		requestAnimationFrame(() => {
			document.body.classList.add("bb-spa-hydrated");
		});
	}
};

export default onRenderClient;
