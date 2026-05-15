import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ObjexoomShell } from "@/ObjexoomShell";
import { ensureJeepSqliteReady } from "@/persistence/initJeepSqlite";
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
