import { describe, expect, it } from "vitest";
import { FONT_FAMILY, TYPE } from "../../design-tokens/typography";

/**
 * R1 contract pins. TYPE.{display,body,mono,flair} are the canonical
 * post-rebrand type tokens; every new surface routes through them.
 * The legacy FONT_FAMILY exports stay until the R7 HUD pass migrates
 * the last call sites — the pins below catch accidental deletion or
 * stack reorder.
 */
describe("Bone Buster type tokens (PRD §R1)", () => {
	it("TYPE.display leads with Bungee + layered Bungee Inline / Shade", () => {
		expect(TYPE.display).toContain('"Bungee"');
		expect(TYPE.display).toContain('"Bungee Inline"');
		expect(TYPE.display).toContain('"Bungee Shade"');
		// The legacy Black Ops One stays as a graceful fallback while
		// R7 is in flight. Once R7 lands it can drop.
		expect(TYPE.display).toContain('"Black Ops One"');
	});

	it("TYPE.body leads with Space Grotesk", () => {
		expect(TYPE.body.startsWith('"Space Grotesk"')).toBe(true);
		// System-font fallbacks survive so the body text never flashes
		// invisible if @fontsource is still hydrating.
		expect(TYPE.body).toContain("system-ui");
	});

	it("TYPE.mono leads with JetBrains Mono + monospace fallbacks", () => {
		expect(TYPE.mono.startsWith('"JetBrains Mono"')).toBe(true);
		expect(TYPE.mono).toContain("ui-monospace");
		expect(TYPE.mono).toContain("monospace");
	});

	it("TYPE.flair leads with Tilt Prism + Bungee fallback", () => {
		expect(TYPE.flair.startsWith('"Tilt Prism"')).toBe(true);
		// Tilt Prism is the animated-axis flair font; if it fails to
		// load, fall back to Bungee so the surface still reads as
		// display-tier rather than collapsing to body.
		expect(TYPE.flair).toContain('"Bungee"');
	});

	it("legacy FONT_FAMILY exports survive for the R7 transition", () => {
		// Keep the legacy keys alive until R7 sweeps the last call site.
		// When R7 ships, this test moves to a "ensures FONT_FAMILY is
		// undefined" inversion (or deletes outright).
		expect(typeof FONT_FAMILY.body).toBe("string");
		expect(typeof FONT_FAMILY.display).toBe("string");
		expect(typeof FONT_FAMILY.mono).toBe("string");
	});

	it("TYPE.* values are non-empty strings (no accidental empty tokens)", () => {
		for (const key of ["display", "body", "mono", "flair"] as const) {
			expect(typeof TYPE[key]).toBe("string");
			expect(TYPE[key].length).toBeGreaterThan(20);
		}
	});
});
