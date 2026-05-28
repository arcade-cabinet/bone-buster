/**
 * Verify that every GLB referenced from src/models.ts actually exists
 * at the resolved path under public/assets/models/ AND is a well-formed
 * binary glTF (12-byte header: "glTF" magic, version 2, length matches
 * file size). Runs as part of `pnpm verify`.
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

import { open, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const GLB_MAGIC = 0x46546c67; // "glTF" little-endian

/**
 * Validate a binary glTF (.glb) 12-byte header: magic must be "glTF",
 * container version 2, and the declared total length must equal the file
 * size. Catches the zero-magic / truncated corruption class that a plain
 * existence check (stat) misses — two such GLBs shipped corrupt-on-disk
 * (born broken in #75) and only a runtime parse error surfaced them.
 * Returns an error string, or null if the header is well-formed.
 */
async function validateGlbHeader(onDisk, fileSize) {
	const fh = await open(onDisk, "r");
	try {
		const buf = Buffer.alloc(12);
		const { bytesRead } = await fh.read(buf, 0, 12, 0);
		if (bytesRead < 12) return `truncated GLB header (${bytesRead} bytes)`;
		const magic = buf.readUInt32LE(0);
		if (magic !== GLB_MAGIC) {
			return `bad GLB magic 0x${magic.toString(16).padStart(8, "0")} (expected "glTF")`;
		}
		const version = buf.readUInt32LE(4);
		if (version !== 2) return `unsupported GLB container version ${version} (expected 2)`;
		const declaredLen = buf.readUInt32LE(8);
		if (declaredLen !== fileSize) {
			return `GLB length mismatch: header says ${declaredLen}, file is ${fileSize}`;
		}
		return null;
	} finally {
		await fh.close();
	}
}

const root = resolve(import.meta.dirname, "..");
// Source files that contribute A("/assets/models/...") references.
// Lives as an explicit allowlist rather than a glob so additions are
// deliberate.
// RS3 — paths updated to the post-restructure layout.
const SOURCE_FILES = [
	resolve(root, "src/assets/models.ts"),
	resolve(root, "src/world/lampScatter.ts"),
	resolve(root, "src/world/scatter/propPool.ts"),
	resolve(root, "src/world/scatter/floorTiles.ts"),
	resolve(root, "src/world/doors.ts"),
	resolve(root, "src/world/decals.ts"),
	resolve(root, "src/world/debris.ts"),
	resolve(root, "src/world/largeProps.ts"),
	resolve(root, "src/world/chaingunSkins.ts"),
	resolve(root, "src/world/meleeSkins.ts"),
	resolve(root, "src/world/pistolSkins.ts"),
	resolve(root, "src/world/tools.ts"),
	resolve(root, "src/world/vehicles.ts"),
	resolve(root, "src/world/kitchen.ts"),
	resolve(root, "src/world/loot.ts"),
	resolve(root, "src/world/nature.ts"),
	resolve(root, "src/world/npcs.ts"),
	resolve(root, "src/world/traps.ts"),
	resolve(root, "src/world/structures.ts"),
	resolve(root, "src/world/floorTextures.ts"),
];

function categoryOf(publicPath) {
	// Try models subfolder first (e.g. /assets/models/enemies/foo.glb → "enemies").
	const modelMatch = publicPath.match(/\/assets\/models\/([^/]+)\//);
	if (modelMatch) return modelMatch[1];
	// Textures collapse into a single "textures" category.
	if (publicPath.startsWith("/assets/textures/")) return "textures";
	return "other";
}

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// Concat all source files and extract every A("/assets/models/...") literal.
const sources = await Promise.all(SOURCE_FILES.map((p) => readFile(p, "utf8")));
const combined = sources.join("\n");
// Match both /assets/models/ (GLBs) and /assets/textures/ (PBR maps).
const matches = [...combined.matchAll(/A\("(\/assets\/(?:models|textures)\/[^"]+)"\)/g)];
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
	if (url.endsWith(".glb")) {
		const headerErr = await validateGlbHeader(onDisk, info.size);
		if (headerErr) {
			errors.push(`CORRUPT-GLB: ${url} — ${headerErr}`);
			continue;
		}
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
