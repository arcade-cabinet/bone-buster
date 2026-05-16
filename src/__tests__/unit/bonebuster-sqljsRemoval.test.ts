import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * ARCH3 — sql.js dependency removed (Phase 20, 2026-05-15). These
 * tests pin the removal contract so a future re-introduction of
 * sql.js is caught at the test layer.
 *
 * The STO1b Capacitor SQLite migration shipped its grace window; the
 * legacy localStorage blob path now logs a warning and drops the key
 * (see migrateLegacyBlobIfPresent in src/runHistory.ts).
 */

describe("ARCH3 sql.js removal", () => {
	it("package.json does not list sql.js as a dependency", async () => {
		const pkg = JSON.parse(await readFile("package.json", "utf-8"));
		expect(pkg.dependencies?.["sql.js"]).toBeUndefined();
		expect(pkg.devDependencies?.["@types/sql.js"]).toBeUndefined();
	});

	it("no source file under src/ imports from sql.js", () => {
		// Use git grep so node_modules / generated build artifacts are
		// excluded. If grep finds nothing, exit status is 1 (not an error
		// for us — we WANT zero matches).
		let output = "";
		try {
			output = execSync(
				'git grep -l "from \\"sql.js\\"\\|require(\\"sql.js\\")\\|import(\\"sql.js\\")" -- "src/**/*.ts" "src/**/*.tsx"',
				{
					encoding: "utf-8",
				},
			);
		} catch (e: unknown) {
			// git grep exits 1 when no matches — that's the success case.
			const err = e as { status?: number; stdout?: string };
			if (err.status === 1) output = "";
			else throw e;
		}
		expect(output.trim()).toBe("");
	});

	it("scripts/prepare-web-wasm.mjs no longer references sql.js", async () => {
		const script = await readFile("scripts/prepare-web-wasm.mjs", "utf-8");
		// The header comment mentions the historical removal as audit
		// trail — that's allowed. But ARTIFACTS must not list it.
		expect(script).not.toMatch(/source:\s*["'][^"']*sql\.js/);
		expect(script).not.toMatch(/destination:\s*["'][^"']*sql-wasm/);
	});
});
