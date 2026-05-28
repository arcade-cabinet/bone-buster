/**
 * The Vike prerender hook (`pages/+onRenderHtml.tsx`) bakes a critical-CSS
 * block + skeleton HTML into the static build output. The CSS literals
 * for the bone palette live as plain string constants there instead of
 * being imported from `app/styles/tokens/colors.ts`, because the hook
 * runs at build time inside Vike's prerender pipeline and pulling the
 * full token module would drag the React/style-system deps in unnecessarily.
 *
 * That denormalization is fine ONLY if a test catches drift. If someone
 * tweaks BONE_PALETTE.brandBone1 from "#F4ECDC" to something else, this
 * test fails until the prerender file's mirrored literal is also updated.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BONE_PALETTE } from "../../../app/styles/tokens/colors";

const PRERENDER_PATH = resolve(__dirname, "../../../pages/+onRenderHtml.tsx");
const PALETTE_BLOCK_RE = /\/\/ PRERENDER-PALETTE-START([\s\S]*?)\/\/ PRERENDER-PALETTE-END/;

type Mirror = { name: keyof typeof BONE_PALETTE; literal: string };

function readMirroredLiterals(): Mirror[] {
	const source = readFileSync(PRERENDER_PATH, "utf8");
	const match = source.match(PALETTE_BLOCK_RE);
	if (!match) {
		throw new Error(
			"prerender file missing PRERENDER-PALETTE-START/END markers — sync test cannot verify literals",
		);
	}
	const block = match[1];
	if (block === undefined) throw new Error("PALETTE_BLOCK_RE group 1 missing — check the regex");
	// Lines look like: const SURFACE_BASE = "#0F0C12";
	const lineRe = /const\s+(\w+)\s*=\s*"(#[0-9A-Fa-f]{6})";/g;
	const aliasMap: Record<string, keyof typeof BONE_PALETTE> = {
		SURFACE_BASE: "surfaceBase",
		SURFACE_ELEVATED: "surfaceElevated",
		TEXT_PRIMARY: "textPrimary",
		TEXT_SECONDARY: "textSecondary",
		TEXT_MUTED: "textMuted",
		ACCENT_PRIMARY: "accentPrimary",
		BRAND_BONE1: "brandBone1",
		BRAND_BONE2: "brandBone2",
		BRAND_BONE3: "brandBone3",
		BRAND_BLOOD: "brandBlood",
	};
	const mirrors: Mirror[] = [];
	for (const match of block.matchAll(lineRe)) {
		const alias = match[1];
		const literal = match[2];
		if (alias === undefined || literal === undefined) {
			throw new Error("lineRe capture group missing — regex structure changed");
		}
		const name = aliasMap[alias];
		if (!name) {
			throw new Error(
				`prerender mirror constant ${alias} has no aliasMap entry — update bonebuster-prerenderCss.test.ts`,
			);
		}
		mirrors.push({ name, literal });
	}
	return mirrors;
}

describe("bonebuster-prerenderCss palette sync", () => {
	const mirrors = readMirroredLiterals();

	it("mirrors every palette key the prerender uses", () => {
		expect(mirrors.length).toBeGreaterThan(0);
	});

	for (const { name, literal } of readMirroredLiterals()) {
		it(`prerender ${name} = BONE_PALETTE.${name}`, () => {
			expect(literal).toBe(BONE_PALETTE[name]);
		});
	}
});
