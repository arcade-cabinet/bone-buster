import { ensureJeepSqliteReady } from "@platform/persistence/initJeepSqlite";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ObjexoomShell } from "@/ObjexoomShell";
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
import "./global.css";

const container = document.getElementById("root");
if (!container) {
	throw new Error("OBJEXOOM: missing #root mount point. Check public/index.html.");
}

// STO1b — kick off the jeep-sqlite WASM bridge before React mounts so
// @capacitor-community/sqlite has its web-platform persistence layer
// ready by the time runHistory.openRunHistory() runs. Fire-and-forget:
// the call resolves with `false` on failure and createDatabase falls
// back to InMemoryDatabase, so a broken WASM load degrades to
// ephemeral persistence rather than blocking the game from booting.
void ensureJeepSqliteReady();

createRoot(container).render(
	<StrictMode>
		<ObjexoomShell />
	</StrictMode>,
);
