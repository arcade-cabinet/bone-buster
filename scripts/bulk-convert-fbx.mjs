#!/usr/bin/env node
/**
 * IF6 — bulk FBX→GLB conversion pass. Walks `raw-assets/extracted/**`
 * for FBX sources and emits matching GLBs to
 * `references/_extracted/{category}/{pack-slug}/{relative-path}.glb`.
 *
 * Distinct from `scripts/convert-fbx.mjs`:
 *   - convert-fbx.mjs is the CURATED list of JOBS that ship into
 *     public/assets/models/. Hand-maintained; one entry per
 *     production asset; references docs/ASSET_PROVENANCE.md.
 *   - bulk-convert-fbx.mjs (this file) is the EXPLORATORY walker.
 *     Mirrors every FBX from raw-assets/extracted/ into the local
 *     references/_extracted/ staging area so the D5/D7/D9
 *     archetype-content lanes have GLB candidates to hand-pick from.
 *
 * Both directories are gitignored. Shipping GLBs land in
 * public/assets/models/ via the curated convert-fbx.mjs flow.
 *
 * Idempotent: skips GLBs whose mtime is newer than their FBX source.
 *
 * Usage:
 *   pnpm assets:bulk-fbx-to-glb         # walk + convert everything
 *   pnpm assets:bulk-fbx-to-glb --dry   # list candidates without converting
 *   pnpm assets:bulk-fbx-to-glb --category=psx,horror   # restrict
 */

import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import convert from "fbx2gltf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "raw-assets", "extracted");
const DST = join(ROOT, "references", "_extracted");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const catArg = argv.find((a) => a.startsWith("--category="));
const categoryFilter = catArg
	? new Set(
			catArg
				.slice("--category=".length)
				.split(",")
				.map((s) => s.trim().toLowerCase()),
		)
	: null;

function* walkFbx(dir) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isDirectory()) {
			yield* walkFbx(full);
		} else if (e.isFile() && /\.fbx$/i.test(e.name)) {
			yield full;
		}
	}
}

function mtimeOrZero(path) {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return 0;
	}
}

function categoryOf(fbxAbs) {
	// raw-assets/extracted/<category>/<pack-slug>/...
	const rel = relative(SRC, fbxAbs);
	const parts = rel.split("/");
	return parts[0] ?? "misc";
}

try {
	statSync(SRC);
} catch {
	console.error(`bulk-convert-fbx: ${SRC} missing. Run IF5 (\`pnpm itch:fetch\`) first.`);
	process.exit(1);
}

const candidates = [];
for (const fbx of walkFbx(SRC)) {
	const cat = categoryOf(fbx);
	if (categoryFilter && !categoryFilter.has(cat)) continue;
	const rel = relative(SRC, fbx);
	const glb = join(DST, rel.replace(/\.fbx$/i, ".glb"));
	candidates.push({ fbx, glb, rel, cat });
}

console.log(
	`bulk-convert-fbx: ${candidates.length} FBX source(s) found ` +
		`(category-filter=${categoryFilter ? [...categoryFilter].join(",") : "none"}, dry=${DRY})`,
);

if (candidates.length === 0) process.exit(0);

let converted = 0;
let skipped = 0;
let failed = 0;

for (const { fbx, glb, rel, cat } of candidates) {
	const fbxM = mtimeOrZero(fbx);
	const glbM = mtimeOrZero(glb);
	if (glbM > fbxM) {
		skipped++;
		continue;
	}
	if (DRY) {
		console.log(`  WOULD CONVERT [${cat}] ${rel}`);
		converted++;
		continue;
	}
	mkdirSync(dirname(glb), { recursive: true });
	process.stdout.write(`  [${cat}] ${rel} ... `);
	try {
		await convert(fbx, glb, ["--khr-materials-unlit"]);
		console.log("OK");
		converted++;
	} catch (err) {
		console.error(`FAIL: ${err instanceof Error ? err.message : err}`);
		failed++;
	}
}

console.log(`\nbulk-convert-fbx: done. converted=${converted} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
