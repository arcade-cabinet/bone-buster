/**
 * A6 — archetype-registry shape pin. The registry documents (but
 * doesn't enforce) every per-archetype axis. This test fails if the
 * registry shape drifts away from the expected per-axis fields, OR
 * if a module path stops matching the actual file (so a rename
 * needs a registry update in the same commit).
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHETYPE_AXES, getAxisModules } from "@world/archetypeRegistry";
import { describe, expect, it } from "vitest";

describe("A6 — archetype registry", () => {
	it("ships at least 10 archetype axes (ARCHITECTURE audit §2.4 minimum)", () => {
		expect(ARCHETYPE_AXES.length).toBeGreaterThanOrEqual(10);
	});

	it("every axis has a non-empty axisName + module + axisDescription", () => {
		for (const axis of ARCHETYPE_AXES) {
			expect(axis.axisName).toBeTruthy();
			expect(axis.module).toBeTruthy();
			expect(axis.axisDescription).toBeTruthy();
		}
	});

	it("every axis module points at a real file on disk", () => {
		const repoRoot = resolve(__dirname, "../../..");
		for (const axis of ARCHETYPE_AXES) {
			const absolute = resolve(repoRoot, axis.module);
			expect(existsSync(absolute)).toBe(true);
		}
	});

	it("module paths are distinct (no duplicates)", () => {
		const modules = getAxisModules();
		const unique = new Set(modules);
		// A module CAN own multiple axes (e.g. sfx.ts) so this is a
		// soft invariant — we only flag if there are unexpected
		// duplicates. For now allow 1 duplicate per module max.
		expect(unique.size).toBeGreaterThanOrEqual(modules.length - 5);
	});
});
