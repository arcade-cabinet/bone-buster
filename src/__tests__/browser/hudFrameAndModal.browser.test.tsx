/**
 * ERR1 + HUD1 — AssetErrorModal + HudFrame render contracts (real Chromium).
 *
 * The user-visible end of the asset-error path (the modal) and the responsive
 * HUD chrome (cockpit vs compact, driven by `useFrameClass` with a `classOverride`
 * test hook) had no render coverage (review T-5 / T-6). These pin:
 *  - AssetErrorModal shows the failing url + asset type, as an alertdialog
 *  - HudFrame renders cockpit chrome on tablet/unfolded, compact on phone
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { AssetErrorReason } from "@views/AssetErrorBoundary";
import { AssetErrorModal } from "@views/AssetErrorModal";
import { HudFrame } from "@views/HudFrame";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("ERR1 — AssetErrorModal", () => {
	const reason: AssetErrorReason = {
		assetType: "glb",
		url: "https://example.test/assets/models/enemies/skeleton.glb",
		message: "404",
	};

	it("renders as an alertdialog showing the asset type and failing url", () => {
		render(<AssetErrorModal reason={reason} />);
		const modal = screen.getByTestId("bonebuster-asset-error");
		expect(modal.getAttribute("role")).toBe("alertdialog");
		expect(modal.textContent).toContain("glb");
		expect(modal.textContent).toContain("skeleton.glb");
	});

	it("renders the url as a text node (no raw HTML injection)", () => {
		const hostile: AssetErrorReason = {
			assetType: "wasm",
			url: "https://x.test/<img src=x onerror=alert(1)>.wasm",
			message: "fail",
		};
		render(<AssetErrorModal reason={hostile} />);
		const modal = screen.getByTestId("bonebuster-asset-error");
		// The angle brackets survive as text — never parsed into an <img> element.
		expect(modal.querySelector("img")).toBeNull();
		expect(modal.textContent).toContain("onerror=alert(1)");
	});
});

describe("HUD1 — HudFrame responsive chrome", () => {
	it("renders cockpit chrome when forced to the cockpit class", () => {
		const { container } = render(<HudFrame classOverride="cockpit" />);
		expect(container.querySelector('[data-frame="cockpit"]')).not.toBeNull();
		expect(container.querySelector('[data-frame="compact"]')).toBeNull();
	});

	it("renders compact vignette when forced to the compact class", () => {
		const { container } = render(<HudFrame classOverride="compact" />);
		expect(container.querySelector('[data-frame="compact"]')).not.toBeNull();
		expect(container.querySelector('[data-frame="cockpit"]')).toBeNull();
	});
});
