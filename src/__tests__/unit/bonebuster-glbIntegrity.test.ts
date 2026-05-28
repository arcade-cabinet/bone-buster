/**
 * Asset-integrity guard: every production GLB under public/assets/models/
 * must be a well-formed binary glTF (12-byte header: "glTF" magic,
 * container version 2, declared length == file size).
 *
 * Two GLBs once shipped corrupt-on-disk (all-zero magic, born broken in
 * #75) and only threw at runtime — a stat-only existence check missed
 * them. This pins the header contract as a fast unit test alongside the
 * deployment gate in scripts/verify-runtime-assets.mjs, so corruption
 * fails the suite immediately, not just at `pnpm verify` time.
 */

import { closeSync, openSync, readdirSync, readSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODELS_DIR = resolve(import.meta.dirname, "../../../public/assets/models");
const GLB_MAGIC = 0x46546c67; // "glTF" little-endian

function allGlbs(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...allGlbs(p));
		else if (entry.name.endsWith(".glb")) out.push(p);
	}
	return out;
}

describe("GLB asset integrity", () => {
	const glbs = allGlbs(MODELS_DIR);

	it("ships a non-trivial number of GLBs (sanity — dir resolved)", () => {
		expect(glbs.length).toBeGreaterThan(200);
	});

	it.each(
		glbs.map((p) => [p.slice(MODELS_DIR.length + 1), p] as const),
	)("%s has a valid binary-glTF header", (_label, path) => {
		// Read only the 12-byte header, not the whole file.
		const head = Buffer.alloc(12);
		const fd = openSync(path, "r");
		try {
			expect(readSync(fd, head, 0, 12, 0)).toBe(12);
		} finally {
			closeSync(fd);
		}
		expect(head.readUInt32LE(0)).toBe(GLB_MAGIC); // "glTF"
		expect(head.readUInt32LE(4)).toBe(2); // container version
		expect(head.readUInt32LE(8)).toBe(statSync(path).size); // declared length
	});
});
