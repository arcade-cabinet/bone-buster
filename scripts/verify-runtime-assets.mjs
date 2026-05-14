/**
 * Verify that every GLB referenced from src/models.ts actually exists
 * at the resolved path under public/assets/models/. Runs as part of
 * `pnpm verify`.
 *
 * Source-of-truth: parse src/models.ts for `A("/assets/models/...")`
 * literals, strip the helper, stat the result. Anything missing
 * exits non-zero. Reports per-category totals for visibility but
 * does NOT enforce arbitrary byte budgets — those were quality-
 * crippling and forced the wiring to lean variants when richer ones
 * were available. Asset weight is a deliberate tuning decision, not
 * a CI gate.
 *
 * Why a script and not a unit test: this is a deployment gate that
 * needs to fail the build on a missing file, not a vitest assertion.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
// Source files that contribute A("/assets/models/...") references.
// Lives as an explicit allowlist rather than a glob so additions are
// deliberate.
const SOURCE_FILES = [
	resolve(root, "src/models.ts"),
	resolve(root, "src/lampScatter.ts"),
	resolve(root, "src/scatter/propPool.ts"),
	resolve(root, "src/scatter/floorTiles.ts"),
	resolve(root, "src/doors.ts"),
	resolve(root, "src/decals.ts"),
	resolve(root, "src/debris.ts"),
	resolve(root, "src/largeProps.ts"),
];

function categoryOf(publicPath) {
	const m = publicPath.match(/\/assets\/models\/([^/]+)\//);
	return m?.[1] ?? "other";
}

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// Concat all source files and extract every A("/assets/models/...") literal.
const sources = await Promise.all(SOURCE_FILES.map((p) => readFile(p, "utf8")));
const combined = sources.join("\n");
const matches = [...combined.matchAll(/A\("(\/assets\/models\/[^"]+)"\)/g)];
if (matches.length === 0) {
	console.error("verify-runtime-assets: no A() URLs found across", SOURCE_FILES.join(", "));
	process.exit(1);
}

const urls = [...new Set(matches.map((m) => m[1]))]; // de-dup
const errors = [];
const summary = [];

for (const url of urls) {
	const onDisk = resolve(root, "public", url.replace(/^\//, ""));
	let info;
	try {
		info = await stat(onDisk);
	} catch {
		errors.push(`MISSING: ${url} → ${onDisk}`);
		continue;
	}
	if (!info.isFile()) {
		errors.push(`NOT-A-FILE: ${url}`);
		continue;
	}
	summary.push({ url, cat: categoryOf(url), size: info.size });
}

const totalBytes = summary.reduce((s, x) => s + x.size, 0);

console.log(`verify-runtime-assets: ${summary.length} URL(s) checked`);
for (const cat of new Set(summary.map((x) => x.cat))) {
	const inCat = summary.filter((x) => x.cat === cat);
	const catBytes = inCat.reduce((s, x) => s + x.size, 0);
	console.log(`  ${cat}: ${inCat.length} file(s), ${formatBytes(catBytes)} total`);
}
console.log(`  TOTAL: ${formatBytes(totalBytes)}`);

if (errors.length > 0) {
	console.error("\nverify-runtime-assets: FAILED");
	for (const e of errors) console.error(`  ${e}`);
	process.exit(1);
}

console.log("verify-runtime-assets: OK");
