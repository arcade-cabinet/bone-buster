#!/usr/bin/env node

/**
 * RS2 — import rewriter helper used by RS3 commits.
 *
 * Walks a moves manifest (JSON array of { from, to } records) and
 * rewrites every TS/TSX import statement in the codebase to match
 * the new layout. Two rewrite strategies, applied in order:
 *
 *   1. Alias rewrite — if the new path lives under one of the
 *      bucket aliases (`@scene/`, `@audio/`, …, `@views/`, …),
 *      rewrite the import to the alias form. Aliases survive
 *      future RESTRUCTURE-internal moves; relative paths don't.
 *
 *   2. Relative rewrite — for imports that can't reach an alias
 *      (e.g. sibling files inside a bucket), recompute the
 *      relative path from each importer's directory to the
 *      target's new path.
 *
 * Invoke between `git mv` and `pnpm verify` inside each RS3 commit:
 *
 *   node scripts/restructure-imports.mjs moves.json
 *
 * Where `moves.json` is the per-commit manifest, e.g.:
 *
 *   [
 *     { "from": "src/weapons.ts",    "to": "src/shared/weapons.ts" },
 *     { "from": "src/constants.ts",  "to": "src/shared/constants.ts" }
 *   ]
 *
 * The script is idempotent — re-running after a partial run is safe.
 */

import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Mirror of the vite.config.ts + tsconfig.json alias set. Source of
// truth for which buckets get rewritten to alias form vs. relative.
const BUCKET_ALIASES = {
	"src/scene": "@scene",
	"src/audio": "@audio",
	"src/engine": "@engine",
	"src/ai": "@ai",
	"src/assets": "@assets",
	"src/store": "@store",
	"src/platform": "@platform",
	"src/shared": "@shared",
	"src/world": "@world",
	"app/views": "@views",
	"app/components": "@components",
	"app/atoms": "@atoms",
	"app/hooks": "@hooks",
	"app/styles": "@styles",
};

const SOURCE_GLOB_EXTS = new Set([".ts", ".tsx"]);

function listSourceFiles() {
	// Use `git ls-files` to skip node_modules, dist, gitignored work.
	const stdout = execSync("git ls-files src app tests scripts", {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return stdout
		.split("\n")
		.filter(Boolean)
		.filter((p) => SOURCE_GLOB_EXTS.has(extname(p)));
}

/**
 * Resolve which alias prefix (if any) the new path lives under.
 * Returns `{ alias: "@shared", remainder: "weapons" }` for
 * `src/shared/weapons.ts`, or null when no bucket alias matches.
 */
function aliasForPath(newPath) {
	const noExt = newPath.replace(/\.(ts|tsx)$/, "");
	for (const [bucket, alias] of Object.entries(BUCKET_ALIASES)) {
		if (noExt === bucket || noExt.startsWith(`${bucket}/`)) {
			const remainder = noExt === bucket ? "" : noExt.slice(bucket.length + 1);
			return { alias, remainder };
		}
	}
	return null;
}

/**
 * The set of legal import-specifier shapes for one move. Used when
 * rewriting importers — we accept the old path in either of the
 * forms an author might have used (alias prefix, repo-relative, or
 * importer-relative).
 */
function buildSpecifierMatchers(fromPath) {
	const noExt = fromPath.replace(/\.(ts|tsx)$/, "");
	const specifiers = new Set([noExt]);
	specifiers.add(`./${noExt}`);
	if (noExt.startsWith("src/")) {
		specifiers.add(`@/${noExt.slice(4)}`);
	}
	if (noExt.startsWith("app/")) {
		specifiers.add(`@app/${noExt.slice(4)}`);
	}
	// Any pre-existing bucket alias usage that pointed at the old
	// flat path (e.g. `@/weapons` for a still-flat src/weapons.ts).
	const flatAlias = noExt.startsWith("src/") ? `@/${noExt.slice(4)}` : null;
	if (flatAlias) specifiers.add(flatAlias);
	return specifiers;
}

/**
 * Compute the replacement specifier for a given importer file and
 * the move's new path.
 */
function rewriteSpecifierFor(importerPath, newPath) {
	const aliased = aliasForPath(newPath);
	if (aliased) {
		return aliased.remainder ? `${aliased.alias}/${aliased.remainder}` : aliased.alias;
	}
	const importerDir = dirname(importerPath);
	const rel = relative(importerDir, newPath.replace(/\.(ts|tsx)$/, ""));
	return rel.startsWith(".") ? rel : `./${rel}`;
}

async function rewriteFile(filePath, moves) {
	const abs = join(REPO_ROOT, filePath);
	const original = await readFile(abs, "utf8");
	let next = original;
	for (const move of moves) {
		const matchers = buildSpecifierMatchers(move.from);
		const replacement = rewriteSpecifierFor(filePath, move.to);
		for (const matcher of matchers) {
			// Match either `from "X"` or `from 'X'`. Escape regex meta.
			const escaped = matcher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const re = new RegExp(`(from\\s+['"])${escaped}(['"])`, "g");
			next = next.replace(re, `$1${replacement}$2`);
			// Also catch dynamic imports: `import("X")` / `import('X')`.
			const dynRe = new RegExp(`(import\\(\\s*['"])${escaped}(['"]\\s*\\))`, "g");
			next = next.replace(dynRe, `$1${replacement}$2`);
		}
	}
	if (next !== original) {
		await writeFile(abs, next, "utf8");
		return true;
	}
	return false;
}

async function main() {
	const manifestPath = process.argv[2];
	if (!manifestPath) {
		console.error("usage: node scripts/restructure-imports.mjs <moves.json>");
		process.exit(2);
	}
	const moves = JSON.parse(await readFile(manifestPath, "utf8"));
	if (!Array.isArray(moves)) {
		console.error("moves manifest must be a JSON array of {from,to} records");
		process.exit(2);
	}
	const files = listSourceFiles();
	let changed = 0;
	for (const file of files) {
		if (await rewriteFile(file, moves)) changed += 1;
	}
	console.log(`rewrote imports in ${changed} file(s) across ${moves.length} move(s)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
