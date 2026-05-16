/**
 * E10 — HUD 3D key indicator (component contract).
 *
 * Vitest unit-mode can't render r3f Canvas (no WebGL), so this test
 * only pins the prop-gated mount: when `hasKey` is false, the
 * component returns null. Visual + animation is verified at runtime
 * in `pnpm dev` and the canonical screenshots (key model visible
 * post-pickup, absent pre-pickup).
 */

import { describe, expect, it } from "vitest";
import { HudKey3D } from "../../scene/hud/HudKey3D";

describe("E10 — HudKey3D gating", () => {
	it("returns null when hasKey is false (no Canvas mount → no WebGL cost)", () => {
		const result = HudKey3D({ hasKey: false, flashUntil: 0 });
		expect(result).toBeNull();
	});

	it("returns a JSX element when hasKey is true", () => {
		const result = HudKey3D({ hasKey: true, flashUntil: 0 });
		expect(result).not.toBeNull();
	});
});
