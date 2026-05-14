import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ObjexoomShell } from "@/ObjexoomShell";
import "./global.css";

const container = document.getElementById("root");
if (!container) {
	throw new Error("OBJEXOOM: missing #root mount point. Check public/index.html.");
}

createRoot(container).render(
	<StrictMode>
		<ObjexoomShell />
	</StrictMode>,
);
