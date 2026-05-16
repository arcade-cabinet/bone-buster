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
 * The set of legal import-specifier shapes for one move, computed
 * per-importer because the relative form changes with importer
 * depth. Returns specifiers that could appear in importerPath's
 * source pointing at fromPath:
 *   - alias forms (`@/<rest>`, `@app/<rest>`, any bucket alias that
 *     covered the old path)
 *   - the importer-relative form (`./constants`, `../../weapons`)
 */
function buildSpecifierMatchers(fromPath, importerPath) {
	const noExt = fromPath.replace(/\.(ts|tsx)$/, "");
	const specifiers = new Set();
	if (noExt.startsWith("src/")) {
		specifiers.add(`@/${noExt.slice(4)}`);
	}
	if (noExt.startsWith("app/")) {
		specifiers.add(`@app/${noExt.slice(4)}`);
	}
	// Importer-relative form. Drop the extension so authors who wrote
	// `from './constants'` (no extension) and `from './constants.ts'`
	// (with extension — rare but legal) both match.
	const importerDir = dirname(importerPath);
	const rel = relative(importerDir, noExt);
	const normalized = rel.startsWith(".") ? rel : `./${rel}`;
	specifiers.add(normalized);
	// Also allow any pre-existing bucket alias usage if the old path
	// already lived under a bucket (e.g. `@scene/foo` for a file that
	// then moves inside src/scene/).
	const oldAliased = aliasForPath(fromPath);
	if (oldAliased) {
		specifiers.add(
			oldAliased.remainder ? `${oldAliased.alias}/${oldAliased.remainder}` : oldAliased.alias,
		);
	}
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

	// Pass 1: any moved file is itself an importer of OTHER modules.
	// Its sibling-relative imports were authored against its OLD
	// location and break when the file moves. Reanchor them to the
	// new directory.
	const selfMove = moves.find((m) => m.to === filePath);
	if (selfMove) {
		next = reanchorOwnImports(next, selfMove.from, selfMove.to);
	}

	// Pass 2: every other file that imports a moved module gets its
	// import-specifier rewritten to the new path / alias.
	for (const move of moves) {
		const matchers = buildSpecifierMatchers(move.from, filePath);
		const replacement = rewriteSpecifierFor(filePath, move.to);
		for (const matcher of matchers) {
			const escaped = matcher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const re = new RegExp(`(from\\s+['"])${escaped}(['"])`, "g");
			next = next.replace(re, `$1${replacement}$2`);
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

/**
 * Pass-1 reanchor: rewrite every relative import in `source` so it
 * resolves the same target after the file moves from `fromPath` to
 * `toPath`. Alias imports (`@/x`, `@scene/y`) are unaffected because
 * they don't depend on the importer's directory.
 */
function reanchorOwnImports(source, fromPath, toPath) {
	const fromDir = dirname(fromPath);
	const toDir = dirname(toPath);
	if (fromDir === toDir) return source;
	const re = /(from\s+['"]|import\(\s*['"])(\.[^'"]+)(['"])/g;
	return source.replace(re, (_full, prefix, spec, suffix) => {
		// Resolve the import against the OLD directory, then re-express
		// it relative to the NEW directory.
		const targetFromOld = resolve("/", fromDir, spec).slice(1);
		const reAnchored = relative(toDir, targetFromOld);
		const normalized = reAnchored.startsWith(".") ? reAnchored : `./${reAnchored}`;
		return `${prefix}${normalized}${suffix}`;
	});
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
